const mongoose = require('mongoose');

const ticketMessageSchema = new mongoose.Schema({
  sender: { type: String, enum: ['CLIENT', 'STAFF'], default: 'CLIENT' },
  author_name: { type: String, required: true },
  author_email: { type: String, default: '' },
  message: { type: String, required: true },
  internal: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const ticketSchema = new mongoose.Schema({
  companyId: {
    type: String,
    default: 'company_madhura',
    index: true
  },
  code: { type: String, required: true },
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientOnboarding' },
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
  assignee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  messages: [ticketMessageSchema],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
