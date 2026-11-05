const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 },
  uploaded_at: { type: Date, default: Date.now }
}, { _id: true });

const ticketMessageSchema = new mongoose.Schema({
  sender: { type: String, enum: ['CLIENT', 'STAFF'], default: 'CLIENT' },
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  author_name: { type: String, required: true },
  author_email: { type: String, default: '' },
  message: { type: String, required: true },
  internal: { type: Boolean, default: false },
  attachments: [attachmentSchema],
  created_at: { type: Date, default: Date.now }
});

const ticketSchema = new mongoose.Schema({
  companyId: {
    type: String,
    default: 'company_madhura',
    index: true
  },
  source: {
    type: String,
    enum: ['CRM', 'PORTAL'],
    default: 'CRM',
    index: true
  },
  code: { type: String, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientOnboarding', index: true },
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, default: 'GENERAL' },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
  status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], default: 'OPEN' },
  creator: {
    contact_id: String,
    name: String,
    email: String,
    phone: String
  },
  assignee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  messages: [ticketMessageSchema],
  attachments: [attachmentSchema],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
