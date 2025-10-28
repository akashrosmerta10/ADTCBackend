const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
    {
        sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingSession', required: true, unique: true },
        trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        records: [
            {
                traineeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
                status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
                markedAt: { type: Date, default: Date.now },
                note: { type: String, trim: true },
            },
        ],
        finalized: { type: Boolean, default: false },
    },
    { timestamps: true }
);

AttendanceSchema.index({ trainerId: 1, sessionId: 1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);