const mongoose = require("mongoose");
const ScormProgress = require("../models/ScormProgress");
const CourseProgress = require("../models/CourseProgress");
const Course = require("../models/Course");
const errorResponse = require("../utils/errorResponse");
const { logUserActivity } = require("../utils/activityLogger");

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

    const updatedScorm = await ScormProgress.findOneAndUpdate(
      { userId, courseId, moduleId },
      {
        $set: {
          lessonLocation: lessonLocation || "",
          lastPosition: lastPosition || "",
          lessonStatus: lessonStatus || "incomplete",
          scormData: scormData || {},
          videoDuration: typeof videoDuration === "number" ? videoDuration : 0,
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

    let newModuleProgress = 0;
    if (videoDuration > 0 && lessonLocation !== undefined && lessonLocation !== null) {
      const watched =
        typeof lessonLocation === "string"
          ? parseInt(lessonLocation, 10)
          : lessonLocation;
      newModuleProgress = Math.min(100, Math.floor((watched / videoDuration) * 100));
    } else {
      switch (lessonStatus) {
        case "completed":
        case "passed":
          newModuleProgress = 100;
          break;
        case "incomplete":
        case "failed":
          newModuleProgress = 50;
          break;
        default:
          newModuleProgress = 0;
      }
    }

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
    const completedModules = updatedCourse.modules.filter(
      (m) => (m.progress || 0) >= 100
    ).length;
    const overallProgress = Math.floor((completedModules / totalModules) * 100);

    await CourseProgress.findByIdAndUpdate(updatedCourse._id, {
      $set: { overallProgress, lastComputedAt: new Date() },
    });

    await logUserActivity({
      userId,
      activityType: "SCORM_PROGRESS_SAVED",
      req,
      metadata: {
        courseId,
        moduleId,
        newModuleProgress,
        overallProgress,
        lessonStatus,
      },
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "SCORM and course progress updated based on video watched %",
      data: {
        scorm: updatedScorm,
        courseProgress: {
          ...updatedCourse,
          overallProgress,
        },
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

    await logUserActivity({
      userId,
      activityType: "SCORM_PROGRESS_VIEWED",
      req,
      metadata: {
        courseId,
        moduleId,
      },
    });

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
