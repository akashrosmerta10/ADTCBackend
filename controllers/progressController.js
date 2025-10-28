const TraineeProgress = require("../models/TraineeProgress");
const TrainingSession = require("../models/TrainingSession");
const Attendance = require("../models/Attendance");
const Booking = require("../models/Booking");
const Evaluation = require("../models/Evaluation");
const errorResponse = require("../utils/errorResponse");

const requireRoleLocal = (req, roles) =>
  Array.isArray(req.user?.roles) && roles.some((r) => req.user.roles.includes(r));

exports.getMe = async (req, res) => {
  try {
    if (!requireRoleLocal(req, ["Learner"])) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Learner role required.",
        data: null,
      });
    }

    const doc = await TraineeProgress.findOne({ userId: req.user.id });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Trainee progress fetched successfully.",
      data: doc || null,
    });
  } catch (err) {
    return errorResponse(res, err);
  }
};

exports.recomputeForUser = async (req, res) => {
  try {
    if (!requireRoleLocal(req, ["Learner"])) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Learner role required.",
        data: null,
      });
    }

    const paramId = String(req.params.userId || "");
    if (paramId !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Can only recompute own progress.",
        data: null,
      });
    }

    const userId = req.user.id;

    const bookings = await Booking.find({
      traineeId: userId,
      status: { $in: ["booked", "attended", "missed"] },
    }).select("sessionId status");

    const sessionIds = bookings.map((b) => b.sessionId);
    const sessions = await TrainingSession.find({
      _id: { $in: sessionIds },
    }).select("trainingType mode startAt endAt");

    const attendanceSheet = await Attendance.find({
      sessionId: { $in: sessionIds },
    }).select("sessionId records");

    const attendedSet = new Set();
    const scheduledSet = new Set(sessionIds.map(String));

    for (const sh of attendanceSheet) {
      const present = sh.records?.some(
        (r) =>
          String(r.traineeId) === String(userId) &&
          (r.status === "present" || r.status === "late")
      );
      if (present) attendedSet.add(String(sh.sessionId));
    }

    const diffMin = (a, b) =>
      Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
    let theoryMin = 0,
      practicalMin = 0;
    const modeHours = { simulator: 0, road_track: 0, classroom: 0 };
    const modeSessions = { simulator: 0, road_track: 0, classroom: 0 };

    for (const s of sessions) {
      const mins = diffMin(s.startAt, s.endAt);
      if (attendedSet.has(String(s._id))) {
        if (s.trainingType === "theory") theoryMin += mins;
        else practicalMin += mins;

        if (s.mode in modeHours) modeHours[s.mode] += mins;
        if (s.mode in modeSessions) modeSessions[s.mode] += 1;
      }
    }

    const presentCount = attendedSet.size;
    const totalScheduled = scheduledSet.size;
    const attendanceRatePct = totalScheduled
      ? Math.round((presentCount / totalScheduled) * 100)
      : 0;

    const evals = await Evaluation.find({ traineeId: userId }).select(
      "overall.percent"
    );
    const overallPct = evals.length
      ? Math.round(
          evals.reduce((s, e) => s + (e.overall?.percent || 0), 0) / evals.length
        )
      : 0;

    const band =
      overallPct >= 90
        ? "A+"
        : overallPct >= 80
        ? "A"
        : overallPct >= 70
        ? "B+"
        : overallPct >= 60
        ? "B"
        : overallPct >= 50
        ? "C"
        : overallPct > 0
        ? "D"
        : "F";

    const totalTarget = 40 * 60; // minutes
    const earned = theoryMin + practicalMin;
    const completionPct = Math.min(
      100,
      Math.round((earned / totalTarget) * 100)
    );

    const upsert = await TraineeProgress.findOneAndUpdate(
      { userId },
      {
        $set: {
          theoryHours: Math.round(theoryMin / 60),
          practicalHours: Math.round(practicalMin / 60),
          totalHoursTarget: Math.round(totalTarget / 60),
          completionPct,
          attendanceRatePct,
          overallGradePercent: overallPct,
          overallGradeBand: band,
          modeBreakdown: {
            simulator: {
              hours: Math.round(modeHours.simulator / 60),
              sessions: modeSessions.simulator,
            },
            roadTrack: {
              hours: Math.round(modeHours.road_track / 60),
              sessions: modeSessions.road_track,
            },
            classroom: {
              hours: Math.round(modeHours.classroom / 60),
              sessions: modeSessions.classroom,
            },
          },
          lastUpdatedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Trainee progress recomputed successfully.",
      data: upsert,
    });
  } catch (err) {
    return errorResponse(res, err);
  }
};
