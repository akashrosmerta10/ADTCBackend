const Availability = require('../models/Availability');
const TrainingSession = require('../models/TrainingSession');
const errorResponse = require('../utils/errorResponse');

const requireRoleLocal = (req, roles) => Array.isArray(req.user?.roles) && roles.some(r => req.user.roles.includes(r));

exports.createSlots = async (req, res) => {
    try {
        if (!requireRoleLocal(req, ["Trainer"])) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: "Trainer role required",
                data: {},
            });
        }

        const { date, slots } = req.body;

        if (!Array.isArray(slots) || !slots.length) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "At least one slot required",
                data: {},
            });
        }

        const doc = await Availability.findOneAndUpdate(
            { trainerId: req.user.id, date: new Date(date) },
            { $setOnInsert: { status: "open" }, $push: { slots: { $each: slots } } },
            { upsert: true, new: true }
        );

        const { _id: availabilityId, ...rest } = doc.toObject();
        const response = { availabilityId, ...rest };

        return res.status(201).json({
            success: true,
            statusCode: 201,
            message: "Slots created successfully",
            data: response,
        });
    } catch (err) {
        return errorResponse(res, err);
    }
};

exports.list = async (req, res) => {
    try {
        if (!requireRoleLocal(req, ['Trainer'])) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: "Trainer role required",
                data: {},
            });
        }

        const { start, end } = req.query;
        const q = { trainerId: req.user.id };

        if (start || end) {
            q.date = {};
            if (start) q.date.$gte = new Date(start);
            if (end) q.date.$lte = new Date(end);
        }

        const items = await Availability.find(q).sort({ date: 1 });

        const availableCount = items.reduce((sum, d) => sum + d.slots.filter(s => !s.linkedSessionId).length, 0);

        const response = {
            items: items.map(item => {
                const { _id: availabilityId, ...rest } = item.toObject();
                return { availabilityId, ...rest };
            }),
            availableCount,
        };

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Availability slots fetched successfully",
            data: response,
        });

    } catch (err) {
        return errorResponse(res, err);
    }
};

exports.closeSlotLinkSession = async (req, res) => {
    try {
        if (!requireRoleLocal(req, ['Trainer'])) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: "Trainer role required",
                data: {},
            });
        }

        const { availabilityId, slotId, sessionId } = req.body;

        const avail = await Availability.findOne({ _id: availabilityId, trainerId: req.user.id, 'slots._id': slotId });
        if (!avail) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "Availability slot not found",
                data: {},
            });
        }

        await Availability.updateOne(
            { _id: availabilityId, 'slots._id': slotId },
            { $set: { 'slots.$.linkedSessionId': sessionId, status: 'partially_booked' } }
        );

        const updated = await Availability.findById(availabilityId);
        const allLinked = updated.slots.every(s => s.linkedSessionId);
        if (allLinked && updated.status !== 'closed') {
            updated.status = 'closed';
            await updated.save();
        }

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Slot linked to session successfully",
            data: { linked: true, status: updated.status },
        });

    } catch (err) {
        return errorResponse(res, err);
    }
};
