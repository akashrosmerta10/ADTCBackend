const Booking = require('../models/Booking');
const TrainingSession = require('../models/TrainingSession');
const errorResponse = require('../utils/errorResponse');

const requireRoleLocal = (req, roles) =>
    Array.isArray(req.user?.roles) && roles.some(r => req.user.roles.includes(r));

exports.book = async (req, res) => {
    try {
        if (!requireRoleLocal(req, ['Learner'])) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: 'Learner role required',
                data: {},
            });
        }

        const { sessionId } = req.body;

        const active = await Booking.findOne({
            traineeId: req.user.id,
            sessionId,
            status: { $in: ['booked', 'attended', 'in_progress'] }
        }).select('_id');

        if (active) {
            return res.status(409).json({
                success: false,
                statusCode: 409,
                message: 'Already booked',
                data: {},
            });
        }

        const session = await TrainingSession.findOneAndUpdate(
            { _id: sessionId, status: { $in: ['draft', 'booked'] }, $expr: { $lt: ['$capacity.booked', '$capacity.max'] } },
            { $inc: { 'capacity.booked': 1 } },
            { new: true }
        );

        if (!session) {
            return res.status(409).json({
                success: false,
                statusCode: 409,
                message: 'Session full or not bookable',
                data: {},
            });
        }

        try {

            const existingCancelled = await Booking.findOne({
                traineeId: req.user.id,
                sessionId,
                status: 'cancelled',
            });

            if (existingCancelled) {
                existingCancelled.status = 'booked';
                existingCancelled.source = 'self_service';
                existingCancelled.bookedAt = new Date();
                await existingCancelled.save();

                const { _id: bookingId, ...rest } = existingCancelled.toObject();
                const response = { bookingId, ...rest };

                return res.status(200).json({
                    success: true,
                    statusCode: 200,
                    message: 'Booking reactivated successfully',
                    data: response,
                });
            }

            const booking = await Booking.create({
                sessionId,
                traineeId: req.user.id,
                status: 'booked',
                source: 'self_service',
            });

            const { _id: bookingId, ...rest } = booking.toObject();
            const response = { bookingId, ...rest };

            return res.status(201).json({
                success: true,
                statusCode: 201,
                message: 'Session booked successfully',
                data: response,
            });

        } catch (err) {
            await TrainingSession.updateOne({ _id: sessionId }, { $inc: { 'capacity.booked': -1 } });
            throw err;
        }

    } catch (err) {
        return errorResponse(res, err);
    }
};



exports.cancel = async (req, res) => {
    try {
        if (!requireRoleLocal(req, ['Learner'])) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: 'Learner role required',
                data: {},
            });
        }

        const { id } = req.params;
        const booking = await Booking.findOne({ _id: id, traineeId: req.user.id });

        if (!booking) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: 'Booking not found',
                data: {},
            });
        }

        const session = await TrainingSession.findById(booking.sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: 'Session not found',
                data: {},
            });
        }

        if (new Date(session.startAt) <= new Date()) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: 'Cannot cancel past or ongoing sessions',
                data: {},
            });
        }

        if (booking.status !== 'booked') {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: 'Booking is not active',
                data: {},
            });
        }

        booking.status = 'cancelled';
        await booking.save();
        await TrainingSession.updateOne({ _id: session._id }, { $inc: { 'capacity.booked': -1 } });

        const { _id: bookingId, ...rest } = booking.toObject();
        const response = { bookingId, ...rest };

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: 'Booking cancelled successfully',
            data: response,
        });

    } catch (err) {
        return errorResponse(res, err);
    }
};

exports.mySchedule = async (req, res) => {
    try {
        if (!requireRoleLocal(req, ['Learner'])) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: 'Learner role required',
                data: {},
            });
        }

        const { date, type } = req.query;
        const q = { traineeId: req.user.id, status: { $ne: 'cancelled' } };
        let bookings = await Booking.find(q).sort({ createdAt: -1 }).lean();
        const sessionIds = bookings.map(b => b.sessionId);

        const sessionMap = new Map();
        const sessions = await TrainingSession.find({ _id: { $in: sessionIds } }).lean();
        sessions.forEach(s => sessionMap.set(String(s._id), s));

        bookings = bookings
            .map(b => ({ ...b, session: sessionMap.get(String(b.sessionId)) }))
            .filter(b => !!b.session);

        if (date) {
            const d = new Date(date);
            const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
            bookings = bookings.filter(b => b.session.date >= start && b.session.date <= end);
        }
        if (type) bookings = bookings.filter(b => b.session.trainingType === type);

        const response = bookings.map(b => {
            const { _id: bookingId, ...rest } = b;
            return { bookingId, ...rest };
        });

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: 'Schedule fetched successfully',
            data: response,
        });

    } catch (err) {
        return errorResponse(res, err);
    }
};


exports.rescheduleBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { newSessionId } = req.body;
        const traineeId = req.user.id;

        if (!id || !newSessionId) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Missing required fields",
                data: {},
            });
        }

        const oldBooking = await Booking.findOne({ _id: id, traineeId });
        if (!oldBooking) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "Old booking not found",
                data: {},
            });
        }

        oldBooking.status = "cancelled";
        await oldBooking.save();

        const newSession = await TrainingSession.findById(newSessionId);
        if (!newSession) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "New session not found",
                data: {},
            });
        }

        const newBooking = await Booking.create({
            traineeId,
            sessionId: newSession._id,
            status: "booked",
            source: "self_service"
        });

        const { _id: oldBookingId, ...oldRest } = oldBooking.toObject();
        const { _id: newBookingId, ...newRest } = newBooking.toObject();

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Booking rescheduled successfully",
            data: {
                oldBooking: { bookingId: oldBookingId, ...oldRest },
                newBooking: { bookingId: newBookingId, ...newRest },
            },
        });

    } catch (err) {
        return errorResponse(res, err);
    }
};
