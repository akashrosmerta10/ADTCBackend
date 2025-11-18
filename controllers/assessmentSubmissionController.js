const crypto = require("crypto");
const mongoose = require("mongoose");
const AssessmentSubmission = require("../models/AssessmentSubmission");
const Course = require("../models/Course");
const errorResponse = require("../utils/errorResponse");
const { logUserActivity } = require("../utils/activityLogger");
const Question = require("../models/Questions");
const CourseCompletion = require("../models/CourseCompletion");
const User = require("../models/User");
const Certificate = require("../models/Certificate");

function makeCertId() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function makeAttemptKey(userId, courseId, moduleId) {
  return `${String(userId)}:${String(courseId)}:${String(moduleId)}`;
}
function makeAttemptId(attemptKey) {
  return crypto.createHash("sha1").update(attemptKey).digest("hex");
}

async function getNextAttemptNumber({ userId, courseId, moduleId }, session) {
  const latest = await AssessmentSubmission
    .findOne({ userId, courseId, moduleId })
    .sort({ attemptNumber: -1 })
    .select({ attemptNumber: 1 })
    .session(session || null);
  return (latest?.attemptNumber || 0) + 1;
}

async function sampleQuestions(moduleId, size) {
  const mid = new mongoose.Types.ObjectId(String(moduleId));
  const rows = await Question.aggregate([
    { $match: { moduleId: mid, active: true } },
    { $sample: { size } },
    { $project: { _id: 1 } },
  ]);
  return rows.map(r => String(r._id));
}


function gradeFromPercent(p) {
  const v = Number(p) || 0;
  if (v >= 90) return "A";
  if (v >= 80) return "B";
  if (v >= 70) return "C";
  if (v >= 60) return "D";
  return "F";
}

exports.startAssessment = async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  const { courseId, moduleId, moduleName } = req.body;
  if (!userId || !courseId || !moduleId) {
    return res.status(400).json({ success: false, statusCode: 400, message: "userId, courseId, moduleId required", data: null });
  }

  try {
    new mongoose.Types.ObjectId(String(userId));
    new mongoose.Types.ObjectId(String(courseId));
    new mongoose.Types.ObjectId(String(moduleId));
  } catch {
    return res.status(400).json({ success: false, statusCode: 400, message: "Invalid userId/courseId/moduleId", data: null });
  }

  const attemptKey = makeAttemptKey(userId, courseId, moduleId);
  const attemptId = makeAttemptId(attemptKey);
  const now = new Date();

  let session;
  try {
    session = await mongoose.startSession();
    let doc;

    await session.withTransaction(async () => {
      doc = await AssessmentSubmission.findOne({ attemptKey }).session(session);

      if (!doc) {
        const attemptNumber = await getNextAttemptNumber({ userId, courseId, moduleId }, session);

        doc = await AssessmentSubmission.create([{
          userId,
          courseId,
          moduleId,
          attemptKey,
          attemptId,
          attemptNumber,
          status: "started",
          startedAt: now,
          submittedAt: now,
          timeSeconds: 0,
          sequence: 1,
          snapshotModuleName: moduleName ?? undefined,

          scoreEarned: 0,
          scoreTotal: 0,
          correctCount: 0,
          incorrectCount: 0,
          skippedCount: 0,
          breakdownByType: {},
          percent: 0,
          grade: undefined,

          maxPercent: 0,
          maxScoreEarned: 0,
          bestGrade: undefined,
        }], { session }).then(r => r[0]);

        await logUserActivity({
          userId,
          activityType: "OTHER",
          metadata: { event: "ASSESSMENT_STARTED", attemptId, courseId, moduleId },
          req,
        });
      }
    });

    if (!doc) doc = await AssessmentSubmission.findOne({ attemptKey });

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "attempt ready",
      data: {
        attemptId: doc.attemptId,
        attemptNumber: doc.attemptNumber,
        status: doc.status,
        startedAt: doc.startedAt,
        courseId: String(doc.courseId),
        moduleId: String(doc.moduleId),
        moduleName: doc.snapshotModuleName,
      }
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const existing = await AssessmentSubmission.findOne({ attemptKey });
      if (existing) {
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: "attempt exists",
          data: {
            attemptId: existing.attemptId,
            attemptNumber: existing.attemptNumber,
            status: existing.status,
            startedAt: existing.startedAt,
            courseId: String(existing.courseId),
            moduleId: String(existing.moduleId),
            moduleName: existing.snapshotModuleName,
          }
        });
      }
    }
    return errorResponse(res, err);
  } finally {
    if (session) session.endSession();
  }
};

