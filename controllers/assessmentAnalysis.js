const AssessmentSubmission = require("../models/AssessmentSubmission");
const User = require("../models/User");
const Course = require("../models/Course");
const mongoose = require("mongoose");

exports.getDashboardStats = async (req, res) => {
  try {
    const userRole = req.user?.roles || [];
    const allowedRoles = ["Admin", "Trainer"];
    if (!allowedRoles.some(r => userRole.includes(r))) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const totalTrainees = await User.countDocuments({ roles: { $in: ["Learner", "User"] } });

    const courses = await Course.find({}, { modules: 1 }).lean();
    const activeModules = courses.reduce((sum, c) => sum + (Array.isArray(c.modules) ? c.modules.length : 0), 0);

    const assessmentsCompleted = await AssessmentSubmission.countDocuments({ status: "submitted" });

    const avgAgg = await AssessmentSubmission.aggregate([
      { $match: { status: "submitted" } },
      { $sort: { userId: 1, moduleId: 1, submittedAt: -1, createdAt: -1, attemptNumber: -1 } },
      { $group: { _id: { userId: "$userId", moduleId: "$moduleId" }, latest: { $first: "$$ROOT" } } },
      { $group: { _id: null, avgPercent: { $avg: { $ifNull: ["$latest.percent", 0] } } } },
    ]);
    const averageScore = avgAgg.length ? Math.round(avgAgg[0].avgPercent) : 0;

    return res.json({
      success: true,
      statusCode: 200,
      data: { totalTrainees, activeModules, assessmentsCompleted, averageScore },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTraineeProgress = async (req, res) => {
  try {
    const userRole = req.user?.roles || [];
    const allowedRoles = ["Admin", "Trainer"];
    if (!allowedRoles.some(r => userRole.includes(r))) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { limit = 10, skip = 0, search = "" } = req.query;

    const query = { roles: "Learner" };
    if (search && search.trim() !== "") {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const totalCount = await User.countDocuments(query);

    const trainees = await User.find(query, {
      firstName: 1,
      lastName: 1,
      email: 1,
      purchasedCourses: 1,
      completedCourse: 1,
    })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    const traineeIds = trainees.map(t => t._id);

    const latestFinalByUserCourse = await AssessmentSubmission.aggregate([
      { $match: { userId: { $in: traineeIds }, status: "submitted" } },
      {
        $addFields: {
          moduleIdStr: {
            $cond: [
              { $eq: [{ $type: "$moduleId" }, "objectId"] },
              { $toString: "$moduleId" },
              { $toString: "$moduleId" },
            ],
          },
          courseIdStr: {
            $cond: [
              { $eq: [{ $type: "$courseId" }, "objectId"] },
              { $toString: "$courseId" },
              { $toString: "$courseId" },
            ],
          },
        },
      },
      { $match: { moduleIdStr: "final" } },
      { $sort: { submittedAt: -1, createdAt: -1, attemptNumber: -1 } },
      { $group: { _id: { userId: "$userId", courseId: "$courseIdStr" }, latest: { $first: "$$ROOT" } } },
      {
        $project: {
          userId: "$_id.userId",
          courseId: "$_id.courseId",
          percent: { $ifNull: ["$latest.percent", 0] },
          maxPercent: { $ifNull: ["$latest.maxPercent", 0] },
          passed: {
            $gte: [
              {
                $cond: [
                  { $gt: ["$latest.maxPercent", null] },
                  "$latest.maxPercent",
                  { $ifNull: ["$latest.percent", 0] },
                ],
              },
              60,
            ],
          },
        },
      },
    ]);

    const completedCoursesByUser = new Map();
    for (const r of latestFinalByUserCourse) {
      if (r.passed) {
        const uid = String(r.userId);
        const cid = String(r.courseId);
        let set = completedCoursesByUser.get(uid);
        if (!set) { set = new Set(); completedCoursesByUser.set(uid, set); }
        set.add(cid);
      }
    }

    const perUserSummary = await AssessmentSubmission.aggregate([
      { $match: { userId: { $in: traineeIds }, status: "submitted" } },
      {
        $addFields: {
          moduleIdStr: {
            $cond: [
              { $eq: [{ $type: "$moduleId" }, "objectId"] },
              { $toString: "$moduleId" },
              { $toString: "$moduleId" },
            ],
          },
        },
      },
      { $match: { moduleIdStr: { $ne: "final" } } },
      { $sort: { submittedAt: -1, createdAt: -1, attemptNumber: -1 } },
      { $group: { _id: { userId: "$userId", moduleId: "$moduleIdStr" }, latest: { $first: "$$ROOT" } } },
      {
        $project: {
          userId: "$_id.userId",
          percent: { $ifNull: ["$latest.percent", 0] },
          timeSeconds: { $ifNull: ["$latest.timeSeconds", 0] },
        },
      },
      {
        $group: {
          _id: "$userId",
          averageScore: { $avg: "$percent" },
          totalTimeSeconds: { $sum: "$timeSeconds" },
        },
      },
    ]);
    const summaryByUserId = {};
    perUserSummary.forEach(r => { summaryByUserId[String(r._id)] = r; });

    const latestByUser = await AssessmentSubmission.aggregate([
      { $match: { userId: { $in: traineeIds }, status: "submitted" } },
      { $sort: { submittedAt: -1, createdAt: -1 } },
      { $group: { _id: "$userId", latest: { $first: "$$ROOT" } } },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          lastAssessmentAt: "$latest.submittedAt",
          lastPercent: { $ifNull: ["$latest.percent", 0] },
        },
      },
    ]);
    const latestMap = new Map(latestByUser.map(r => [String(r.userId), r]));

    const data = trainees.map(t => {
      const uid = String(t._id);
      const purchased = Array.isArray(t.purchasedCourses) ? t.purchasedCourses.length : 0;

      let completed = Number.isFinite(t.completedCourse) ? Number(t.completedCourse) : 0;

      if (purchased > 0 && completed > purchased) completed = purchased;

      if (completed === 0) {
        const set = completedCoursesByUser.get(uid);
        if (set) completed = Math.min(purchased, set.size);
      }

      const progress = purchased > 0 ? Math.round((completed / purchased) * 100) : 0;

      const userName =
        t.firstName || t.lastName ? `${t.firstName || ""} ${t.lastName || ""}`.trim() : t.email;

      const latest = latestMap.get(uid);
      const lastAssessment = latest?.lastAssessmentAt ? new Date(latest.lastAssessmentAt).toLocaleString() : "-";
      const score = Number.isFinite(latest?.lastPercent) ? Math.round(latest.lastPercent) : undefined;

      const summary = summaryByUserId[uid] || {};
      const avgScore = Math.round(summary.averageScore || 0);
      const totalTime =
        summary.totalTimeSeconds ? `${Math.round(summary.totalTimeSeconds / 60)} min` : "0 min";

      return {
        name: userName,
        email: t.email,
        userId: t._id,
        course: purchased > 0 ? `${purchased}` : "-",
        progress,
        coursesCompleted: completed,
        coursesPurchased: purchased,
        avgScore,
        totalTime,
        lastAssessment,
        score,
      };
    });

    return res.json({
      success: true,
      statusCode: 200,
      pagination: {
        totalCount,
        limit: Number(limit),
        skip: Number(skip),
        totalPages: Math.ceil(totalCount / limit),
      },
      data,
    });
  } catch (error) {
    console.error("Error in getTraineeProgress:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
