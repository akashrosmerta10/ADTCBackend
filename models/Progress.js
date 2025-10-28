const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  moduleProgress: [
    {
      moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
      status: { type: String, enum: ['completed', 'in-progress', 'not-started'], required: true },
      score: { type: Number, min: 0, max: 100 },
      lastAccessed: { type: Date }
    }
  ],
  overallProgress: { type: Number, min: 0, max: 100 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
 }, {
    timestamps: true
  });

const Progress = mongoose.model('Progress', progressSchema);

module.exports = Progress;
