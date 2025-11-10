const crypto = require("crypto");
const mongoose = require("mongoose");
const AssessmentSubmission = require("../models/AssessmentSubmission");
const Course = require("../models/Course");
const errorResponse = require("../utils/errorResponse");
const { logUserActivity } = require("../utils/activityLogger");
const Question = require("../models/Questions");



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
  const mid = new mongoose.Types.ObjectId(String(moduleId)); // validate ObjectId [web:27]
  const rows = await Question.aggregate([
    { $match: { moduleId: mid, active: true } }, // filter active questions [web:22]
    { $sample: { size } }, // random exact-size sampling [web:22]
    { $project: { _id: 1 } },
  ]);
  return rows.map(r => String(r._id)); // return string ids [web:22]
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

          // current placeholders
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
  const mid = new mongoose.Types.ObjectId(String(moduleId)); // validate ObjectId [web:27]
  const rows = await Question.aggregate([
    { $match: { moduleId: mid, active: true } }, // filter active questions [web:22]
    { $sample: { size } }, // true random sample of exact size [web:22]
    { $project: { _id: 1 } },
  ]);
  return rows.map(r => String(r._id)); // return string ids [web:22]
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

  let failedCount = 0; // count modules not passed [web:27]
  const passed = new Set(); // track passed module ids [web:27]
  for (const doc of latest) {
    const score = Number.isFinite(doc?.maxPercent) ? doc.maxPercent : (Number.isFinite(doc?.percent) ? doc.percent : 0); // choose best [web:27]
    const letter = doc?.bestGrade || gradeFromPercent(score); // compute grade if absent [web:27]
    const ok = score >= 60 && letter !== "F"; // passing rule [web:27]
    if (ok) passed.add(String(doc.moduleId)); else failedCount += 1; // accumulate [web:27]
  }

  const unlocked = failedCount === 0 && passed.size === moduleIds.length; // all passed [web:27]
  return { unlocked, totalModules: moduleIds.length, passedCount: passed.size, course, moduleIds }; // result [web:27]
}

