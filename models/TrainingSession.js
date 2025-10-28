const mongoose = require('mongoose');

const TrainingSessionSchema = new mongoose.Schema(
    {
        trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        traineeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }, 
        topic: { type: String, trim: true, required: true },

        trainingType: { type: String, enum: ['theory', 'practical'], required: true }, 
        mode: { type: String, enum: ['classroom', 'online'], required: true }, 
        level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' }, 
        date: { type: Date, required: true },
        startAt: { type: Date, required: true },
        endAt: { type: Date, required: true },
        durationMin: { type: Number },

        capacity: {
            max: { type: Number, required: true, min: 1 },
            booked: { type: Number, default: 0, min: 0 },
            waitlist: { type: Number, default: 0, min: 0 },
        }, 

        status: {
            type: String,
            enum: ['draft', 'booked', 'in_progress', 'completed', 'cancelled'],
            default: 'draft',
        },

        location: {
            room: { type: String, trim: true },
            track: { type: String, trim: true },
        }, 

        environment: {
            weather: { type: String, trim: true },
            timeOfDay: { type: String, trim: true },
            traffic: { type: String, trim: true },
        },

        notes: { type: String, trim: true },
    },
    { timestamps: true }
);

TrainingSessionSchema.index({ trainerId: 1, date: 1, startAt: 1 });
TrainingSessionSchema.index({ status: 1, date: 1 });
TrainingSessionSchema.index({ batchId: 1 });

TrainingSessionSchema.pre('validate', function (next) {
    if (!this.durationMin && this.startAt && this.endAt) {
        this.durationMin = Math.max(0, Math.round((this.endAt - this.startAt) / 60000));
    }
    next();
});

module.exports = mongoose.model('TrainingSession', TrainingSessionSchema);