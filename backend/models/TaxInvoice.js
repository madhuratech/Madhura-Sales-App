const mongoose = require('mongoose');

const taxInvoiceItemSchema = new mongoose.Schema({
    companyId: {
      type: String,
      default: 'company_madhura',
      index: true
    },
  sl_no: { type: Number, required: true },
  description: { type: String, required: true },
  sac_code: { type: String, default: '' },
  uom: { type: String, default: 'Lumpsum' },
  quantity: { type: Number, required: true },
  total_amount: { type: Number, required: true }
});

const taxInvoiceRevisionSchema = new mongoose.Schema({
  revision_no: { type: Number, default: 1 },
  savedAt: { type: Date, default: Date.now },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const taxInvoiceSchema = new mongoose.Schema({
  companyId: {
    type: String,
    default: 'company_madhura',
    index: true
  },
  revisions: [taxInvoiceRevisionSchema],
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  client_name: { type: String, default: '' },
  client_company: { type: String, default: '' },
  client_address: { type: String, default: '' },
  client_gstin: { type: String, default: '' },
  service_no: { type: String, default: '' },
  client_code: { type: String, default: '' },
  invoice_no: { type: String, required: true, unique: true },
  running_bill_no: { type: String, default: '' },
  bill_date: { type: Date, required: true },
  advance_amount: { type: Number, default: 0 },
  items: [taxInvoiceItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('TaxInvoice', taxInvoiceSchema);
