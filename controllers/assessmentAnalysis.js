const AssessmentSubmission = require("../models/assessmentSubmission");
const User = require("../models/User");
const Course = require("../models/Course");


exports.getDashboardStats = async (req, res) => {
  try {
    const userRole = req.user?.roles || [];
    const allowedRoles = ["Admin", "Trainer"];
    if (!allowedRoles.some(r => userRole.includes(r))) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const totalTrainees = await User.countDocuments({ roles: { $in: ["Learner", "User"] } });

    const courses = await Course.find({}, { modules: 1 }).lean();
    const activeModules = courses.reduce(
      (sum, course) => sum + (course.modules ? course.modules.length : 0),
      0
    );

    const assessmentsCompleted = await AssessmentSubmission.countDocuments();

    const avg = await AssessmentSubmission.aggregate([
      { $match: { percent: { $gte: 0 } } },
      { $group: { _id: null, avgPercent: { $avg: "$percent" } } },
    ]);
    const averageScore = avg.length ? Math.round(avg[0].avgPercent) : 0;

    return res.json({
      success: true,
      statusCode: 200,
      data: {
        totalTrainees,
        activeModules,
        assessmentsCompleted,
        averageScore,
      },
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

    const trainees = await User.find(query)
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    const courses = await Course.find({}, { modules: 1 }).lean();
    const courseMap = {};
    courses.forEach(course => {
      courseMap[course._id.toString()] = course.modules || [];
    });

    const traineeIds = trainees.map(t => t._id);
    const agg = await AssessmentSubmission.aggregate([
      { $match: { userId: { $in: traineeIds } } },
      { $sort: { moduleId: 1, submittedAt: -1 } },
      {
        $group: {
          _id: { userId: "$userId", moduleId: "$moduleId" },
          submission: { $first: "$$ROOT" },
        },
      },
      {
        $group: {
          _id: "$_id.userId",
          modulesCompleted: { $sum: 1 },
          averageScore: { $avg: "$submission.percent" },
          totalTimeSeconds: { $sum: "$submission.timeSeconds" },
        },
      },
    ]);

    const aggByUserId = {};
    agg.forEach(row => (aggByUserId[row._id.toString()] = row));

    const data = trainees.map(t => {
      let userCourseModules = 0;
      if (Array.isArray(t.coursesEnrolled) && t.coursesEnrolled.length > 0) {
        t.coursesEnrolled.forEach(courseId => {
          const modules = courseMap[courseId.toString()];
          if (modules) userCourseModules += modules.length;
        });
      }

      const userName =
        t.firstName || t.lastName
          ? `${t.firstName || ""} ${t.lastName || ""}`.trim()
          : t.email;

      const stats = aggByUserId[t._id.toString()] || {};
      const progress =
        userCourseModules > 0
          ? Math.round(((stats.modulesCompleted || 0) / userCourseModules) * 100)
          : 0;

      return {
        name: userName,
        email: t.email,
        userId: t._id,
        progress,
        modulesCompleted: stats.modulesCompleted || 0,
        totalModules: userCourseModules,
        avgScore: Math.round(stats.averageScore || 0),
        totalTime: stats.totalTimeSeconds
          ? `${Math.round(stats.totalTimeSeconds / 60)} min`
          : "0 min",
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
