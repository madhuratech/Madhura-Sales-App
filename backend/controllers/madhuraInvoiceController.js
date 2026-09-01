const TaxInvoice = require('../models/TaxInvoice');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');

// Map a tax invoice document (or revision snapshot) into flat rows
const mapTaxInvoiceRows = (inv) => {
  return inv.items.map(item => ({
    id: inv._id,
    client_id: inv.client_id?._id || inv.client_id || null,
    client_name: inv.client_name,
    client_company: inv.client_company,
    client_address: inv.client_address,
    client_gstin: inv.client_gstin,
    service_no: inv.service_no,
    client_code: inv.client_code,
    invoice_no: inv.invoice_no,
    running_bill_no: inv.running_bill_no,
    bill_date: inv.bill_date ? new Date(inv.bill_date).toISOString() : '',
    advance_amount: inv.advance_amount,
    sl_no: item.sl_no,
    description: item.description,
    sac_code: item.sac_code,
    uom: item.uom,
    quantity: item.quantity,
    total_amount: item.total_amount
  }));
};

// Build a revision snapshot of a tax invoice
const makeTaxInvoiceSnapshot = (doc) => {
  const obj = doc.toObject();
  const snapshot = { ...obj };
  delete snapshot._id;
  delete snapshot.__v;
  delete snapshot.revisions;
  delete snapshot.createdAt;
  delete snapshot.updatedAt;
  delete snapshot.companyId;
  return snapshot;
};

// GET all invoices (with-payments layout)
exports.getInvoices = async (req, res, next) => {
  try {
    const invoices = await TaxInvoice.find()
      .populate('client_id')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const formatted = await Promise.all(invoices.map(async inv => {
      const payments = await Payment.find({ invoice_id: inv._id }).lean();
      const paid_amount = payments.reduce((sum, p) => sum + p.amount, 0);

      return {
        id: inv._id,
        client_company: inv.client_company || inv.client_name || '',
        invoice_date: inv.bill_date,
        invoice_duedate: inv.bill_date,
        project_names: inv.service_no,
        category: inv.client_code,
        paid_amount
      };
    }));

    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

// GET next details for auto-generating invoice values
exports.getNextDetails = async (req, res, next) => {
  try {
    const { clientId, serviceType = 'CRM' } = req.query;

    const count = await TaxInvoice.countDocuments();
    const nextNum = count + 1;
    const paddedNum = String(nextNum).padStart(3, '0');
    const paddedServiceNum = String(nextNum).padStart(2, '0');

    // MT/26-27/001
    const invoice_no = `MT/26-27/${paddedNum}`;
    // MT/CRM/INV/01
    const service_no = `MT/${serviceType}/INV/${paddedServiceNum}`;
    // MT/RB/001
    const running_bill_no = `MT/RB/${paddedNum}`;

    let client_code = `MT${paddedNum}`;
    if (clientId && clientId !== 'null' && clientId !== 'undefined') {
      const customer = await Customer.findById(clientId).lean();
      if (customer) {
        // Find if this customer already has invoices
        const existingInvoice = await TaxInvoice.findOne({ client_id: customer._id }).lean();
        if (existingInvoice && existingInvoice.client_code) {
          client_code = existingInvoice.client_code;
        } else {
          // Generate from customer index or ID slice
          client_code = `MT${String(customer._id).slice(-3).toUpperCase()}`;
        }
      }
    }

    res.status(200).json({
      invoice_no,
      service_no,
      client_code,
      running_bill_no,
      bill_date: new Date().toISOString().slice(0, 10)
    });
  } catch (error) {
    next(error);
  }
};

// GET single invoice by ID
exports.getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const inv = await TaxInvoice.findById(id).populate('client_id').lean();
    if (!inv) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.status(200).json(mapTaxInvoiceRows(inv));
  } catch (error) {
    next(error);
  }
};

// GET revision list for a tax invoice
exports.getInvoiceRevisions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const inv = await TaxInvoice.findById(id).lean();
    if (!inv) return res.status(404).json({ message: "Invoice not found" });

    const revisions = (inv.revisions || [])
      .slice()
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
      .map(r => {
        const items = r.data?.items || inv.items || [];
        const totalAmount = items.reduce((s, it) => s + (Number(it.total_amount) || 0), 0);
        return {
          id: r._id,
          revision_no: r.revision_no,
          savedAt: r.savedAt,
          invoice_no: r.data?.invoice_no || inv.invoice_no,
          client_company: r.data?.client_company || inv.client_company,
          grand_total: totalAmount,
          bill_date: r.data?.bill_date || null
        };
      });

    res.status(200).json(revisions);
  } catch (error) {
    next(error);
  }
};

// GET a single tax invoice revision (flat rows format, same as getInvoiceById)
exports.getInvoiceRevisionById = async (req, res, next) => {
  try {
    const { id, revisionId } = req.params;
    const inv = await TaxInvoice.findById(id).lean();
    if (!inv) return res.status(404).json([]);

    const rev = (inv.revisions || []).find(r => String(r._id) === String(revisionId));
    if (!rev) return res.status(404).json([]);

    const doc = { _id: inv._id, ...inv, ...rev.data };
    res.status(200).json(mapTaxInvoiceRows(doc));
  } catch (error) {
    next(error);
  }
};