async function sampleQuestions(moduleId, size) {
  const mid = new mongoose.Types.ObjectId(String(moduleId));
  const rows = await Question.aggregate([
    { $match: { moduleId: mid, active: true } },
    { $sample: { size } },
    { $project: { _id: 1 } },
  ]);
  return rows.map(r => String(r._id));
}

async function checkFinalUnlocked(userId, courseId) {
  const userObjId = new mongoose.Types.ObjectId(String(userId));
  const courseObjId = new mongoose.Types.ObjectId(String(courseId));
  const course = await Course.findById(courseObjId, { modules: 1 }).lean();
  if (!course) return { unlocked: false, totalModules: 0, passedCount: 0, course: null };
  const moduleIds = (course.modules || []).map(m => new mongoose.Types.ObjectId(String(m._id || m.id)));

  if (moduleIds.length === 0) return { unlocked: false, totalModules: 0, passedCount: 0, course, moduleIds };

  const latest = await AssessmentSubmission.aggregate([
    { $match: { userId: userObjId, courseId: courseObjId, status: "submitted" } },
    {
      $addFields: {
        moduleIdObj: {
          $cond: [
            {
              $and: [
                { $ne: [{ $type: "$moduleId" }, "objectId"] },
                { $eq: [{ $strLenCP: { $toString: "$moduleId" } }, 24] },
              ],
            },
            { $toObjectId: { $toString: "$moduleId" } },
            "$moduleId",
          ],
        },
      },
    },
    { $match: { moduleIdObj: { $in: moduleIds } } },
    { $sort: { moduleIdObj: 1, submittedAt: -1, createdAt: -1, attemptNumber: -1 } },
    { $group: { _id: "$moduleIdObj", latest: { $first: "$$ROOT" } } },
    {
      $project: {
        moduleId: "$_id",
        percent: { $ifNull: ["$latest.percent", 0] },
        maxPercent: { $ifNull: ["$latest.maxPercent", 0] },
        bestGrade: {
          $ifNull: [
            "$latest.bestGrade",
            {
              $switch: {
                branches: [
                  { case: { $gte: ["$latest.maxPercent", 90] }, then: "A" },
                  { case: { $gte: ["$latest.maxPercent", 80] }, then: "B" },
                  { case: { $gte: ["$latest.maxPercent", 70] }, then: "C" },
                  { case: { $gte: ["$latest.maxPercent", 60] }, then: "D" },
                ],
                default: "F",
              },
            },
          ],
        },
      },
    },
  ]);

  let failedCount = 0;
  const passed = new Set();
  for (const doc of latest) {
    const score = Number.isFinite(doc?.maxPercent) ? doc.maxPercent : (Number.isFinite(doc?.percent) ? doc.percent : 0);
    const letter = doc?.bestGrade || gradeFromPercent(score);
    const ok = score >= 60 && letter !== "F";
    if (ok) passed.add(String(doc.moduleId)); else failedCount += 1;
  }

  const unlocked = failedCount === 0 && passed.size === moduleIds.length;
  return { unlocked, totalModules: moduleIds.length, passedCount: passed.size, course, moduleIds };
}

