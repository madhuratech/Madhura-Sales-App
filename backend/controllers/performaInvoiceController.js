const ProformaInvoice = require('../models/ProformaInvoice');
const Customer = require('../models/Customer');
const Client = require('../models/Client');
const nodemailer = require("nodemailer");
const { generateInvoicePdf } = require("../utils/generateInvoicePdf");

const validateInvoice = (body) => {
  if (!body || typeof body !== "object") return "Invalid request body";
  const { customer, performaInvoice, items } = body;
  const c = customer || {};

  if (!c.customer_name) return "Customer name is required";
  if (!c.mobile_number) return "Mobile number is required";
  if (!performaInvoice || !performaInvoice.invoice_date) return "Invoice date is required";
  if (!items || items.length === 0) return "At least one item is required";

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.description) return `Item ${i + 1}: Description is required`;
    if (item.price === "" || item.price === null || item.price === undefined) return `Item ${i + 1}: Price is required`;
    if (!item.quantity || item.quantity <= 0) return `Item ${i + 1}: Quantity must be greater than 0`;
  }
  return null;
};

// Resolve customer contact info from either a populated customer_id or a revision snapshot
const customerInfo = (doc) => {
  if (doc.customer_id && typeof doc.customer_id === 'object' && doc.customer_id.customer_name) {
    return {
      customer_name: doc.customer_id.customer_name,
      mobile_number: doc.customer_id.mobile_number,
      email: doc.customer_id.email,
      location_city: doc.customer_id.location_city
    };
  }
  if (doc._customer) {
    return {
      customer_name: doc._customer.customer_name || '',
      mobile_number: doc._customer.mobile_number || '',
      email: doc._customer.email || '',
      location_city: doc._customer.location_city || ''
    };
  }
  return { customer_name: '', mobile_number: '', email: '', location_city: '' };
};

// Map a proforma invoice document (or revision snapshot) into flat rows
const mapProformaRows = (p) => {
  const c = customerInfo(p);
  return p.items.map(item => ({
    performainvoice_id: p._id,
    invoice_date: p.invoice_date,
    subtotal: p.subtotal,
    total_tax: p.total_tax,
    total_cgst: p.total_cgst,
    total_sgst: p.total_sgst,
    total_discount: p.total_discount,
    grand_total: p.grand_total,
    reference_no: p.reference_no,
    from_address_id: p.from_address_id?._id || p.from_address_id || null,
    from_address_custom: p.from_address_custom,
    resolved_from_address: p.from_address_custom || p.from_address_id?.address || '',
    client_company: p.client_company,
    client_address1: p.client_address1,
    client_address2: p.client_address2,
    client_city: p.client_city,
    client_state: p.client_state,
    client_pincode: p.client_pincode,
    client_country: p.client_country,
    client_gstin: p.client_gstin,
    tax_type: p.tax_type,
    custom_tax: p.custom_tax,
    exec_name: p.exec_name,
    exec_phone: p.exec_phone,
    exec_email: p.exec_email,
    terms_general: p.terms_general ? 1 : 0,
    terms_tax: p.terms_tax ? 1 : 0,
    terms_project_period: p.terms_project_period,
    terms_validity: p.terms_validity ? 1 : 0,
    terms_separate_orders: p.terms_separate_orders,
    terms_payment: p.terms_payment,
    terms_payment_custom: p.terms_payment_custom,
    terms_warranty: p.terms_warranty,
    validity: p.validity,
    terms_json: p.terms_json,
    customer_name: c.customer_name,
    mobile_number: c.mobile_number,
    email: c.email,
    location_city: c.location_city,
    product_number: item.product_number,
    description: item.description,
    brand_model: item.brand_model,
    uom: item.uom,
    price: item.price,
    quantity: item.quantity,
    tax: item.tax,
    discount: item.discount,
    item_subtotal: item.subtotal,
    hsn_code: item.hsn_code
  }));
};

