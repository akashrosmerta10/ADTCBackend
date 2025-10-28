const Assignment = require('../models/Assignment');

exports.createAssignment = async (req, res) => {
  try {
    const assignment = new Assignment(req.body);
    await assignment.save();
    res.status(201).json(assignment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getAllAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find();
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (assignment == null) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(assignment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    await Assignment.findByIdAndRemove(req.params.id);
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};