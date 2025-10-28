const mongoose = require("mongoose");
const AssessmentSubmission = require("../models/assessmentSubmission");
const errorResponse = require("../utils/errorResponse");
const Course = require("../models/Course"); 


async function getNextAttemptNumber({ userId, courseId, moduleId }, session) {
  const latest = await AssessmentSubmission
    .findOne({ userId, courseId, moduleId })
    .sort({ attemptNumber: -1 })
    .select({ attemptNumber: 1 })
    .session(session || null);

  return (latest?.attemptNumber || 0) + 1;
}

function normalizePayload(body) {
  const required = ["courseId", "moduleId", "attemptId", "startedAt", "submittedAt", "timeSeconds"];
  for (const k of required) {
    if (body[k] == null) throw new Error(`Missing field: ${k}`);
  }

  const doc = {
    userId: body.userId,
    courseId: body.courseId,
    moduleId: body.moduleId,
    attemptId: String(body.attemptId),
    startedAt: new Date(body.startedAt),
    submittedAt: new Date(body.submittedAt),
    timeSeconds: Number(body.timeSeconds) || 0,

    questions: Array.isArray(body.questions)
      ? body.questions.map((q) => ({
          questionId: q.questionId,
          type: q.type === "tf" ? "tf" : "mcq",
          score: Number(q.score) || 0,
          userAnswer: q.userAnswer,
          correctAnswer: q.correctAnswer,
          isCorrect: Boolean(q.isCorrect),
          text: q.text,
          choices: Array.isArray(q.choices)
            ? q.choices.map((c) => ({ id: String(c.id), text: String(c.text) }))
            : [],
        }))
      : [],

    scoreEarned: Number(body.scoreEarned) || 0,
    scoreTotal: Number(body.scoreTotal) || 0,
    correctCount: Number(body.correctCount) || 0,
    incorrectCount: Number(body.incorrectCount) || 0,
    skippedCount: Number(body.skippedCount) || 0,

    breakdownByType: body.breakdownByType || {},
    percent: typeof body.percent === "number" ? body.percent : undefined,
    grade: body.grade,

    snapshotModuleName: body.snapshotModuleName,
  };

  return doc;
}

exports.upsertSubmission = async (req, res) => {
  try {
    const payload = normalizePayload(req.body);

    if (!payload.userId && req.user?._id) payload.userId = req.user._id;

    const idsToCheck = ["userId", "courseId", "moduleId"];
    for (const k of idsToCheck) {
      if (payload[k] && !mongoose.isValidObjectId(payload[k])) {
        return res.status(400).json({ success: false, statusCode: 400, message: `Invalid ${k}`, data: null });
      }
    }

    const existing = await AssessmentSubmission.findOne({ attemptId: payload.attemptId }).lean();

    if (existing) {
      const updated = await AssessmentSubmission.findOneAndUpdate(
        { attemptId: payload.attemptId },
        {
          $set: {
            submittedAt: payload.submittedAt,
            timeSeconds: payload.timeSeconds,
            questions: payload.questions,
            scoreEarned: payload.scoreEarned,
            scoreTotal: payload.scoreTotal,
            correctCount: payload.correctCount,
            incorrectCount: payload.incorrectCount,
            skippedCount: payload.skippedCount,
            breakdownByType: payload.breakdownByType,
            percent: payload.percent,
            grade: payload.grade,
            snapshotModuleName: payload.snapshotModuleName
          }
        },
        { new: true, upsert: false }
      );
      return res.status(201).json({ success: true, statusCode: 201, message: "submission upserted successfully", data: updated });
    }

    const maxRetries = 3;
    let lastErr = null;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const attemptNumber = await getNextAttemptNumber(
              { userId: payload.userId, courseId: payload.courseId, moduleId: payload.moduleId },
              session
            );

            await AssessmentSubmission.findOneAndUpdate(
              { attemptId: payload.attemptId },
              {
                $setOnInsert: {
                  userId: payload.userId,
                  courseId: payload.courseId,
                  moduleId: payload.moduleId,
                  attemptId: payload.attemptId,
                  attemptNumber,
                  startedAt: payload.startedAt,
                  sequence: payload.sequence ?? 1,
                  snapshotModuleName: payload.snapshotModuleName
                },
                $set: {
                  submittedAt: payload.submittedAt,
                  timeSeconds: payload.timeSeconds,
                  questions: payload.questions,
                  scoreEarned: payload.scoreEarned,
                  scoreTotal: payload.scoreTotal,
                  correctCount: payload.correctCount,
                  incorrectCount: payload.incorrectCount,
                  skippedCount: payload.skippedCount,
                  breakdownByType: payload.breakdownByType,
                  percent: payload.percent,
                  grade: payload.grade
                }
              },
              { new: true, upsert: true, setDefaultsOnInsert: true, session }
            );
          });
        } finally {
          session.endSession();
        }

        const doc = await AssessmentSubmission.findOne({ attemptId: payload.attemptId });
        return res.status(201).json({ success: true, statusCode: 201, message: "submission upserted successfully", data: doc });
      } catch (err) {
        lastErr = err;
        if (err && err.code === 11000) {
          await new Promise((r) => setTimeout(r, 10 + Math.floor(Math.random() * 20)));
          continue;
        }
        throw err;
      }
    }

    if (lastErr) throw lastErr;
    const doc = await AssessmentSubmission.findOne({ attemptId: payload.attemptId });
    return res.status(201).json({ success: true, statusCode: 201, message: "submission upserted successfully", data: doc });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.getSubmissionByAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const doc = await AssessmentSubmission.findOne({ attemptId });
    if (!doc) return res.status(404).json({ success: false, statusCode: 400, message: "Not found", data: null });
    return res.status(200).json({ success: true, statusCode: 200, message: "submission fetched successfully", data: doc });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.listSubmissions = async (req, res) => {
  try {
    const { userId, courseId, moduleId, limit = 50, skip = 0 } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (courseId) filter.courseId = courseId;
    if (moduleId) filter.moduleId = moduleId;

    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const sk = Math.max(parseInt(skip, 10) || 0, 0);

    const [items, total] = await Promise.all([
      AssessmentSubmission.find(filter).sort({ createdAt: -1 }).skip(sk).limit(lim).lean(),
      AssessmentSubmission.countDocuments(filter),
    ]);

    return res.json({ total, items });
  } catch (error) {
    return errorResponse(res, error);
  }
};


