const ScormProgress = require("../models/ScormProgress");

exports.getAllGrading = async (req, res) => {
  try {
    const progressRecords = await ScormProgress.find()
      .populate("userId", "firstName lastName")
      .populate("courseId", "title");

    const grouped = {};

    progressRecords.forEach((record) => {
      const key = `${record.userId._id}_${record.courseId._id}`;
      if (!grouped[key]) {
        grouped[key] = {
          userName: `${record.userId.firstName} ${record.userId.lastName}`,
          userId: record.userId._id,
          courseName: record.courseId.title,
          courseId: record.courseId._id,
          completedModules: 0,
          totalModules: 0,
        };
      }

      const scormData = record.scormData;
      const isCompleted = scormData?.["cmi.core.lesson_status"] === "completed";

      grouped[key].totalModules += 1;
      if (isCompleted) grouped[key].completedModules += 1;
    });

    const gradingData = Object.values(grouped).map((entry) => {
      const progress = entry.totalModules
        ? Math.round((entry.completedModules / entry.totalModules) * 100)
        : 0;

      return {
        userName: entry.userName,
        userId: entry.userId,
        courseName: entry.courseName,
        courseId: entry.courseId,
        progress, 
      };
    });

    res.status(200).json(gradingData);
  } catch (error) {
    console.error("Error in getAllGrading:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
