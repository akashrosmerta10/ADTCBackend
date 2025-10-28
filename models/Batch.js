const mongoose = require('mongoose');

const BatchSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, unique: true, trim: true },
        title: { type: String, trim: true },
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        trainees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        status: { type: String, enum: ['active', 'inactive', 'archived'], default: 'active' },
    },
    { timestamps: true }
);

BatchSchema.index({ code: 1 }, { unique: true });
BatchSchema.index({ trainerId: 1, status: 1 });

module.exports = mongoose.model('Batch', BatchSchema);