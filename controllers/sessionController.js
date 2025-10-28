const mongoose = require('mongoose');
const TrainingSession = require('../models/TrainingSession');
const Booking = require('../models/Booking');
const Batch = require('../models/Batch');
const errorResponse = require('../utils/errorResponse');

const requireRoleLocal = (req, roles) => Array.isArray(req.user?.roles) && roles.some(r => req.user.roles.includes(r));
const isObjectId = (v) => typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v);


exports.createSession = async (req, res) => {
  try {
    if (!requireRoleLocal(req, ['Trainer'])) {
      return res.status(403).json({ success: false, statusCode: 403, message: 'Trainer role required' });
    }
    const {
      topic, trainingType, mode: rawMode, level,
      date, startAt, endAt,
      capacityMax, batchId: rawBatchId,
      location, environment, notes
    } = req.body;
    const mode = rawMode;
    let batchId = rawBatchId || undefined;
    if (batchId && !isObjectId(batchId)) {
      let batch = await Batch.findOne({ code: batchId }).select('_id');
      if (!batch) {
        batch = await Batch.create({
          code: batchId,
          name: batchId,
        });
      }
      batchId = batch._id;
    }

    const session = await TrainingSession.create({
      trainerId: req.user.id,
      batchId: batchId || undefined,
      topic,
      trainingType,
      mode,
      level,
      date,
      startAt,
      endAt,
      capacity: { max: capacityMax, booked: 0, waitlist: 0 },
      status: 'draft',
      location,
      environment,
      notes
    });

    return res.status(201).json({ success: true, statusCode: 201, message: "session created successfully", data: session });
  } catch (error) {
    return errorResponse(res, error)
  }
};



exports.listTrainerCalendar = async (req, res) => {
  try {
    if (!requireRoleLocal(req, ["Trainer"]))
   return res.status(403).json({ success: false, statusCode: 403, message: 'Trainer role required' });

    const { start, end } = req.query;

    const q = { trainerId: req.user.id };
    if (start || end) {
      q.date = {};
      if (start) q.date.$gte = new Date(start);
      if (end) q.date.$lte = new Date(end);
    }

    const sessions = await TrainingSession.find(q).sort({ date: 1, startAt: 1 });

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const [todayCount, upcomingCount, completedCount] = await Promise.all([
      TrainingSession.countDocuments({
        trainerId: req.user.id,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ["booked", "in_progress"] },
      }),
      TrainingSession.countDocuments({
        trainerId: req.user.id,
        date: { $gt: today },
        status: { $in: ["draft", "booked"] },
      }),
      TrainingSession.countDocuments({
        trainerId: req.user.id,
        status: "completed",
      }),
    ]);

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "calander fetched successfully",
      data: {
        sessions,
        stats: {
          today: todayCount,
          upcoming: upcomingCount,
          completed: completedCount,
        },
      },
    });
  } catch (err) {
    return errorResponse(res, error)
  }
};

exports.listAvailableForTrainee = async (req, res) => {
  try {
    if (!requireRoleLocal(req, ['Learner']))    return res.status(403).json({ success: false, statusCode: 403, message: 'Learner role required' });
    const { mode, trainingType, from, to } = req.query;
    const now = new Date();
    const q = {
      date: { $gte: from ? new Date(from) : now },
      status: { $in: ['draft', 'booked'] },
      $expr: { $lt: ['$capacity.booked', '$capacity.max'] },
    };
    if (to) q.date.$lte = new Date(to);
    if (mode) q.mode = mode;
    if (trainingType) q.trainingType = trainingType;

    const booked = await Booking.find({
      traineeId: req.user.id,
      status: { $in: ['booked', 'in_progress', 'attended'] }
    }).select('sessionId');
    const excludeIds = booked.map(b => b.sessionId);
    if (excludeIds.length) q._id = { $nin: excludeIds };

    const sessions = await TrainingSession.find(q).sort({ date: 1, startAt: 1 });

    return res.status(200).json({ success: true, statusCode: 200, message: "session fetched successfully", data: sessions });

  } catch (error) {
    return errorResponse(res, error)
  }
};

exports.updateSession = async (req, res) => {
  try {
    if (!requireRoleLocal(req, ['Trainer'])) return res.status(403).json({ success: false, statusCode: 403, message: 'Trainer role required' });
    const { id } = req.params;
    const allowed = ['topic', 'trainingType', 'mode', 'level', 'date', 'startAt', 'endAt', 'location', 'environment', 'notes', 'capacity'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    const session = await TrainingSession.findOne({ _id: id, trainerId: req.user.id });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (['completed', 'cancelled'].includes(session.status)) {
      return res.status(400).json({ success: false, statusCode: 400, message: 'Cannot edit completed or cancelled session' });
    }

    Object.assign(session, updates);
    await session.save();

    return res.status(200).json({ success: true,satusCode: 200, message: "session updated successfully", data: session });

  } catch (err) {
     return errorResponse(res, error)
  }
};

exports.setStatus = async (req, res) => {
  try {
    if (!requireRoleLocal(req, ['Trainer'])) return res.status(403).json({ success: false, statusCode: 403, message: 'Trainer role required' });
    const { id } = req.params;
    const { status } = req.body;

    const session = await TrainingSession.findOne({ _id: id, trainerId: req.user.id });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const valid = ['draft', 'booked', 'in_progress', 'completed', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    session.status = status;
    await session.save();

   return res.status(200).json({ success: true, satusCode: 200, message: "status updated successfully", data: session });
  } catch (err) {
     return errorResponse(res, error)
  }
};

exports.stats = async (req, res) => {
  try {
    if (!requireRoleLocal(req, ['Trainer'])) return res.status(403).json({ success: false, statusCode: 403, message: 'Trainer role required' });
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    const [todayCount, upcomingCount, completedCount] = await Promise.all([
      TrainingSession.countDocuments({ trainerId: req.user.id, date: { $gte: startOfDay, $lte: endOfDay }, status: { $in: ['booked', 'in_progress'] } }),
      TrainingSession.countDocuments({ trainerId: req.user.id, date: { $gt: today }, status: { $in: ['draft', 'booked'] } }),
      TrainingSession.countDocuments({ trainerId: req.user.id, status: 'completed' }),
    ]);

  return res.status(200).json({ success: true, satusCode: 200, message: "stats fetched successfully", data: { today: todayCount, upcoming: upcomingCount, completed: completedCount } });

  } catch (err) {
     return errorResponse(res, error)
  }
};

