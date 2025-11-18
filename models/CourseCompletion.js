// models/CourseCompletion.js
const mongoose = require("mongoose");

const CourseCompletionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
}, { timestamps: true });

CourseCompletionSchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model("CourseCompletion", CourseCompletionSchema);
