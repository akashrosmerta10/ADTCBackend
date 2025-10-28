const mongoose = require('mongoose');

const ModeBreakdownSchema = new mongoose.Schema(
    {
        hours: { type: Number, default: 0 },
        sessions: { type: Number, default: 0 },
    },
    { _id: false }
);

const TraineeProgressSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }, 


        theoryHours: { type: Number, default: 0 }, 
        practicalHours: { type: Number, default: 0 },
        totalHoursTarget: { type: Number, default: 40 }, 
        completionPct: { type: Number, default: 0, min: 0, max: 100 },

        attendanceRatePct: { type: Number, default: 0, min: 0, max: 100 },
        overallGradePercent: { type: Number, default: 0, min: 0, max: 100 },
        overallGradeBand: { type: String, default: '-' },

        modeBreakdown: {
            simulator: { type: ModeBreakdownSchema, default: () => ({}) }, 
            roadTrack: { type: ModeBreakdownSchema, default: () => ({}) },
            classroom: { type: ModeBreakdownSchema, default: () => ({}) },
        },


        recentMilestone: { type: String, trim: true }, 
        nextMilestone: { type: String, trim: true },
        lastUpdatedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

TraineeProgressSchema.index({ userId: 1 });
module.exports = mongoose.model('TraineeProgress', TraineeProgressSchema);
