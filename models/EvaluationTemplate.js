const mongoose = require('mongoose');

const CriterionSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true }, 
        weightPct: { type: Number, required: true, min: 0, max: 100 },
        maxPoints: { type: Number, required: true, min: 1 },
        description: { type: String, trim: true },
    },
    { _id: false }
);

const GradeBandSchema = new mongoose.Schema(
    {
        minPct: { type: Number, required: true, min: 0, max: 100 },
        grade: { type: String, required: true, trim: true }, 
    },
    { _id: false }
);

const EvaluationTemplateSchema = new mongoose.Schema(
    {
        key: {
            testType: { type: String, required: true, trim: true }, 
            trainingMode: { type: String, required: true, trim: true }, 
        },
        title: { type: String, required: true, trim: true },
        criteria: { type: [CriterionSchema], validate: v => v.length > 0 },
        gradeBands: { type: [GradeBandSchema], default: [] }, 
        active: { type: Boolean, default: true },
        version: { type: Number, default: 1 },
        notes: { type: String, trim: true },
    },
    { timestamps: true }
);

EvaluationTemplateSchema.index({ 'key.testType': 1, 'key.trainingMode': 1, active: 1 }, { unique: false });

module.exports = mongoose.model('EvaluationTemplate', EvaluationTemplateSchema);