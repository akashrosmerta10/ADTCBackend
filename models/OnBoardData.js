const mongoose = require("mongoose");

const onBoardDataSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    hasLicense: { type: String, enum: ["yes", "no"], default: "no" },
    achievingGoals: [{type: String}],
    licenseType:[{ type: String }],
    yearsExperience: { type: String },

    learningObjectives: [{ type: String }],
    areasOfInterest: [{ type: String }],

    // educationLevel: { type: String },
    // occupation: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.models.OnBoardData || mongoose.model("OnBoardData", onBoardDataSchema);
