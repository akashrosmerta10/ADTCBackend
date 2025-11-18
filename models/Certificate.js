const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    certificateId: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
    },
    courseName: {
      type: String,
      required: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    pdfUrl: {
      type: String, // optional: link to PDF (S3/local)
    },
    status: {
      type: String,
      enum: ["issued", "revoked"],
      default: "issued",
    },
  },
  { timestamps: true }
);


certificateSchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.models.Certificate || mongoose.model("Certificate", certificateSchema);
