const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  companyId: {
    type: String,
    default: 'company_madhura',
    index: true
  },
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientOnboarding', required: true },
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  type: { type: String, enum: ['QUOTATION', 'MILESTONE', 'PROFORMA', 'CHANGE_REQUEST'], default: 'QUOTATION' },
  entity_id: { type: String },
  title: { type: String, required: true },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  document_url: { type: String, default: '' },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  decision_by: { type: String, default: '' },
  comments: { type: String, default: '' },
  signature_token: { type: String, default: '' },
  decided_at: { type: Date },
  due_date: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Approval', approvalSchema);
