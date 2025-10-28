const mongoose = require('mongoose');

const AvailabilitySchema = new mongoose.Schema(
    {
        trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        date: { type: Date, required: true },
        slots: [
            {
                startAt: { type: Date, required: true },
                endAt: { type: Date, required: true },
                mode: { type: String, enum: ['classroom', 'online'] },
                trainingType: { type: String, enum: ['theory', 'practical'] },
                capacity: { type: Number, min: 1 },
                linkedSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingSession' },
            },
        ],
        status: { type: String, enum: ['open', 'partially_booked', 'closed'], default: 'open' },
    },
    { timestamps: true }
);

AvailabilitySchema.index({ trainerId: 1, date: 1 });

module.exports = mongoose.model('Availability', AvailabilitySchema);