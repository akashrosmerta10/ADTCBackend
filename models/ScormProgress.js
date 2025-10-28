const mongoose = require("mongoose");

const ScormProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      required: true,
      index: true,
    },
    scormData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lessonStatus: {
      type: String,
      enum: ["not attempted", "incomplete", "completed", "passed", "failed", "browsed"],
      default: "not attempted",
    },
    lastPosition: {
      type: String,
      default: "",
    },
    videoDuration: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

ScormProgressSchema.index({ userId: 1, courseId: 1, moduleId: 1 }, { unique: true });

ScormProgressSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.models.ScormProgress || mongoose.model("ScormProgress", ScormProgressSchema);
