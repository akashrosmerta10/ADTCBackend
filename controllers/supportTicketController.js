const SupportTicket = require('../models/SupportTicket');

exports.createSupportTicket = async (req, res) => {
  try {
    const supportTicket = new SupportTicket(req.body);
    await supportTicket.save();
    res.status(201).json(supportTicket);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getAllSupportTickets = async (req, res) => {
  try {
    const supportTickets = await SupportTicket.find();
    res.json(supportTickets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSupportTicket = async (req, res) => {
  try {
    const supportTicket = await SupportTicket.findById(req.params.id);
    if (supportTicket == null) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }
    res.json(supportTicket);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSupportTicket = async (req, res) => {
  try {
    const supportTicket = await SupportTicket.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(supportTicket);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteSupportTicket = async (req, res) => {
  try {
    await SupportTicket.findByIdAndRemove(req.params.id);
    res.json({ message: 'Support ticket deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addUpdate = async (req, res) => {
  try {
    const supportTicket = await SupportTicket.findById(req.params.id);
    supportTicket.updates.push(req.body);
    await supportTicket.save();
    res.status(201).json(supportTicket);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};