exports.startFinal = async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  const { courseId } = req.body;
  if (!userId || !courseId) {
    return res.status(400).json({ success: false, statusCode: 400, message: "userId and courseId required", data: null }); // guard [web:27]
  }

  try {
    new mongoose.Types.ObjectId(String(userId));
    new mongoose.Types.ObjectId(String(courseId));
  } catch {
    return res.status(400).json({ success: false, statusCode: 400, message: "Invalid userId/courseId", data: null }); // invalid ids [web:27]
  }

  // 1) Authoritative unlock check
  const unlock = await checkFinalUnlocked(userId, courseId); // your helper, unchanged [web:27]
  if (!unlock.unlocked) {
    return res.status(403).json({
      success: false,
      statusCode: 403,
      message: "Final locked: pass all modules first",
      data: { unlocked: false, passedCount: unlock.passedCount, totalModules: unlock.totalModules },
    }); // deny if not unlocked [web:27]
  }

  // 2) Build the 10-question mix based on presence of Road Signs
  const courseDoc = unlock.course || await Course.findById(courseId, { modules: 1 }).lean(); // ensure course loaded [web:27]
  const modules = (courseDoc?.modules || []).map(m => ({
    id: String(m._id || m.id),
    name: String(m.name || "").trim(),
  })); // normalize modules [web:27]

  const road = modules.find(m => m.name.toLowerCase() === "road signs"); // detect Road Signs [web:27]
  let finalQuestionIds = [];

  if (road) {
    // Need exactly 6 from Road Signs
    const road6 = await sampleQuestions(road.id, 6); // exact 6 via $sample [web:22]
    if (road6.length < 6) {
      return res.status(422).json({ success: false, statusCode: 422, message: "Insufficient Road Signs questions", data: null }); // guard [web:22]
    }

    // Need 4 from remaining modules
    const remaining = modules.filter(m => m.id !== road.id).map(m => m.id);
    let need = 4;
    const bag = new Set();
    for (const mid of remaining.sort(() => Math.random() - 0.5)) {
      if (need <= 0) break;
      const take = Math.min(4, need);
      const picks = await sampleQuestions(mid, take); // sample per module [web:22]
      for (const q of picks) {
        if (need <= 0) break;
        if (!bag.has(q) && !road6.includes(q)) { bag.add(q); need -= 1; } // avoid duplicates [web:22]
      }
    }
    if (bag.size < 4) {
      return res.status(422).json({ success: false, statusCode: 422, message: "Insufficient questions from remaining modules", data: null }); // guard [web:22]
    }
    finalQuestionIds = [...road6, ...Array.from(bag)];
  } else {
    // No Road Signs: pick 10 across all modules
    const bag = new Set();
    for (const m of [...modules].sort(() => Math.random() - 0.5)) {
      if (bag.size >= 10) break;
      const need = 10 - bag.size;
      const take = Math.min(4, need);
      const picks = await sampleQuestions(m.id, take); // sample per module [web:22]
      for (const q of picks) { if (bag.size < 10) bag.add(q); }
    }
    if (bag.size < 10) {
      // fallback: one-shot sample across all modules
      const rows = await Question.aggregate([
        { $match: { moduleId: { $in: modules.map(m => new mongoose.Types.ObjectId(m.id)) }, active: true } }, // match all modules [web:22]
        { $sample: { size: 10 } }, // sample 10 [web:22]
        { $project: { _id: 1 } },
      ]);
      finalQuestionIds = rows.map(r => String(r._id));
      if (finalQuestionIds.length < 10) {
        return res.status(422).json({ success: false, statusCode: 422, message: "Insufficient questions to create final", data: null }); // guard [web:22]
      }
    } else {
      finalQuestionIds = Array.from(bag);
    }
  }

  // Shuffle and clamp to 10
  finalQuestionIds = finalQuestionIds.sort(() => Math.random() - 0.5).slice(0, 10); // shuffle & limit [web:22]
  if (finalQuestionIds.length !== 10) {
    return res.status(422).json({ success: false, statusCode: 422, message: "Final selection did not reach 10 questions", data: null }); // guard [web:22]
  }

  // 3) Create or return attempt; persist selected questionIds
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
          // Persist the 10 chosen question IDs for integrity
          questions: finalQuestionIds.map(qid => ({ questionId: qid })),
        }], { session }).then(r => r[0]);

        await logUserActivity({
          userId,
          activityType: "OTHER",
          metadata: { event: "FINAL_STARTED", attemptId, courseId, rule: road ? "road+others" : "all-modules", roadModuleId: road?.id || null },
          req,
        });
      } else {
        // Backfill if attempt exists but has no questions
        if (!Array.isArray(doc.questions) || doc.questions.length === 0) {
          doc.questions = finalQuestionIds.map(qid => ({ questionId: qid }));
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
            questionIds: (existing.questions || []).map(q => String(q.questionId)).slice(0, 10),
          },
        });
      }
    }
    return errorResponse(res, err);
  } finally {
    if (session) session.endSession();
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
      {
        $project: {
          moduleId: 1,
          percent: 1,
          maxPercent: 1,
          grade: 1,
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
                }
              }
            ]
          }
        }
      }
    ]);

    let failedCount = 0;
    const passedModules = new Set();

    for (const doc of latestByModule) {
      const score = Number.isFinite(doc?.maxPercent) ? doc.maxPercent : (Number.isFinite(doc?.percent) ? doc.percent : 0);
      const letter = doc?.bestGrade ?? gradeFromPercent(score);
      const passed = score >= 60 && letter !== "F";
      if (passed) passedModules.add(String(doc.moduleId));
      else failedCount += 1;
    }

    const passedCount = passedModules.size;
    const allModulesAttempted = latestByModule.length === moduleIds.length;
    const allPassed = failedCount === 0 && passedCount === moduleIds.length;
    const unlocked = allModulesAttempted && allPassed;

    if (unlocked) {
      await logUserActivity({
        userId,
        activityType: "OTHER",
        metadata: {
          event: "COURSE_COMPLETED",
          courseId,
          passedModules: passedCount,
          totalModules: moduleIds.length,
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

    // Reuse the same idea as latestByModule to get the latest per module
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