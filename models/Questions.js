const mongoose = require("mongoose");
const { Schema } = mongoose;

const QuestionSchema = new Schema(
  {
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: "Module",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["mcq", "tf", "image"], required: true },
    question: {
      text: { type: String },
      imageUrl: { type: String },
    },
    score: { type: Number, default: 1 },

    options: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          if (this.type === "mcq") return Array.isArray(v) && v.length >= 2;
          return true;
        },
        message: "MCQ must have at least two options",
      },
    },

    correctAnswer: {
      type: Schema.Types.Mixed,
      required: true,
    },

    difficulty: { type: String, default: undefined },
    explanation: { type: String, default: undefined },
    active: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);
QuestionSchema.pre("validate", function (next) {
  if (this.type === "imagetype" && !this.question.imageUrl) {
    return next(new Error("Image is required for imagetype questions"));
  }
  if (this.type !== "imagetype" && !this.question.text) {
    return next(new Error("Question text is required for non-image types"));
  }
  next();
});

module.exports = mongoose.model("Question", QuestionSchema);
