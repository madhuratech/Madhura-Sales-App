const CrmQuotation = require('../models/CrmQuotation');
const Customer = require('../models/Customer');
const Client = require('../models/Client');
const nodemailer = require("nodemailer");
const { generateInvoicePdf } = require("../utils/generateInvoicePdf");

// Validate quotation body helper
const validateQuotation = (body) => {
  if (!body || typeof body !== "object") return "Invalid request body";
  const { customer, quotation, invoice, items } = body;
  const q = quotation || invoice;
  const c = customer || {};

  if (!c.customer_name) return "Customer name is required";
  if (!c.mobile_number) return "Mobile number is required";
  if (!q || (!q.quotation_date && !q.invoice_date)) return "Date is required";
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

// Map a quotation document (or revision snapshot) into flat rows (SQL join style)
const mapQuotationRows = (q) => {
  const c = customerInfo(q);
  return q.items.map(item => ({
    quotation_id: q._id,
    invoice_date: q.quotation_date,
    subtotal: q.subtotal,
    total_tax: q.total_tax,
    total_cgst: q.total_cgst,
    total_sgst: q.total_sgst,
    total_discount: q.total_discount,
    grand_total: q.grand_total,
    reference_no: q.reference_no,
    from_address_id: q.from_address_id?._id || q.from_address_id || null,
    from_address_custom: q.from_address_custom,
    resolved_from_address: q.from_address_custom || q.from_address_id?.address || '',
    client_company: q.client_company,
    client_address1: q.client_address1,
    client_address2: q.client_address2,
    client_city: q.client_city,
    client_state: q.client_state,
    client_pincode: q.client_pincode,
    client_country: q.client_country,
    tax_type: q.tax_type,
    custom_tax: q.custom_tax,
    exec_name: q.exec_name,
    exec_phone: q.exec_phone,
    exec_email: q.exec_email,
    terms_general: q.terms_general ? 1 : 0,
    terms_tax: q.terms_tax ? 1 : 0,
    terms_project_period: q.terms_project_period,
    terms_validity: q.terms_validity ? 1 : 0,
    terms_separate_orders: q.terms_separate_orders,
    terms_payment: q.terms_payment,
    terms_payment_custom: q.terms_payment_custom,
    terms_warranty: q.terms_warranty,
    validity: q.validity,
    terms_json: q.terms_json,
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

// Build a revision snapshot of a quotation (with resolved customer contact info)
const makeQuotationSnapshot = (doc, dbCustomer) => {
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

// GET all quotations
exports.getQuotations = async (req, res, next) => {
  try {
    const quotations = await CrmQuotation.find()
      .populate('customer_id')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    // Map to list view layout
    const formatted = quotations.map(q => ({
      id: q._id,
      quotation_date: q.quotation_date,
      grand_total: q.grand_total,
      reference_no: q.reference_no,
      customer_name: q.customer_id?.customer_name || '',
      mobile_number: q.customer_id?.mobile_number || '',
      location_city: q.customer_id?.location_city || '',
      email: q.customer_id?.email || '',
      description: q.items?.[0]?.description || ''
    }));

    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

// GET single quotation by ID
exports.getQuotationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const q = await CrmQuotation.findById(id)
      .populate('customer_id')
      .populate('from_address_id')
      .lean();

    if (!q) {
      return res.status(404).json([]);
    }

    res.status(200).json(mapQuotationRows(q));
  } catch (error) {
    next(error);
  }
};

// GET revision list for a quotation
exports.getQuotationRevisions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const q = await CrmQuotation.findById(id).lean();
    if (!q) return res.status(404).json({ message: "Quotation not found" });

    const revisions = (q.revisions || [])
      .slice()
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
      .map(r => ({
        id: r._id,
        revision_no: r.revision_no,
        savedAt: r.savedAt,
        reference_no: r.data?.reference_no || q.reference_no,
        grand_total: r.data?.grand_total ?? q.grand_total,
        customer_name: r.data?._customer?.customer_name || q.customer_name || '',
        quotation_date: r.data?.quotation_date || null
      }));

    res.status(200).json(revisions);
  } catch (error) {
    next(error);
  }
};

// GET a single quotation revision (flat rows format, same as getQuotationById)
exports.getQuotationRevisionById = async (req, res, next) => {
  try {
    const { id, revisionId } = req.params;
    const q = await CrmQuotation.findById(id).lean();
    if (!q) return res.status(404).json([]);

    const rev = (q.revisions || []).find(r => String(r._id) === String(revisionId));
    if (!rev) return res.status(404).json([]);

    const doc = { _id: q._id, ...q, ...rev.data };
    res.status(200).json(mapQuotationRows(doc));
  } catch (error) {
    next(error);
  }
};

// DELETE a quotation revision
exports.deleteQuotationRevision = async (req, res, next) => {
  try {
    const { id, revisionId } = req.params;
    const q = await CrmQuotation.findById(id);
    if (!q) return res.status(404).json({ message: "Quotation not found" });

    q.revisions = (q.revisions || []).filter(r => String(r._id) !== String(revisionId));
    await q.save();
    res.status(200).json({ message: "Revision deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// CREATE quotation
exports.createQuotation = async (req, res, next) => {
  const error = validateQuotation(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const { customer, quotation, invoice, items, extra } = req.body;
    const q = quotation || invoice;
    const ex = extra || {};

    // Get or Create Customer
    let dbCustomer = await Customer.findOne({ mobile_number: customer.mobile_number });
    if (!dbCustomer) {
      dbCustomer = await Customer.create({
        customer_name: customer.customer_name,
        mobile_number: customer.mobile_number,
        email: customer.email || '',
        location_city: customer.location_city || ''
      });
    } else {
      // Update details if customer changed
      dbCustomer.customer_name = customer.customer_name;
      dbCustomer.email = customer.email || dbCustomer.email;
      dbCustomer.location_city = customer.location_city || dbCustomer.location_city;
      await dbCustomer.save();
    }

    // Upsert Client for other modules' lookup
    await Client.findOneAndUpdate(
      { phone: customer.mobile_number },
      {
        name: customer.customer_name,
        company_name: ex.client_company || customer.customer_name,
        email: customer.email || '',
        phone: customer.mobile_number
      },
      { upsert: true, new: true }
    );

    // Auto-generate reference number
    const refNo = `QT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const quotationDate = (q && (q.quotation_date || q.invoice_date)) || new Date();

    const newQuotation = await CrmQuotation.create({
      customer_id: dbCustomer._id,
      quotation_date: quotationDate,
      subtotal: q.subtotal || 0,
      total_tax: (q.total_cgst || 0) + (q.total_sgst || 0),
      total_cgst: q.total_cgst || 0,
      total_sgst: q.total_sgst || 0,
      total_discount: q.total_discount || 0,
      grand_total: q.grand_total || 0,
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
      message: "Quotation Created Successfully",
      quotationId: newQuotation._id,
      reference_no: refNo
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE quotation
exports.updateQuotation = async (req, res, next) => {
  const error = validateQuotation(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const { id } = req.params;
    const { customer, quotation, invoice, items, extra } = req.body;
    const q = quotation || invoice;
    const ex = extra || {};
    const quotationDate = (q && (q.quotation_date || q.invoice_date)) || new Date();

    const dbQuotation = await CrmQuotation.findById(id);
    if (!dbQuotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    // Update Customer details
    const dbCustomer = await Customer.findById(dbQuotation.customer_id);
    if (dbCustomer) {
      dbCustomer.customer_name = customer.customer_name;
      dbCustomer.mobile_number = customer.mobile_number;
      dbCustomer.email = customer.email || dbCustomer.email;
      dbCustomer.location_city = customer.location_city || dbCustomer.location_city;
      await dbCustomer.save();
    }

    // Preserve previous version as a revision before overwriting
    const prevMaxRev = (dbQuotation.revisions || []).reduce((m, r) => Math.max(m, r.revision_no || 0), 0);
    dbQuotation.revisions = dbQuotation.revisions || [];
    dbQuotation.revisions.push({
      revision_no: prevMaxRev + 1,
      savedAt: new Date(),
      data: makeQuotationSnapshot(dbQuotation, dbCustomer)
    });

    // Update Quotation details
    dbQuotation.quotation_date = quotationDate;
    dbQuotation.subtotal = q.subtotal || 0;
    dbQuotation.total_tax = (q.total_cgst || 0) + (q.total_sgst || 0);
    dbQuotation.total_cgst = q.total_cgst || 0;
    dbQuotation.total_sgst = q.total_sgst || 0;
    dbQuotation.total_discount = q.total_discount || 0;
    dbQuotation.grand_total = q.grand_total || 0;
    dbQuotation.from_address_id = ex.from_address_id || null;
    dbQuotation.from_address_custom = ex.from_address_custom || null;
    dbQuotation.client_company = ex.client_company || '';
    dbQuotation.client_address1 = ex.client_address1 || '';
    dbQuotation.client_address2 = ex.client_address2 || '';
    dbQuotation.client_city = ex.client_city || '';
    dbQuotation.client_state = ex.client_state || '';
    dbQuotation.client_pincode = ex.client_pincode || '';
    dbQuotation.client_country = ex.client_country || 'India';
    dbQuotation.tax_type = ex.tax_type || 'GST18';
    dbQuotation.custom_tax = ex.custom_tax || null;
    dbQuotation.exec_name = ex.exec_name || '';
    dbQuotation.exec_phone = ex.exec_phone || '';
    dbQuotation.exec_email = ex.exec_email || '';
    dbQuotation.terms_general = !!ex.terms_general;
    dbQuotation.terms_tax = !!ex.terms_tax;
    dbQuotation.terms_project_period = ex.terms_project_period || '';
    dbQuotation.terms_validity = ex.terms_validity !== false;
    dbQuotation.terms_separate_orders = ex.terms_separate_orders || null;
    dbQuotation.terms_payment = ex.terms_payment || '';
    dbQuotation.terms_payment_custom = ex.terms_payment_custom || '';
    dbQuotation.terms_warranty = ex.terms_warranty || '';
    dbQuotation.validity = ex.validity || '';
    dbQuotation.terms_json = ex.terms_json || '';
    
    // Replace items
    dbQuotation.items = items.map((item, index) => ({
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

    await dbQuotation.save();
    res.status(200).json({ message: "Quotation updated successfully" });
  } catch (error) {
    next(error);
  }
};

// DELETE quotation
exports.deleteQuotation = async (req, res, next) => {
  try {
    const { id } = req.params;
    await CrmQuotation.findByIdAndDelete(id);
    res.status(200).json({ message: "Quotation deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// SEND quotation email with PDF
exports.sendEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { to, subject, revisionId } = req.body;

    const q = await CrmQuotation.findById(id).populate('customer_id').populate('from_address_id').lean();
    if (!q) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    // If a specific revision is requested, send that version instead of the current one
    let doc = q;
    if (revisionId) {
      const rev = (q.revisions || []).find(r => String(r._id) === String(revisionId));
      if (rev) doc = { ...q, ...rev.data };
    }

    const cInfo = customerInfo(doc);
    doc.mobile_number = cInfo.mobile_number;
    doc.email = cInfo.email;
    doc.customer_name = cInfo.customer_name;

    const recipientEmail = to || cInfo.email;
    if (!recipientEmail) {
      return res.status(400).json({ message: "No email address provided" });
    }

    // Standardize fields for generator
    doc.invoice_date = doc.quotation_date;

    const pdfBuffer = await generateInvoicePdf({
      invoice: doc,
      items: doc.items,
      type: "quotation"
    });

    const year = new Date(doc.quotation_date).getFullYear();
    const qtNumber = doc.reference_no || `QT-${year}-${String(doc._id).slice(-3)}`;

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
      subject: subject || `Quotation ${qtNumber}`,
      html: `<div style="font-family:Arial,sans-serif;padding:24px;max-width:600px;margin:0 auto;">
        <p style="font-size:16px;color:#1e293b;">Dear Customer,</p>
        <p style="font-size:14px;color:#374151;margin-top:12px;">Please find your <strong>Quotation ${qtNumber}</strong> attached to this email.</p>
        <p style="font-size:14px;color:#374151;margin-top:8px;">Thank you for your business.</p>
        <p style="font-size:14px;color:#374151;margin-top:16px;">Regards,<br/><strong>Achme Communication</strong></p>
      </div>`,
      attachments: [
        {
          filename: `Quotation_${qtNumber}.pdf`,
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
