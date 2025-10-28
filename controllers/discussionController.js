const Discussion = require('../models/Discussion');

exports.createDiscussion = async (req, res) => {
  try {
    const discussion = new Discussion(req.body);
    await discussion.save();
    res.status(201).json(discussion);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getAllDiscussions = async (req, res) => {
  try {
    const discussions = await Discussion.find();
    res.json(discussions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDiscussion = async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    if (discussion == null) {
      return res.status(404).json({ message: 'Discussion not found' });
    }
    res.json(discussion);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateDiscussion = async (req, res) => {
  try {
    const discussion = await Discussion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(discussion);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteDiscussion = async (req, res) => {
  try {
    await Discussion.findByIdAndRemove(req.params.id);
    res.json({ message: 'Discussion deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addReply = async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    discussion.replies.push(req.body);
    await discussion.save();
    res.status(201).json(discussion);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};