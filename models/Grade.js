const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  score: { type: Number, required: true },
  feedback: String,
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gradedAt: { type: Date, default: Date.now }
});

const Grade = mongoose.model('Grade', gradeSchema);

module.exports = Grade;