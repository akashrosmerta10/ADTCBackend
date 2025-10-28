
const mongoose = require("mongoose");
const { Schema } = mongoose;

const ModuleProgressSchema = new Schema(
  {
    moduleId: { type: Schema.Types.ObjectId, required: true, index: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CourseProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, required: true, index: true },
    modules: { type: [ModuleProgressSchema], default: [] },
    overallProgress: { type: Number, min: 0, max: 100, default: 0 },
    lastComputedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CourseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports =
  mongoose.models.CourseProgress ||
  mongoose.model("CourseProgress", CourseProgressSchema);