exports.startFinal = async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  const { courseId } = req.body;
  if (!userId || !courseId) {
    return res.status(400).json({ success: false, statusCode: 400, message: "userId and courseId required", data: null });
  }

  try {
    new mongoose.Types.ObjectId(String(userId));
    new mongoose.Types.ObjectId(String(courseId));
  } catch (e) {
    return res.status(400).json({ success: false, statusCode: 400, message: "Invalid userId/courseId", data: null });
  }
  let unlock;
  try {
    unlock = await checkFinalUnlocked(userId, courseId);
  } catch (e) {
    return res.status(500).json({ success: false, statusCode: 500, message: "Error checking final unlock", data: null });
  }

  if (!unlock.unlocked) {
    return res.status(403).json({
      success: false,
      statusCode: 403,
      message: "Final locked: pass all modules first",
      data: { unlocked: false, passedCount: unlock.passedCount, totalModules: unlock.totalModules },
    });
  }

  const courseDoc = unlock.course || await Course.findById(courseId, { modules: 1 }).lean();
  const modules = (courseDoc?.modules || []).map(m => ({
    id: String(m._id || m.id),
    name: String(m.name || "").trim(),
  }));

  const road = modules.find(m => {
    const n = m.name.toLowerCase();
    return n === "road signs" || n === "road sign";
  });

  let finalQuestionIds = [];
  try {
    if (road) {

      const road6 = await sampleQuestions(road.id, 6);
      if (road6.length < 6) {
        return res.status(422).json({ success: false, statusCode: 422, message: "Insufficient Road Signs questions", data: null });
      }


      const remaining = modules.filter(m => m.id !== road.id).map(m => m.id);
      let need = 4;
      const bag = new Set();
      for (const mid of remaining.sort(() => Math.random() - 0.5)) {
        if (need <= 0) break;
        const take = Math.min(4, need);
        const picks = await sampleQuestions(mid, take);
        for (const q of picks) {
          if (need <= 0) break;
          if (!bag.has(q) && !road6.includes(q)) { bag.add(q); need -= 1; }
        }
      }
      if (bag.size < 4) {
        return res.status(422).json({ success: false, statusCode: 422, message: "Insufficient questions from remaining modules", data: null });
      }
      finalQuestionIds = [...road6, ...Array.from(bag)];
    } else {
      const bag = new Set();
      for (const m of [...modules].sort(() => Math.random() - 0.5)) {
        if (bag.size >= 10) break;
        const need = 10 - bag.size;
        const take = Math.min(4, need);
        const picks = await sampleQuestions(m.id, take);
        for (const q of picks) { if (bag.size < 10) bag.add(q); }
      }
      if (bag.size < 10) {
        const rows = await Question.aggregate([
          { $match: { moduleId: { $in: modules.map(m => new mongoose.Types.ObjectId(m.id)) }, active: true } },
          { $sample: { size: 10 } },
          { $project: { _id: 1 } },
        ]);
        finalQuestionIds = rows.map(r => String(r._id));
        if (finalQuestionIds.length < 10) {
          return res.status(422).json({ success: false, statusCode: 422, message: "Insufficient questions to create final", data: null });
        }
      } else {
        finalQuestionIds = Array.from(bag);
      }
    }
  } catch (e) {
    return res.status(500).json({ success: false, statusCode: 500, message: "Error sampling questions for final", data: null });
  }

  finalQuestionIds = finalQuestionIds.sort(() => Math.random() - 0.5).slice(0, 10);
  if (finalQuestionIds.length !== 10) {
    return res.status(422).json({ success: false, statusCode: 422, message: "Final selection did not reach 10 questions", data: null });
  }
  const FINAL_MODULE_SENTINEL = "final";
  const attemptKey = makeAttemptKey(userId, courseId, FINAL_MODULE_SENTINEL);
  const attemptId = makeAttemptId(attemptKey);
  const now = new Date();

  let session;
  try {
    session = await mongoose.startSession();
    let doc;

    await session.withTransaction(async () => {
      doc = await AssessmentSubmission.findOne({ attemptKey }).session(session);
      if (!doc) {
        const attemptNumber = await getNextAttemptNumber({ userId, courseId, moduleId: FINAL_MODULE_SENTINEL }, session);

        doc = await AssessmentSubmission.create([{
          userId,
          courseId,
          moduleId: FINAL_MODULE_SENTINEL,
          attemptKey,
          attemptId,
          attemptNumber,
          status: "started",
          startedAt: now,
          submittedAt: now,
          timeSeconds: 0,
          sequence: 1,
          snapshotModuleName: "Final Assessment",
          scoreEarned: 0,
          scoreTotal: 0,
          correctCount: 0,
          incorrectCount: 0,
          skippedCount: 0,
          breakdownByType: {},
          percent: 0,
          grade: undefined,
          maxPercent: 0,
          maxScoreEarned: 0,
          bestGrade: undefined,
          seededQuestions: finalQuestionIds.map(qid => ({ questionId: qid })),
        }], { session }).then(r => r[0]);

        await logUserActivity({
          userId,
          activityType: "OTHER",
          metadata: { event: "FINAL_STARTED", attemptId, courseId, rule: road ? "road+others" : "all-modules", roadModuleId: road?.id || null },
          req,
        });
      } else {
        if (!Array.isArray(doc.seededQuestions) || doc.seededQuestions.length === 0) {
          doc.seededQuestions = finalQuestionIds.map(qid => ({ questionId: qid }));
          await doc.save({ session });
        }
      }
    });

    if (!doc) doc = await AssessmentSubmission.findOne({ attemptKey });

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "final attempt ready",
      data: {
        attemptId: doc.attemptId,
        attemptNumber: doc.attemptNumber,
        status: doc.status,
        startedAt: doc.startedAt,
        courseId: String(doc.courseId),
        moduleId: String(doc.moduleId),
        moduleName: doc.snapshotModuleName,
        questionIds: finalQuestionIds,
      },
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const existing = await AssessmentSubmission.findOne({ attemptKey });
      if (existing) {
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: "final attempt exists",
          data: {
            attemptId: existing.attemptId,
            attemptNumber: existing.attemptNumber,
            status: existing.status,
            startedAt: existing.startedAt,
            courseId: String(existing.courseId),
            moduleId: String(existing.moduleId),
            moduleName: existing.snapshotModuleName,
            questionIds:
              Array.isArray(existing.seededQuestions) && existing.seededQuestions.length > 0
                ? existing.seededQuestions.map(q => String(q.questionId)).slice(0, 10)
                : (existing.questions || []).map(q => String(q.questionId)).slice(0, 10),
          },
        });
      }
    }
    return errorResponse(res, err);
  } finally {
    if (session) {
      try { session.endSession(); } catch { }
    }
  }
};



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
    sequence: typeof body.sequence === "number" ? body.sequence : undefined,
    attemptNumber: typeof body.attemptNumber === "number" ? body.attemptNumber : undefined,
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
        if (!(k === "moduleId" && String(payload[k]) === "final")) {
          return res.status(400).json({ success: false, statusCode: 400, message: `Invalid ${k}`, data: null });
        }
      }
    }

    const attemptDoc = await AssessmentSubmission.findOne({ attemptId: payload.attemptId });
    if (!attemptDoc) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Unknown attemptId. Call /api/v1/assessments/start (module) or /api/v1/assessments/start-final (final) first.",
        data: null,
      });
    }

    const newPercent = Number.isFinite(payload.percent) ? Number(payload.percent) : 0;
    const newScore = Number.isFinite(payload.scoreEarned) ? Number(payload.scoreEarned) : 0;

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
          snapshotModuleName: payload.snapshotModuleName,
          status: "submitted",
        },
        $max: {
          maxPercent: newPercent,
          maxScoreEarned: newScore,
        },
      },
      { new: true }
    );

    if (updated) {
      const bestNow = Math.max(Number(updated?.maxPercent || 0), newPercent);
      const bestGrade = gradeFromPercent(bestNow);
      if (updated.bestGrade !== bestGrade) {
        updated.bestGrade = bestGrade;
        await updated.save();
      }
    }

    await logUserActivity({
      userId: payload.userId,
      activityType: "OTHER",
      metadata: {
        event: attemptDoc.status === "submitted" ? "ASSESSMENT_UPDATED" : "ASSESSMENT_SUBMITTED",
        attemptId: payload.attemptId,
        moduleId: payload.moduleId,
        courseId: payload.courseId,
        scoreEarned: payload.scoreEarned,
        percent: payload.percent,
        grade: payload.grade,
        bestGrade: updated?.bestGrade,
        maxPercent: updated?.maxPercent,
      },
      req,
    });

    const isFinal = String(updated?.moduleId) === "final";
    const bestNow = Math.max(Number(updated?.maxPercent || 0), Number(updated?.percent || 0));
    const passed = isFinal && bestNow >= 60;

    if (passed) {

      try {
        await CourseCompletion.create({
          userId: updated.userId,
          courseId: updated.courseId,
        });

        await User.updateOne(
          { _id: updated.userId },
          { $inc: { completedCourse: 1 } }
        );
      } catch (e) {
        if (!(e && e.code === 11000)) {
          console.error("Error marking course completion:", e);
        }
      }

      try {
        const userDoc = await User.findById(updated.userId, { firstName: 1, lastName: 1 }).lean();
        const courseDoc = await Course.findById(updated.courseId, { title: 1 }).lean();

        await Certificate.create({
          userId: updated.userId,
          courseId: updated.courseId,
          certificateId: makeCertId(),
          username: `${userDoc?.firstName ?? ""} ${userDoc?.lastName ?? ""}`.trim() || "Learner",
          courseName: courseDoc?.title || "Course",
          issueDate: new Date(),
          status: "issued",
        });
      } catch (e) {
        if (!(e && e.code === 11000)) {
          console.error("Certificate issuance error:", e);
        }
      }
    }

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "submission upserted successfully",
      data: updated,
    });
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
      { $group: { _id: "$moduleId", latest: { $first: "$$ROOT" } } },
      {
        $project: {
          _id: 0,
          moduleId: "$_id",
          attemptId: "$latest.attemptId",
          attemptNumber: "$latest.attemptNumber",

          percent: "$latest.percent",
          grade: "$latest.grade",

          maxPercent: "$latest.maxPercent",
          maxScoreEarned: "$latest.maxScoreEarned",
          bestGrade: {
            $ifNull: [
              "$latest.bestGrade",
              {
                $switch: {
                  branches: [
                    { case: { $gte: ["$latest.maxPercent", 90] }, then: "A" },
                    { case: { $gte: ["$latest.maxPercent", 80] }, then: "B" },
                    { case: { $gte: ["$latest.maxPercent", 70] }, then: "C" },
                    { case: { $gte: ["$latest.maxPercent", 60] }, then: "D" },
                  ],
                  default: "F",
                }
              }
            ]
          },
          submittedAt: "$latest.submittedAt",
          scoreEarned: "$latest.scoreEarned",
          scoreTotal: "$latest.scoreTotal",
          timeSeconds: "$latest.timeSeconds",
        }
      }
    ]);

    return res.status(200).json({ success: true, statusCode: 200, data: latestSubmissions });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.finalUnlock = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
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
          totalModules: 0,
        },
      });
    }

    const latestByModule = await AssessmentSubmission.aggregate([
      { $match: { userId: userObjId, courseId: courseObjId } },
      {
        $addFields: {
          moduleIdObj: {
            $cond: [
              {
                $and: [
                  { $ne: [{ $type: "$moduleId" }, "objectId"] },
                  { $eq: [{ $strLenCP: { $toString: "$moduleId" } }, 24] },
                ],
              },
              { $toObjectId: { $toString: "$moduleId" } },
              "$moduleId",
            ],
          },
        },
      },
      { $match: { moduleIdObj: { $in: moduleIds } } },
      { $sort: { moduleIdObj: 1, submittedAt: -1, createdAt: -1, attemptNumber: -1 } },
      { $group: { _id: "$moduleIdObj", latest: { $first: "$$ROOT" } } },
      {
        $project: {
          _id: 0,
          moduleId: "$_id",
          percent: { $ifNull: ["$latest.percent", 0] },
          maxPercent: { $ifNull: ["$latest.maxPercent", 0] },
          bestGrade: {
            $ifNull: [
              "$latest.bestGrade",
              {
                $switch: {
                  branches: [
                    { case: { $gte: ["$latest.maxPercent", 90] }, then: "A" },
                    { case: { $gte: ["$latest.maxPercent", 80] }, then: "B" },
                    { case: { $gte: ["$latest.maxPercent", 70] }, then: "C" },
                    { case: { $gte: ["$latest.maxPercent", 60] }, then: "D" },
                  ],
                  default: "F",
                },
              },
            ],
          },
        },
      },
    ]);

    let failedCount = 0;
    const passedSet = new Set();
    for (const doc of latestByModule) {
      const bestPercent = Number.isFinite(doc?.maxPercent)
        ? Number(doc.maxPercent)
        : Number.isFinite(doc?.percent)
          ? Number(doc.percent)
          : 0;
      const letter = doc?.bestGrade ?? gradeFromPercent(bestPercent);
      const passed = bestPercent >= 60 && letter !== "F";
      if (passed) passedSet.add(String(doc.moduleId));
      else failedCount += 1;
    }

    const attemptedCount = latestByModule.length;
    const totalModules = moduleIds.length;
    const passedCount = passedSet.size;

    const allModulesAttempted = attemptedCount === totalModules;
    const allPassed = failedCount === 0 && passedCount === totalModules;
    const unlocked = allModulesAttempted && allPassed;

    const passedModules = Array.from(passedSet);
    const remainingModules = totalModules - passedCount;

    if (unlocked) {
      await logUserActivity({
        userId,
        activityType: "OTHER",
        metadata: {
          event: "COURSE_COMPLETED",
          courseId,
          passedModules: passedCount,
          totalModules,
        },
        req,
      });
    }

    return res.json({
      success: true,
      statusCode: 200,
      data: {
        unlocked,
        failedCount,
        passedCount,
        totalModules,
        passedModules,
        remainingModules,
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


exports.courseStats = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { courseId } = req.query;

    if (!userId || !courseId) {
      return res.status(400).json({ success: false, statusCode: 400, message: "userId and courseId required", data: null });
    }

    let userObjId, courseObjId;
    try {
      userObjId = new mongoose.Types.ObjectId(String(userId));
      courseObjId = new mongoose.Types.ObjectId(String(courseId));
    } catch {
      return res.status(400).json({ success: false, statusCode: 400, message: "Invalid userId or courseId", data: null });
    }
    const course = await Course.findById(courseObjId, { modules: 1 }).lean();
    if (!course) {
      return res.status(404).json({ success: false, statusCode: 404, message: "Course not found", data: null });
    }

    const moduleIds = (course.modules || []).map((m) => new mongoose.Types.ObjectId(String(m._id || m.id)));
    const modulesTotal = moduleIds.length;

    if (modulesTotal === 0) {
      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          courseId: String(courseId),
          modulesTotal: 0,
          modulesAttempted: 0,
          modulesPassed: 0,
          assessmentsTaken: 0,
          timeSecondsTotal: 0,
          scoreEarnedTotal: 0,
          scorePossibleTotal: 0,
          overallPercentAvg: 0,
        },
      });
    }

    const latestRows = await AssessmentSubmission.aggregate([
      { $match: { userId: userObjId, courseId: courseObjId, moduleId: { $in: moduleIds } } },
      { $sort: { moduleId: 1, submittedAt: -1, createdAt: -1, attemptNumber: -1 } },
      { $group: { _id: "$moduleId", latest: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$latest" } },
      {
        $project: {
          moduleId: 1,
          attemptNumber: 1,
          percent: 1,
          maxPercent: 1,
          scoreEarned: 1,
          scoreTotal: 1,
          timeSeconds: 1,
        },
      },
    ]);

    const byId = new Map(latestRows.map((r) => [String(r.moduleId), r]));
    const modulesAttempted = latestRows.length;

    let modulesPassed = 0;
    let assessmentsTaken = 0;
    let timeSecondsTotal = 0;
    let scoreEarnedTotal = 0;
    let scorePossibleTotal = 0;
    let percentSum = 0;

    for (const mid of moduleIds) {
      const key = String(mid);
      const row = byId.get(key);
      const percent = Number(row?.percent ?? 0);
      const best = Number.isFinite(row?.maxPercent) ? Number(row.maxPercent) : percent;
      if (best >= 60) modulesPassed += 1;

      assessmentsTaken += Number(row?.attemptNumber ?? 0);
      timeSecondsTotal += Number(row?.timeSeconds ?? 0);
      scoreEarnedTotal += Number(row?.scoreEarned ?? 0);
      scorePossibleTotal += Number(row?.scoreTotal ?? 0);
      percentSum += percent;
    }

    const overallPercentAvg = Math.round(percentSum / Math.max(modulesTotal, 1));

    return res.status(200).json({
      success: true,
      statusCode: 200,
      data: {
        courseId: String(courseId),
        modulesTotal,
        modulesAttempted,
        modulesPassed,
        assessmentsTaken,
        timeSecondsTotal,
        scoreEarnedTotal,
        scorePossibleTotal,
        overallPercentAvg,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.courseModuleStats = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { courseId } = req.query;

    if (!userId || !courseId) {
      return res.status(400).json({ success: false, statusCode: 400, message: "userId and courseId required", data: null });
    }

    let userObjId, courseObjId;
    try {
      userObjId = new mongoose.Types.ObjectId(String(userId));
      courseObjId = new mongoose.Types.ObjectId(String(courseId));
    } catch {
      return res.status(400).json({ success: false, statusCode: 400, message: "Invalid userId or courseId", data: null });
    }

    const rows = await AssessmentSubmission.aggregate([
      { $match: { userId: userObjId, courseId: courseObjId } },
      { $sort: { submittedAt: -1, createdAt: -1 } },
      { $group: { _id: "$moduleId", latest: { $first: "$$ROOT" } } },
      {
        $project: {
          _id: 0,
          moduleId: "$_id",
          attemptId: "$latest.attemptId",
          attemptNumber: "$latest.attemptNumber",
          percent: "$latest.percent",
          grade: "$latest.grade",
          maxPercent: "$latest.maxPercent",
          maxScoreEarned: "$latest.maxScoreEarned",
          bestGrade: {
            $ifNull: [
              "$latest.bestGrade",
              {
                $switch: {
                  branches: [
                    { case: { $gte: ["$latest.maxPercent", 90] }, then: "A" },
                    { case: { $gte: ["$latest.maxPercent", 80] }, then: "B" },
                    { case: { $gte: ["$latest.maxPercent", 70] }, then: "C" },
                    { case: { $gte: ["$latest.maxPercent", 60] }, then: "D" },
                  ],
                  default: "F",
                },
              },
            ],
          },
          submittedAt: "$latest.submittedAt",
          scoreEarned: "$latest.scoreEarned",
          scoreTotal: "$latest.scoreTotal",
          timeSeconds: "$latest.timeSeconds",
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      statusCode: 200,
      data: {
        courseId: String(courseId),
        modules: rows,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};


exports.getLatestFinal = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
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
        message: "Invalid userId or courseId",
        data: null,
      });
    }

    const FINAL_MODULE_SENTINEL = "final";
    const rows = await AssessmentSubmission.aggregate([
      { $match: { userId: userObjId, courseId: courseObjId, moduleId: FINAL_MODULE_SENTINEL } },
      { $sort: { submittedAt: -1, createdAt: -1, attemptNumber: -1 } },
      { $limit: 1 },
      {
        $project: {
          _id: 0,
          attemptId: 1,
          attemptNumber: 1,
          status: 1,
          startedAt: 1,
          submittedAt: 1,
          courseId: 1,
          moduleId: 1,
          moduleName: "$snapshotModuleName",
          percent: { $ifNull: ["$percent", 0] },
          maxPercent: { $ifNull: ["$maxPercent", 0] },
          bestGrade: {
            $ifNull: [
              "$bestGrade",
              {
                $switch: {
                  branches: [
                    { case: { $gte: ["$maxPercent", 90] }, then: "A" },
                    { case: { $gte: ["$maxPercent", 80] }, then: "B" },
                    { case: { $gte: ["$maxPercent", 70] }, then: "C" },
                    { case: { $gte: ["$maxPercent", 60] }, then: "D" },
                  ],
                  default: "F",
                },
              },
            ],
          },
          scoreEarned: { $ifNull: ["$scoreEarned", 0] },
          scoreTotal: { $ifNull: ["$scoreTotal", 0] },
          timeSeconds: { $ifNull: ["$timeSeconds", 0] },
        },
      },
    ]);

    const latest = rows[0] || null;

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "latest final fetched",
      data: latest, // null if none yet
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Server error in getLatestFinal",
      error: error.message,
    });
  }
};

exports.getCourseAssessmentCard = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { courseId } = req.query;
    if (!userId || !courseId) {
      return res.status(400).json({ success: false, statusCode: 400, message: "userId and courseId required", data: null });
    }

    let userObjId, courseObjId;
    try {
      userObjId = new mongoose.Types.ObjectId(String(userId));
      courseObjId = new mongoose.Types.ObjectId(String(courseId));
    } catch {
      return res.status(400).json({ success: false, statusCode: 400, message: "Invalid userId or courseId", data: null });
    }

    const course = await Course.findById(courseObjId, { modules: 1, title: 1 }).lean();
    if (!course) {
      return res.status(404).json({ success: false, statusCode: 404, message: "Course not found", data: null });
    }
    const moduleIds = (course.modules || []).map(m => new mongoose.Types.ObjectId(String(m._id || m.id)));

    const latestRows = await AssessmentSubmission.aggregate([
      { $match: { userId: userObjId, courseId: courseObjId, status: "submitted" } },
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
      { $sort: { submittedAt: -1, createdAt: -1, attemptNumber: -1 } },
      { $group: { _id: "$moduleIdStr", latest: { $first: "$$ROOT" } } },
      {
        $project: {
          _id: 0,
          moduleId: "$_id",
          attemptNumber: "$latest.attemptNumber",
          percent: { $ifNull: ["$latest.percent", 0] },
          maxPercent: { $ifNull: ["$latest.maxPercent", 0] },
          scoreEarned: { $ifNull: ["$latest.scoreEarned", 0] },
          scoreTotal: { $ifNull: ["$latest.scoreTotal", 0] },
          timeSeconds: { $ifNull: ["$latest.timeSeconds", 0] },
        },
      },
    ]);

    const byModule = new Map();
    let finalPassed = false;
    for (const r of latestRows) {
      if (r.moduleId === "final") {
        const best = Number.isFinite(r.maxPercent) ? Number(r.maxPercent) : Number(r.percent ?? 0);
        finalPassed = best >= 60;
      } else {
        byModule.set(r.moduleId, r);
      }
    }

    let attemptedModules = 0;
    let passedModules = 0;
    let attemptsTaken = 0;
    let timeSeconds = 0;
    let scoreEarned = 0;
    let scoreTotal = 0;

    for (const mid of moduleIds) {
      const key = String(mid);
      const row = byModule.get(key);
      if (row) {
        const percent = Number(row.percent ?? 0);
        const best = Number.isFinite(row.maxPercent) ? Number(row.maxPercent) : percent;

        if (percent > 0 || Number(row.attemptNumber ?? 0) > 0) attemptedModules += 1;
        if (best >= 60) passedModules += 1;

        attemptsTaken += Number(row.attemptNumber ?? 0);
        timeSeconds += Number(row.timeSeconds ?? 0);
        scoreEarned += Number(row.scoreEarned ?? 0);
        scoreTotal += Number(row.scoreTotal ?? 0);
      }
    }

    const totalModules = moduleIds.length;
    const overallPct = totalModules > 0 ? Math.round((passedModules / totalModules) * 100) : 0;

    return res.status(200).json({
      success: true,
      statusCode: 200,
      data: {
        courseId: String(courseId),
        title: course.title,
        totalModules,
        attemptedModules,
        passedModules,
        overallPct,
        attemptsTaken,
        timeSeconds,
        scoreEarned,
        scoreTotal,
        finalPassed,
      },
    });
  } catch (error) {
    console.error("getCourseAssessmentCard error:", error);
    return res.status(500).json({ success: false, statusCode: 500, message: "Server error", error: error.message, data: null });
  }
};