// Build a revision snapshot of a proforma invoice (with resolved customer contact info)
const makeProformaSnapshot = (doc, dbCustomer) => {
  const obj = doc.toObject();
  const snapshot = { ...obj };
  snapshot._customer = dbCustomer
    ? {
        customer_name: dbCustomer.customer_name || '',
        mobile_number: dbCustomer.mobile_number || '',
        email: dbCustomer.email || '',
        location_city: dbCustomer.location_city || ''
      }
    : customerInfo(doc);
  delete snapshot._id;
  delete snapshot.__v;
  delete snapshot.revisions;
  delete snapshot.createdAt;
  delete snapshot.updatedAt;
  delete snapshot.companyId;
  return snapshot;
};

// GET all proforma invoices
exports.getProformaInvoices = async (req, res, next) => {
  try {
    const invoices = await ProformaInvoice.find()
      .populate('customer_id')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const formatted = invoices.map(p => ({
      id: p._id,
      invoice_date: p.invoice_date,
      grand_total: p.grand_total,
      reference_no: p.reference_no,
      customer_name: p.customer_id?.customer_name || '',
      mobile_number: p.customer_id?.mobile_number || '',
      location_city: p.customer_id?.location_city || '',
      email: p.customer_id?.email || '',
      description: p.items?.[0]?.description || ''
    }));

    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

// GET single proforma invoice by ID
exports.getProformaInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const p = await ProformaInvoice.findById(id)
      .populate('customer_id')
      .populate('from_address_id')
      .lean();

    if (!p) {
      return res.status(404).json([]);
    }

    res.status(200).json(mapProformaRows(p));
  } catch (error) {
    next(error);
  }
};

// GET revision list for a proforma invoice
exports.getProformaRevisions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const p = await ProformaInvoice.findById(id).lean();
    if (!p) return res.status(404).json({ message: "Proforma Invoice not found" });

    const revisions = (p.revisions || [])
      .slice()
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
      .map(r => ({
        id: r._id,
        revision_no: r.revision_no,
        savedAt: r.savedAt,
        reference_no: r.data?.reference_no || p.reference_no,
        grand_total: r.data?.grand_total ?? p.grand_total,
        customer_name: r.data?._customer?.customer_name || '',
        invoice_date: r.data?.invoice_date || null
      }));

    res.status(200).json(revisions);
  } catch (error) {
    next(error);
  }
};

// GET a single proforma revision (flat rows format, same as getProformaInvoiceById)
exports.getProformaRevisionById = async (req, res, next) => {
  try {
    const { id, revisionId } = req.params;
    const p = await ProformaInvoice.findById(id).lean();
    if (!p) return res.status(404).json([]);

    const rev = (p.revisions || []).find(r => String(r._id) === String(revisionId));
    if (!rev) return res.status(404).json([]);

    const doc = { _id: p._id, ...p, ...rev.data };
    res.status(200).json(mapProformaRows(doc));
  } catch (error) {
    next(error);
  }
};

