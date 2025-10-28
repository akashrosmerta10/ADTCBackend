const mongoose = require('mongoose');

const updateSchema = new mongoose.Schema({
  content: { type: String, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedAt: { type: Date, default: Date.now }
});

const supportTicketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, required: true, enum: ['open', 'in-progress', 'closed'] },
  priority: { type: String, required: true, enum: ['low', 'medium', 'high'] },
  createdAt: { type: Date, default: Date.now },
  updates: [updateSchema]
});

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = SupportTicket;