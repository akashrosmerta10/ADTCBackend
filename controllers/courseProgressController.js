const mongoose = require("mongoose");
const CourseProgress = require("../models/CourseProgress");
const Course = require("../models/Course")
const errorResponse = require("../utils/errorResponse");
const { logUserActivity } = require("../utils/activityLogger");

exports.createProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ success: false, statusCode: 400, message: "courseId required" });

    const existing = await CourseProgress.findOne({ userId, courseId });
    if (existing) return res.status(200).json(existing);

    const course = await Course.findById(courseId, { modules: 1 }).lean();
    const modulesSeed = (course?.modules || []).map(m => ({
      moduleId: m._id,
      progress: 0,
      lastUpdatedAt: new Date(),
    }));

    const data = await CourseProgress.findOneAndUpdate(
      { userId, courseId },
      {
        $setOnInsert: {
          userId,
          courseId,
          modules: modulesSeed,
          overallProgress: 0,
          lastComputedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    await logUserActivity({
      userId,
      activityType: "COURSE_PROGRESS_INITIALIZED",
      metadata: {
        courseId,
        message: "Course progress initialized or resumed",
      },
      req,
    });

    return res.status(200).json({ success: true, statusCode: 200, message: "progress updated successfully", data });
  } catch (error) {
    return errorResponse(res, error)
  }
}

exports.getCourseProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;

    let data = await CourseProgress.findOne({ userId, courseId });
    if (data) {
      await logUserActivity({
        userId,
        activityType: "OTHER",
        metadata: {
          courseId,
          message: "Viewed course progress",
        },
        req,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "Progress fetched",
        data,
      });
    }

    const course = await Course.findById(courseId, { modules: 1 }).lean();
    if (!course) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Course not found",
      });
    }

    const modulesSeed = (course.modules || []).map((m) => ({
      moduleId: m._id,
      progress: 0,
      lastUpdatedAt: new Date(),
    }));

    data = await CourseProgress.findOneAndUpdate(
      { userId, courseId },
      {
        $setOnInsert: {
          userId,
          courseId,
          modules: modulesSeed,
          overallProgress: 0,
          lastComputedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    await logUserActivity({
      userId,
      activityType: "OTHER",
      metadata: { courseId, message: "Course progress initialized" },
      req,
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Progress initialized",
      data,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.UpdateModuleProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId, moduleId, progress } = req.body;

    if (!courseId || !moduleId) {
      return res.status(400).json({ success: false, statusCode: 400, message: "courseId and moduleId required" });
    }

    if (typeof progress !== "number") {
      return res.status(400).json({ success: false, statusCode: 400, message: "progress required" });
    }

    if (progress < 0 || progress > 100) {
      return res.status(400).json({ success: false, statusCode: 400, message: "progress must be 0-100" });
    }

    await CourseProgress.findOneAndUpdate(
      { userId: userId, courseId: courseId },
      { $setOnInsert: { userId: userId, courseId: courseId, modules: [], overallProgress: 0 } },
      { upsert: true, new: false }
    );

    const updated = await CourseProgress.findOneAndUpdate(
      { userId: userId, courseId: courseId, "modules.moduleId": moduleId },
      {
        $set: {
          "modules.$.progress": progress,
          "modules.$.lastUpdatedAt": new Date(),
        },
      },
      { new: true }
    ).lean();

    let after = updated;
    if (!after) {
      after = await CourseProgress.findOneAndUpdate(
        { userId: userId, courseId: courseId },
        {
          $push: {
            modules: { moduleId: moduleId, progress, lastUpdatedAt: new Date() },
          },
        },
        { new: true }
      ).lean();
    }

    const total = after.modules.length || 1;
    const sum = after.modules.reduce((acc, m) => acc + (Number(m.progress) || 0), 0);
    const overall = Math.round(sum / total);

    const data = await CourseProgress.findOneAndUpdate(
      { _id: after._id },
      { $set: { overallProgress: overall, lastComputedAt: new Date() } },
      { new: true }
    );

    await logUserActivity({
      userId,
      activityType: "COURSE_COMPLETED",
      metadata: {
        courseId,
        moduleId,
        progress,
        overallProgress: data.overallProgress,
        message:
          data.overallProgress === 100
            ? "Course fully completed"
            : "Module progress updated",
      },
      req,
    });

    return res.status(200).json({ success: true, statusCode: 200, message: "Module progress updated", data });

  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.getAverageProgressPerUser = async (req, res) => {
  try {
    const { roles } = req.user;

    const allowedRoles = ["Admin", "Trainer"];
    const hasAccess = roles?.some((role) => allowedRoles.includes(role));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message:
          "Access denied. Only admins and trainers can view per-user course progress.",
      });
    }

    const results = await CourseProgress.aggregate([
      {
        $group: {
          _id: "$userId",
          averageProgress: { $avg: "$overallProgress" },
          coursesCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          averageProgress: { $round: ["$averageProgress", 0] },
          coursesCount: 1,
        },
      },
      {
        $sort: { averageProgress: -1 },
      },
    ]);

    await logUserActivity({
      userId: req.user.id,
      activityType: "OTHER",
      metadata: {
        role: req.user.roles,
        action: "Viewed average progress per user",
        resultsCount: results.length,
      },
      req,
    });

    if (!results.length) {
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "No course progress data found.",
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Average course progress per user fetched successfully.",
      data: results,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};