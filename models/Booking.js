const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
{
sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingSession', required: true },
traineeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
bookedAt: { type: Date, default: Date.now },
status: { type: String, enum: ['booked', 'cancelled', 'attended', 'missed'], default: 'booked' },
source: { type: String, enum: ['self_service', 'assigned'], default: 'self_service' },
notes: { type: String, trim: true },
},
{ timestamps: true }
);

BookingSchema.index({ traineeId: 1, sessionId: 1 }, { unique: true });
BookingSchema.index({ traineeId: 1, createdAt: -1 });
BookingSchema.index({ sessionId: 1 });

module.exports = mongoose.model('Booking', BookingSchema);