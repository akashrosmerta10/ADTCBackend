

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // recipient (trainee)
        type: { type: String, enum: ['reminder', 'booking', 'completion', 'grade_posted', 'general'], required: true }, 
        title: { type: String, required: true, trim: true },
        body: { type: String, trim: true },
        links: {
            sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingSession' },
            evaluationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evaluation' },
            courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        },
        seen: { type: Boolean, default: false },
        scheduledAt: { type: Date },
    },
    { timestamps: true }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, seen: 1, createdAt: -1 }); 
module.exports = mongoose.model('Notification', NotificationSchema);

