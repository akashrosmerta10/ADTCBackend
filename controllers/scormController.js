const mongoose = require("mongoose");
const ScormProgress = require("../models/ScormProgress");
const CourseProgress = require("../models/CourseProgress");
const Course = require("../models/Course");
const errorResponse = require("../utils/errorResponse");

// ---------------- SAVE PROGRESS ----------------
exports.saveProgress = async (req, res) => {
  const {
    courseId,
    moduleId,
    lastPosition,
    lessonLocation,   // watched duration in seconds
    lessonStatus,     // status string
    scormData,
    videoDuration     // total duration in seconds
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

    // Save/update SCORM progress (lessonLocation and videoDuration)
    const updatedScorm = await ScormProgress.findOneAndUpdate(
      { userId, courseId, moduleId },
      {
        $set: {
          lessonLocation: lessonLocation || "",
          lastPosition: lastPosition || "",
          lessonStatus: lessonStatus || "incomplete",
          scormData: scormData || {},
          videoDuration: typeof videoDuration === 'number' ? videoDuration : 0,
          lastUpdatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    // Ensure CourseProgress doc exists
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

    // Calculate % watched if videoDuration > 0
    let newModuleProgress = 0;
    if (videoDuration > 0 && lessonLocation !== undefined && lessonLocation !== null) {
      // Convert lessonLocation to number in case string
      const watched = typeof lessonLocation === "string" ? parseInt(lessonLocation, 10) : lessonLocation;
      newModuleProgress = Math.min(100, Math.floor((watched / videoDuration) * 100));
    } else {
      // Fallback: use lessonStatus
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

    // Update or insert module progress in CourseProgress
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

    // Recalculate overall progress
    const totalModules = updatedCourse.modules.length || 1;
    const completedModules = updatedCourse.modules.filter(
      (m) => (m.progress || 0) >= 100
    ).length;
    const overallProgress = Math.floor((completedModules / totalModules) * 100);

    await CourseProgress.findByIdAndUpdate(updatedCourse._id, {
      $set: { overallProgress, lastComputedAt: new Date() },
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


// ---------------- GET PROGRESS ----------------
exports.getProgress = async (req, res) => {
  const { courseId, moduleId } = req.query;
  const userId = req.user.id;

  try {
    // ✅ Ensure valid ObjectIds (avoids cast errors)
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