// DELETE a tax invoice revision
exports.deleteInvoiceRevision = async (req, res, next) => {
  try {
    const { id, revisionId } = req.params;
    const inv = await TaxInvoice.findById(id);
    if (!inv) return res.status(404).json({ message: "Invoice not found" });

    inv.revisions = (inv.revisions || []).filter(r => String(r._id) !== String(revisionId));
    await inv.save();
    res.status(200).json({ message: "Revision deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// CREATE tax invoice
exports.createInvoice = async (req, res, next) => {
  try {
    const { header, items } = req.body;
    if (!header || !items || items.length === 0) {
      return res.status(400).json({ message: "Invalid request payload" });
    }

    // Lookup client/customer if client_id exists
    let clientId = header.client_id;
    if (clientId && (clientId === 'null' || clientId === 'undefined')) {
      clientId = null;
    }

    const newInvoice = await TaxInvoice.create({
      client_id: clientId || null,
      client_name: header.client_name || '',
      client_company: header.client_company || '',
      client_address: header.client_address || '',
      client_gstin: header.client_gstin || '',
      service_no: header.service_no || '',
      client_code: header.client_code || '',
      invoice_no: header.invoice_no,
      running_bill_no: header.running_bill_no || '',
      bill_date: header.bill_date ? new Date(header.bill_date) : new Date(),
      advance_amount: Number(header.advance_amount) || 0,
      items: items.map(item => ({
        sl_no: Number(item.sl_no),
        description: item.description,
        sac_code: item.sac_code || '',
        uom: item.uom || 'Lumpsum',
        quantity: Number(item.quantity) || 1,
        total_amount: Number(item.total_amount) || 0
      }))
    });

    // If advance_amount was specified, insert a payment record too
    if (newInvoice.advance_amount > 0) {
      await Payment.create({
        invoice_id: newInvoice._id,
        amount: newInvoice.advance_amount
      });
    }

    res.status(201).json({
      message: "Invoice created",
      invoiceId: newInvoice._id
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE tax invoice
exports.updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { header, items } = req.body;
    if (!header || !items || items.length === 0) {
      return res.status(400).json({ message: "Invalid request payload" });
    }

    const dbInvoice = await TaxInvoice.findById(id);
    if (!dbInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Preserve previous version as a revision before overwriting
    const prevMaxRev = (dbInvoice.revisions || []).reduce((m, r) => Math.max(m, r.revision_no || 0), 0);
    dbInvoice.revisions = dbInvoice.revisions || [];
    dbInvoice.revisions.push({
      revision_no: prevMaxRev + 1,
      savedAt: new Date(),
      data: makeTaxInvoiceSnapshot(dbInvoice)
    });

    dbInvoice.client_name = header.client_name || '';
    dbInvoice.client_company = header.client_company || '';
    dbInvoice.client_address = header.client_address || '';
    dbInvoice.client_gstin = header.client_gstin || '';
    dbInvoice.service_no = header.service_no || '';
    dbInvoice.client_code = header.client_code || '';
    dbInvoice.invoice_no = header.invoice_no;
    dbInvoice.running_bill_no = header.running_bill_no || '';
    dbInvoice.bill_date = header.bill_date ? new Date(header.bill_date) : new Date();
    
    const prevAdvance = dbInvoice.advance_amount;
    dbInvoice.advance_amount = Number(header.advance_amount) || 0;
    
    dbInvoice.items = items.map(item => ({
      sl_no: Number(item.sl_no),
      description: item.description,
      sac_code: item.sac_code || '',
      uom: item.uom || 'Lumpsum',
      quantity: Number(item.quantity) || 1,
      total_amount: Number(item.total_amount) || 0
    }));

    await dbInvoice.save();

    // Adjust payment record if advance amount changed
    if (dbInvoice.advance_amount !== prevAdvance) {
      // Find the first payment and update it, or create if it didn't exist
      const firstPayment = await Payment.findOne({ invoice_id: dbInvoice._id });
      if (firstPayment) {
        if (dbInvoice.advance_amount > 0) {
          firstPayment.amount = dbInvoice.advance_amount;
          await firstPayment.save();
        } else {
          await Payment.findByIdAndDelete(firstPayment._id);
        }
      } else if (dbInvoice.advance_amount > 0) {
        await Payment.create({
          invoice_id: dbInvoice._id,
          amount: dbInvoice.advance_amount
        });
      }
    }

    res.status(200).json({ message: "Invoice updated" });
  } catch (error) {
    next(error);
  }
};

// DELETE tax invoice
exports.deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    await TaxInvoice.findByIdAndDelete(id);
    await Payment.deleteMany({ invoice_id: id });
    res.status(200).json({ message: "Invoice deleted" });
  } catch (error) {
    next(error);
  }
};