// DELETE a proforma revision
exports.deleteProformaRevision = async (req, res, next) => {
  try {
    const { id, revisionId } = req.params;
    const p = await ProformaInvoice.findById(id);
    if (!p) return res.status(404).json({ message: "Proforma Invoice not found" });

    p.revisions = (p.revisions || []).filter(r => String(r._id) !== String(revisionId));
    await p.save();
    res.status(200).json({ message: "Revision deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// CREATE proforma invoice
exports.createProformaInvoice = async (req, res, next) => {
  const error = validateInvoice(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const { customer, performaInvoice, items, extra } = req.body;
    const ex = extra || {};

    let dbCustomer = await Customer.findOne({ mobile_number: customer.mobile_number });
    if (!dbCustomer) {
      dbCustomer = await Customer.create({
        customer_name: customer.customer_name,
        mobile_number: customer.mobile_number,
        email: customer.email || '',
        location_city: customer.location_city || ''
      });
    } else {
      dbCustomer.customer_name = customer.customer_name;
      dbCustomer.email = customer.email || dbCustomer.email;
      dbCustomer.location_city = customer.location_city || dbCustomer.location_city;
      await dbCustomer.save();
    }

    const refNo = `PI-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newInvoice = await ProformaInvoice.create({
      customer_id: dbCustomer._id,
      invoice_date: performaInvoice.invoice_date,
      subtotal: performaInvoice.subtotal || 0,
      total_tax: performaInvoice.total_tax || 0,
      total_cgst: performaInvoice.total_cgst || 0,
      total_sgst: performaInvoice.total_sgst || 0,
      total_discount: performaInvoice.total_discount || 0,
      grand_total: performaInvoice.grand_total || 0,
      reference_no: refNo,
      from_address_id: ex.from_address_id || null,
      from_address_custom: ex.from_address_custom || null,
      client_company: ex.client_company || '',
      client_address1: ex.client_address1 || '',
      client_address2: ex.client_address2 || '',
      client_city: ex.client_city || '',
      client_state: ex.client_state || '',
      client_pincode: ex.client_pincode || '',
      client_country: ex.client_country || 'India',
      client_gstin: ex.client_gstin || '',
      tax_type: ex.tax_type || 'GST18',
      custom_tax: ex.custom_tax || null,
      exec_name: ex.exec_name || '',
      exec_phone: ex.exec_phone || '',
      exec_email: ex.exec_email || '',
      terms_general: !!ex.terms_general,
      terms_tax: !!ex.terms_tax,
      terms_project_period: ex.terms_project_period || '',
      terms_validity: ex.terms_validity !== false,
      terms_separate_orders: ex.terms_separate_orders || null,
      terms_payment: ex.terms_payment || '',
      terms_payment_custom: ex.terms_payment_custom || '',
      terms_warranty: ex.terms_warranty || '',
      validity: ex.validity || '',
      terms_json: ex.terms_json || '',
      items: items.map((item, index) => ({
        product_number: index + 1,
        description: item.description,
        brand_model: item.brand_model || '',
        uom: item.uom || 'Nos',
        price: item.price,
        quantity: item.quantity,
        tax: item.tax || 0,
        discount: item.discount || 0,
        subtotal: item.subtotal || 0,
        hsn_code: item.hsn_code || ''
      }))
    });

    res.status(201).json({
      message: "Created Successfully",
      invoiceId: newInvoice._id,
      reference_no: refNo
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE proforma invoice
exports.updateProformaInvoice = async (req, res, next) => {
  const error = validateInvoice(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const { id } = req.params;
    const { customer, performaInvoice, items, extra } = req.body;
    const ex = extra || {};

    const dbInvoice = await ProformaInvoice.findById(id);
    if (!dbInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const dbCustomer = await Customer.findById(dbInvoice.customer_id);
    if (dbCustomer) {
      dbCustomer.customer_name = customer.customer_name;
      dbCustomer.mobile_number = customer.mobile_number;
      dbCustomer.email = customer.email || dbCustomer.email;
      dbCustomer.location_city = customer.location_city || dbCustomer.location_city;
      await dbCustomer.save();
    }

    // Preserve previous version as a revision before overwriting
    const prevMaxRev = (dbInvoice.revisions || []).reduce((m, r) => Math.max(m, r.revision_no || 0), 0);
    dbInvoice.revisions = dbInvoice.revisions || [];
    dbInvoice.revisions.push({
      revision_no: prevMaxRev + 1,
      savedAt: new Date(),
      data: makeProformaSnapshot(dbInvoice, dbCustomer)
    });

    dbInvoice.invoice_date = performaInvoice.invoice_date;
    dbInvoice.subtotal = performaInvoice.subtotal || 0;
    dbInvoice.total_tax = performaInvoice.total_tax || 0;
    dbInvoice.total_cgst = performaInvoice.total_cgst || 0;
    dbInvoice.total_sgst = performaInvoice.total_sgst || 0;
    dbInvoice.total_discount = performaInvoice.total_discount || 0;
    dbInvoice.grand_total = performaInvoice.grand_total || 0;
    dbInvoice.from_address_id = ex.from_address_id || null;
    dbInvoice.from_address_custom = ex.from_address_custom || null;
    dbInvoice.client_company = ex.client_company || '';
    dbInvoice.client_address1 = ex.client_address1 || '';
    dbInvoice.client_address2 = ex.client_address2 || '';
    dbInvoice.client_city = ex.client_city || '';
    dbInvoice.client_state = ex.client_state || '';
    dbInvoice.client_pincode = ex.client_pincode || '';
    dbInvoice.client_country = ex.client_country || 'India';
    dbInvoice.client_gstin = ex.client_gstin || '';
    dbInvoice.tax_type = ex.tax_type || 'GST18';
    dbInvoice.custom_tax = ex.custom_tax || null;
    dbInvoice.exec_name = ex.exec_name || '';
    dbInvoice.exec_phone = ex.exec_phone || '';
    dbInvoice.exec_email = ex.exec_email || '';
    dbInvoice.terms_general = !!ex.terms_general;
    dbInvoice.terms_tax = !!ex.terms_tax;
    dbInvoice.terms_project_period = ex.terms_project_period || '';
    dbInvoice.terms_validity = ex.terms_validity !== false;
    dbInvoice.terms_separate_orders = ex.terms_separate_orders || null;
    dbInvoice.terms_payment = ex.terms_payment || '';
    dbInvoice.terms_payment_custom = ex.terms_payment_custom || '';
    dbInvoice.terms_warranty = ex.terms_warranty || '';
    dbInvoice.validity = ex.validity || '';
    dbInvoice.terms_json = ex.terms_json || '';

    dbInvoice.items = items.map((item, index) => ({
      product_number: index + 1,
      description: item.description,
      brand_model: item.brand_model || '',
      uom: item.uom || 'Nos',
      price: item.price,
      quantity: item.quantity,
      tax: item.tax || 0,
      discount: item.discount || 0,
      subtotal: item.subtotal || 0,
      hsn_code: item.hsn_code || ''
    }));

    await dbInvoice.save();
    res.status(200).json({ message: "Updated successfully" });
  } catch (error) {
    next(error);
  }
};

// DELETE proforma invoice
exports.deleteProformaInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    await ProformaInvoice.findByIdAndDelete(id);
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// SEND proforma invoice email with PDF
exports.sendEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { to, subject, revisionId } = req.body;

    const inv = await ProformaInvoice.findById(id).populate('customer_id').populate('from_address_id').lean();
    if (!inv) {
      return res.status(404).json({ message: "Proforma Invoice not found" });
    }

    // If a specific revision is requested, send that version instead of the current one
    let doc = inv;
    if (revisionId) {
      const rev = (inv.revisions || []).find(r => String(r._id) === String(revisionId));
      if (rev) doc = { ...inv, ...rev.data };
    }

    const cInfo = customerInfo(doc);
    doc.mobile_number = cInfo.mobile_number;
    doc.email = cInfo.email;
    doc.customer_name = cInfo.customer_name;

    const recipientEmail = to || cInfo.email;
    if (!recipientEmail) {
      return res.status(400).json({ message: "No email address provided" });
    }

    const pdfBuffer = await generateInvoicePdf({ 
      invoice: doc, 
      items: doc.items, 
      type: "performa" 
    });

    const year = new Date(doc.invoice_date).getFullYear();
    const piNumber = doc.reference_no || `PI-${year}-${String(doc._id).slice(-3)}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { 
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS 
      },
    });

    await transporter.sendMail({
      from: `"Achme Communication" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: subject || `Proforma Invoice ${piNumber}`,
      html: `<div style="font-family:Arial,sans-serif;padding:24px;max-width:600px;margin:0 auto;">
        <p style="font-size:16px;color:#1e293b;">Dear Customer,</p>
        <p style="font-size:14px;color:#374151;margin-top:12px;">Please find your <strong>Proforma Invoice ${piNumber}</strong> attached to this email.</p>
        <p style="font-size:14px;color:#374151;margin-top:8px;">Thank you for your business.</p>
        <p style="font-size:14px;color:#374151;margin-top:16px;">Regards,<br/><strong>Achme Communication</strong></p>
      </div>`,
      attachments: [
        {
          filename: `Proforma_Invoice_${piNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ message: "Failed to send email", error: error.message });
  }
};
