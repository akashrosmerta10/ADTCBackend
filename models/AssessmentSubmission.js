const mongoose = require("mongoose");
const { Schema } = mongoose;

const QuestionResultSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, required: true, ref: "Question" },
    type: { type: String, enum: ["mcq", "tf"], required: true },
    score: { type: Number, default: 0 },
    userAnswer: { type: Schema.Types.Mixed, required: true },
    correctAnswer: { type: Schema.Types.Mixed },
    isCorrect: { type: Boolean, required: true },

    text: {
      text: { type: String },
      imageUrl: { type: String, default: null },
    },

    choices: [{ id: String, text: String }],
  },
  { _id: false }
);

const AssessmentSubmissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    courseId: { type: Schema.Types.ObjectId, required: true, ref: "Course", index: true },

    moduleId: { type: Schema.Types.Mixed, required: true, index: true }, 
    attemptKey: { type: String, required: true, index: true, unique: true },
    attemptId: { type: String, required: true, index: true, unique: true },
    attemptNumber: { type: Number, required: true, index: true },

    status: { type: String, enum: ["started", "submitted"], default: "started", index: true },

    startedAt: { type: Date, required: true },
    submittedAt: { type: Date, required: true, default: Date.now },
    timeSeconds: { type: Number, required: true },

    questions: { type: [QuestionResultSchema], default: [] },

    scoreEarned: { type: Number, default: 0 },
    scoreTotal: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    incorrectCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },

    breakdownByType: { type: Schema.Types.Mixed, default: {} },
    percent: { type: Number },
    grade: { type: String },

    maxPercent: { type: Number, default: 0 },
    maxScoreEarned: { type: Number, default: 0 },
    bestGrade: { type: String },

    snapshotModuleName: { type: String },

    sequence: { type: Number, required: true, index: true },
  },
  { timestamps: true }
);

AssessmentSubmissionSchema.index(
  { userId: 1, courseId: 1, moduleId: 1, attemptNumber: 1 },
  { unique: true }
);

AssessmentSubmissionSchema.index({ attemptKey: 1 }, { unique: true }); 
AssessmentSubmissionSchema.index({ attemptId: 1 }, { unique: true }); 

module.exports =
  mongoose.models.AssessmentSubmission ||
  mongoose.model("AssessmentSubmission", AssessmentSubmissionSchema);
