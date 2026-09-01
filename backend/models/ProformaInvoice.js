const mongoose = require('mongoose');

const performaItemSchema = new mongoose.Schema({
    companyId: {
      type: String,
      default: 'company_madhura',
      index: true
    },
  product_number: { type: Number },
  description: { type: String, required: true },
  brand_model: { type: String, default: '' },
  uom: { type: String, default: 'Nos' },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  subtotal: { type: Number, required: true },
  hsn_code: { type: String, default: '' }
});

const performaRevisionSchema = new mongoose.Schema({
  revision_no: { type: Number, default: 1 },
  savedAt: { type: Date, default: Date.now },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const performaInvoiceSchema = new mongoose.Schema({
  companyId: {
    type: String,
    default: 'company_madhura',
    index: true
  },
  revisions: [performaRevisionSchema],
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  invoice_date: { type: Date, required: true },
  subtotal: { type: Number, default: 0 },
  total_tax: { type: Number, default: 0 },
  total_cgst: { type: Number, default: 0 },
  total_sgst: { type: Number, default: 0 },
  total_discount: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  reference_no: { type: String, default: '' },
  from_address_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FromAddress' },
  from_address_custom: { type: String, default: null },
  client_company: { type: String, default: '' },
  client_address1: { type: String, default: '' },
  client_address2: { type: String, default: '' },
  client_city: { type: String, default: '' },
  client_state: { type: String, default: '' },
  client_pincode: { type: String, default: '' },
  client_country: { type: String, default: 'India' },
  client_gstin: { type: String, default: '' },
  tax_type: { type: String, default: 'GST18' },
  custom_tax: { type: Number, default: null },
  exec_name: { type: String, default: '' },
  exec_phone: { type: String, default: '' },
  exec_email: { type: String, default: '' },
  terms_general: { type: Boolean, default: false },
  terms_tax: { type: Boolean, default: false },
  terms_project_period: { type: String, default: '' },
  terms_validity: { type: Boolean, default: true },
  terms_separate_orders: { type: mongoose.Schema.Types.Mixed, default: null },
  terms_payment: { type: String, default: '' },
  terms_payment_custom: { type: String, default: '' },
  terms_warranty: { type: String, default: '' },
  validity: { type: String, default: '' },
  terms_json: { type: String, default: '' },
  items: [performaItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('ProformaInvoice', performaInvoiceSchema);
