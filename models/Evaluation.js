const mongoose = require('mongoose');

const CriterionScoreSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true }, 
        weightPct: { type: Number, required: true, min: 0, max: 100 }, 
        scoreOutOf: { type: Number, required: true, min: 1 }, 
        earned: { type: Number, required: true, min: 0 },
        note: { type: String, trim: true },
    },
    { _id: false }
);

const EvaluationSchema = new mongoose.Schema(
    {
        sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingSession', required: true },
        trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        traineeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
        testType: { type: String, required: true, trim: true },
        trainingMode: { type: String, required: true, trim: true },
        templateVersion: { type: Number, default: 1 },

        criteriaScores: { type: [CriterionScoreSchema], validate: v => v.length > 0 },
        overall: {
            percent: { type: Number, default: 0, min: 0, max: 100 },
            grade: { type: String, default: '-', trim: true }, 
            remarks: { type: String, trim: true },
        },
        feedback: {
            summary: { type: String, trim: true },
            recommendations: { type: [String], default: [] },
        },
        environmentSummary: {
            weather: { type: String, trim: true },
            time: { type: String, trim: true },
            traffic: { type: String, trim: true },
        },
        evaluatedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['pending', 'completed'], default: 'completed' },
    },
    { timestamps: true }
);

EvaluationSchema.index({ sessionId: 1, traineeId: 1 }, { unique: true });
EvaluationSchema.index({ trainerId: 1, evaluatedAt: -1 });
EvaluationSchema.index({ traineeId: 1, evaluatedAt: -1 });

EvaluationSchema.methods.computeOverall = function (gradeBands = []) {
    const totalWeight = this.criteriaScores.reduce((s, c) => s + c.weightPct, 0) || 0;
    const pct =
        totalWeight === 0
            ? 0
            : this.criteriaScores.reduce((s, c) => s + (c.earned / c.scoreOutOf) * c.weightPct, 0);
    this.overall.percent = Math.max(0, Math.min(100, Math.round(pct)));
    let band = '-';
    for (const gb of gradeBands.sort((a, b) => a.minPct - b.minPct)) {
        if (this.overall.percent >= gb.minPct) band = gb.grade;
    }
    this.overall.grade = band;
};

module.exports = mongoose.model('Evaluation', EvaluationSchema);