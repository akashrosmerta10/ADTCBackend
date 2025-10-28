const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const TrainingSession = require('../models/TrainingSession');
const Booking = require('../models/Booking');
const errorResponse = require('../utils/errorResponse');

const requireRoleLocal = (req, roles) => Array.isArray(req.user?.roles) && roles.some(r => req.user.roles.includes(r));

exports.openSheet = async (req, res) => {
  try {
    if (!requireRoleLocal(req, ["Trainer"])) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Trainer role required",
        data: {},
      });
    }

    const { sessionId } = req.params;

    const session = await TrainingSession.findOne({
      _id: sessionId,
      trainerId: req.user.id,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Session not found",
        data: {},
      });
    }

    const sheet = await Attendance.findOneAndUpdate(
      { sessionId },
      { $setOnInsert: { trainerId: req.user.id, records: [], finalized: false } },
      { new: true, upsert: true }
    );

    const { _id: sheetId, ...rest } = sheet.toObject();
    const response = { sheetId, ...rest };

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Attendance sheet opened successfully",
      data: response,
    });
  } catch (err) {
    return errorResponse(res, err);
  }
};

exports.mark = async (req, res) => {
  try {
    if (!requireRoleLocal(req, ["Trainer"])) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Trainer role required",
        data: {},
      });
    }

    const { sessionId } = req.params;
    const { records } = req.body;

    const sheet = await Attendance.findOne({ sessionId, trainerId: req.user.id });

    if (!sheet) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Attendance sheet not found",
        data: {},
      });
    }

    if (sheet.finalized) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Attendance already finalized",
        data: {},
      });
    }

    const now = new Date();

    const indexById = new Map(sheet.records.map((r, i) => [String(r.traineeId), i]));

    for (const r of records || []) {
      const key = String(r.traineeId);
      const entry = {
        traineeId: r.traineeId,
        status: r.status,
        note: r.note || "",
        markedAt: now,
      };

      if (indexById.has(key)) {
        sheet.records[indexById.get(key)] = entry;
      } else {
        sheet.records.push(entry);
        indexById.set(key, sheet.records.length - 1);
      }
    }

    await sheet.save();

    const { _id: sheetId, ...rest } = sheet.toObject();
    const response = { sheetId, ...rest };

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Attendance marked successfully",
      data: response,
    });
  } catch (err) {
    return errorResponse(res, err);
  }
};

exports.finalize = async (req, res) => {
  try {
    if (!requireRoleLocal(req, ["Trainer"])) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Trainer role required",
        data: {},
      });
    }

    const { sessionId } = req.params;

    const session = await TrainingSession.findOne({
      _id: sessionId,
      trainerId: req.user.id,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Session not found",
        data: {},
      });
    }

    const sheet = await Attendance.findOne({ sessionId, trainerId: req.user.id });

    if (!sheet) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Attendance sheet not found",
        data: {},
      });
    }

    if (sheet.finalized) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Already finalized",
        data: {},
      });
    }

    const presentSet = new Set(
      sheet.records
        .filter((r) => r.status === "Present" || r.status === "Late")
        .map((r) => String(r.traineeId))
    );

    const bookingFilter = { sessionId: session._id, status: "booked" };
    const bookings = await Booking.find(bookingFilter);

    const updates = bookings.map((b) => ({
      updateOne: {
        filter: { _id: b._id },
        update: {
          $set: {
            status: presentSet.has(String(b.traineeId)) ? "attended" : "missed",
          },
        },
      },
    }));

    if (updates.length) await Booking.bulkWrite(updates);

    sheet.finalized = true;
    await sheet.save();

    if (session.status !== "completed") {
      session.status = "completed";
      await session.save();
    }

    const { _id: sheetId, ...rest } = sheet.toObject();
    const response = { sheetId, ...rest, finalized: true };

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Attendance finalized successfully",
      data: response,
    });
  } catch (err) {
    return errorResponse(res, err);
  }
};
