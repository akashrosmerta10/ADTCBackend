const mongoose = require("mongoose");
const ScormProgress = require("../models/ScormProgress");
const CourseProgress = require("../models/CourseProgress");
const Course = require("../models/Course");
const errorResponse = require("../utils/errorResponse");
const { logUserActivity } = require("../utils/activityLogger");

async function enrichModulesWithNames(courseProgress) {
  if (!courseProgress) return courseProgress;

  const courseId = courseProgress.courseId.toString();
  const course = await Course.findById(courseId, { modules: 1, name: 1 }).lean();
  if (!course) return courseProgress;

  const moduleMap = new Map();
  (course.modules || []).forEach((m) => {
    moduleMap.set(m._id.toString(), m.name || m.title || "");
  });

  courseProgress.modules = courseProgress.modules.map((mod) => ({
    ...mod,
    moduleName: moduleMap.get(mod.moduleId.toString()) || "",
  }));

  courseProgress.courseName = course.name || "";

  return courseProgress;
}

exports.saveProgress = async (req, res) => {
  const {
    courseId,
    moduleId,
    lastPosition,
    lessonLocation,
    lessonStatus,
    scormData,
    videoDuration,
  } = req.body;
  const userId = req.user.id;

  try {
    if (!courseId || !moduleId) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "courseId and moduleId are required",
      });
    }

    const numericDuration = Number.isFinite(videoDuration) ? Number(videoDuration) : 0;
    const updatedScorm = await ScormProgress.findOneAndUpdate(
      { userId, courseId, moduleId },
      {
        $set: {
          lessonLocation: lessonLocation ?? "",
          lastPosition: lastPosition ?? "",
          lessonStatus: (lessonStatus || "incomplete"),
          scormData: scormData || {},
          videoDuration: numericDuration > 0 ? numericDuration : 0,
          lastUpdatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    let courseProgress = await CourseProgress.findOne({ userId, courseId });
    if (!courseProgress) {
      const course = await Course.findById(courseId, { modules: 1 }).lean();
      const modulesSeed = (course?.modules || []).map((m) => ({
        moduleId: m._id,
        progress: 0,
        lastUpdatedAt: new Date(),
      }));
      courseProgress = await CourseProgress.create({
        userId,
        courseId,
        modules: modulesSeed,
        overallProgress: 0,
        lastComputedAt: new Date(),
      });
    }

    const existingEntry = courseProgress.modules.find(
      (m) => String(m.moduleId) === String(moduleId)
    );
    const existingProgress = Number(existingEntry?.progress || 0);

    const hasValidDuration = Number.isFinite(numericDuration) && numericDuration > 0;
    const loc = (typeof lastPosition === "string" ? parseFloat(lastPosition) : Number(lastPosition)) || 0;

    let computedProgress = existingProgress;
    if (hasValidDuration && loc >= 0) {
      const raw = (loc / numericDuration) * 100;

      let normalized = Math.min(100, Math.max(0, Math.round(raw)));

      if (normalized >= 95) {
        normalized = 100;
      }

      computedProgress = normalized;

    } else {
      computedProgress = existingProgress;
    }

    const newModuleProgress = Math.max(existingProgress, computedProgress);

    let updatedCourse = await CourseProgress.findOneAndUpdate(
      { userId, courseId, "modules.moduleId": moduleId },
      {
        $set: {
          "modules.$.progress": newModuleProgress,
          "modules.$.lastUpdatedAt": new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updatedCourse) {
      updatedCourse = await CourseProgress.findOneAndUpdate(
        { userId, courseId },
        {
          $push: {
            modules: {
              moduleId,
              progress: newModuleProgress,
              lastUpdatedAt: new Date(),
            },
          },
        },
        { new: true }
      ).lean();
    }

    const totalModules = updatedCourse.modules.length || 1;
    const sumPercent = updatedCourse.modules.reduce((acc, m) => acc + (Number(m.progress) || 0), 0);
    const overallProgress = Math.round(sumPercent / totalModules);

    await CourseProgress.findByIdAndUpdate(updatedCourse._id, {
      $set: { overallProgress, lastComputedAt: new Date() },
    });

    const enrichedCourseProgress = await enrichModulesWithNames(updatedCourse);

    // await logUserActivity({
    //   userId,
    //   activityType: "SCORM_PROGRESS_SAVED",
    //   req,
    //   metadata: {
    //     courseId,
    //     moduleId,
    //     newModuleProgress,
    //     overallProgress,
    //     lessonStatus,
    //   },
    // });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "SCORM and course progress updated based on video watched %",
      data: {
        scorm: updatedScorm,
        courseProgress: enrichedCourseProgress,
      },
    });
  } catch (error) {
    console.error("Error in saveProgress:", error);
    return errorResponse(res, error);
  }
};

exports.getProgress = async (req, res) => {
  const { courseId, moduleId } = req.query;
  const userId = req.user.id;

  try {
    const query = {
      userId: mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId,
      courseId: mongoose.Types.ObjectId.isValid(courseId)
        ? new mongoose.Types.ObjectId(courseId)
        : courseId,
      moduleId: mongoose.Types.ObjectId.isValid(moduleId)
        ? new mongoose.Types.ObjectId(moduleId)
        : moduleId,
    };

    const progress = await ScormProgress.findOne(query);

    if (!progress) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "No progress found for this user/module/course",
      });
    }

    // await logUserActivity({
    //   userId,
    //   activityType: "SCORM_PROGRESS_VIEWED",
    //   req,
    //   metadata: {
    //     courseId,
    //     moduleId,
    //   },
    // });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Progress fetched successfully",
      progress,
    });
  } catch (error) {
    console.error("Error in getProgress:", error);
    return errorResponse(res, error);
  }
};