exports.latestByModule = async (req, res) => {
  try {
    const { courseId } = req.query;
    const userId = req.user?._id || req.user?.id;

    if (!userId || !courseId) {
      return res.status(400).json({ success: false, statusCode: 400, message: "userId and courseId required" });
    }

    let userObjId, courseObjId;
    try {
      userObjId = new mongoose.Types.ObjectId(String(userId));
      courseObjId = new mongoose.Types.ObjectId(String(courseId));
    } catch {
      return res.status(400).json({ success: false, statusCode: 400, message: "Invalid userId or courseId" });
    }

    const latestSubmissions = await AssessmentSubmission.aggregate([
      { $match: { userId: userObjId, courseId: courseObjId } },
      { $sort: { submittedAt: -1, createdAt: -1 } },
      {
        $group: {
          _id: "$moduleId",
          latest: { $first: "$$ROOT" },
        },
      },
      {
        $project: {
          _id: 0,
          moduleId: "$_id",
          attemptId: "$latest.attemptId",
          attemptNumber: "$latest.attemptNumber",
          percent: "$latest.percent",
          grade: "$latest.grade",
          submittedAt: "$latest.submittedAt",
          scoreEarned: "$latest.scoreEarned",
          scoreTotal: "$latest.scoreTotal",
          timeSeconds: "$latest.timeSeconds"
      } }
    ]);

    return res.status(200).json({ success: true, statusCode: 200, data: latestSubmissions });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.finalUnlock = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { courseId } = req.query;

    if (!userId || !courseId) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "userId and courseId are required",
        data: null,
      });
    }

    let userObjId, courseObjId;
    try {
      userObjId = new mongoose.Types.ObjectId(String(userId));
      courseObjId = new mongoose.Types.ObjectId(String(courseId));
    } catch {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid userId or courseId format",
        data: null,
      });
    }

    const course = await Course.findById(courseObjId, { modules: 1 }).lean();
    if (!course) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Course not found",
        data: null,
      });
    }

    const moduleIds = (course.modules || []).map((m) =>
      new mongoose.Types.ObjectId(String(m._id || m.id))
    );

    if (moduleIds.length === 0) {
      return res.json({
        success: true,
        statusCode: 200,
        data: {
          unlocked: false,
          failedCount: 0,
          passedCount: 0,
          totalModules: 0,
        },
      });
    }

    const latestByModule = await AssessmentSubmission.aggregate([
      { $match: { userId: userObjId, courseId: courseObjId, moduleId: { $in: moduleIds } } },
      { $sort: { moduleId: 1, submittedAt: -1, createdAt: -1, attemptNumber: -1 } },
      { $group: { _id: "$moduleId", latest: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$latest" } },
      { $project: { moduleId: 1, grade: 1, percent: 1, bestScore: 1 } },
    ]);

    let failedCount = 0;
    const passedModules = new Set();

    for (const doc of latestByModule) {
      const score =
        typeof doc.bestScore === "number"
          ? doc.bestScore
          : typeof doc.percent === "number"
          ? doc.percent
          : 0;

      const passed = score >= 60 && doc.grade !== "F";
      if (passed) passedModules.add(String(doc.moduleId));
      else failedCount += 1;
    }

    const passedCount = passedModules.size;
    const allModulesAttempted = latestByModule.length === moduleIds.length;
    const allPassed = failedCount === 0 && passedCount === moduleIds.length;
    const unlocked = allModulesAttempted && allPassed;

    return res.json({
      success: true,
      statusCode: 200,
      data: {
        unlocked,
        failedCount,
        passedCount,
        totalModules: moduleIds.length,
      },
    });
  } catch (error) {
    console.error("Error in finalUnlock:", error);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Server error in finalUnlock",
      error: error.message,
    });
  }
};
