const mongoose = require("mongoose");
const Question = require("../models/Questions");
const Module = require("../models/Module");
const { getSignedImageUrl, deleteFromS3 } = require('../middleware/uploadToS3');


function validateQuestionPayload(body) {
  let { moduleId, question, type, score, options, correctAnswer } = body;

  if (typeof options === "string") {
    try {
      options = JSON.parse(options);
    } catch {
      throw new Error("Invalid options format");
    }
  }

  if (typeof correctAnswer === "string") {
    try {
      correctAnswer = JSON.parse(correctAnswer);
    } catch {
    }
  }

  if (!moduleId || !mongoose.isValidObjectId(moduleId)) {
    throw new Error("Valid moduleId is required");
  }

  if (!question || typeof question !== "object" || typeof question.text !== "string") {
    throw new Error("question.text is required and must be a string");
  }

  if (question.imageUrl && typeof question.imageUrl !== "string") {
    throw new Error("question.imageUrl must be a string if provided");
  }

  const t = String(type || "").toLowerCase();
  if (!["mcq", "tf", "image"].includes(t)) {
    throw new Error("type must be 'mcq', 'tf' or 'image'");
  }

  if (t === "mcq" || t === "image") {
    if (!Array.isArray(options) || options.length < 2) {
      throw new Error("question must have at least two options");
    }

    const optSet = new Set(options.map(String));

    if (Array.isArray(correctAnswer)) {
      const ok = correctAnswer.every((v) => optSet.has(String(v)));
      if (!ok) throw new Error("Each correctAnswer must be present in options");
    } else if (typeof correctAnswer === "string") {
      if (!optSet.has(String(correctAnswer))) {
        throw new Error("correctAnswer must be one of the options");
      }
    } else {
      throw new Error("question correctAnswer must be a string or array of strings");
    }
  } else if (t === "tf") {
    if (typeof correctAnswer !== "boolean") {
      throw new Error("TF correctAnswer must be boolean");
    }
  }

  const normalized = {
    moduleId,
    question: {
      text: question.text,
      imageUrl: question.imageUrl || null,
    },
    type: t,
    score: typeof score === "number" ? score : 1,
    options: t === "mcq" || t === "image" ? options : [],
    correctAnswer,
    difficulty: body.difficulty || null,
    explanation: body.explanation || null,
    active: typeof body.active === "boolean" ? body.active : true,
    tags: Array.isArray(body.tags) ? body.tags : [],
  };

  return normalized;
}

exports.createQuestion = async (req, res) => {
  try {
    if (req.file) {
      req.body.question = req.body.question || {};
      req.body.question.imageUrl;
    }

    const payload = validateQuestionPayload(req.body);

    const mod = await Module.findById(payload.moduleId).select("_id").lean();
    if (!mod) {
      return res.status(404).json({ message: "Module not found" });
    }

    const doc = await Question.create(payload);

    return res.status(201).json({ question: doc });
  } catch (e) {
    console.error("createQuestion error:", e);
    return res.status(400).json({ message: e.message || "Invalid question data" });
  }
};

exports.listQuestions = async (req, res) => {
  try {
    const { moduleId, active, q, type, limit, skip } = req.query;
    const filter = {};
    if (moduleId) filter.moduleId = moduleId;
    if (type) filter.type = String(type).toLowerCase();
    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;
    if (q) filter.question = { $regex: String(q), $options: "i" };

    const lim = Math.min(parseInt(limit, 10) || 100, 500);
    const sk = Math.max(parseInt(skip, 10) || 0, 0);

    const [items, total] = await Promise.all([
      Question.find(filter).sort({ createdAt: -1 }).skip(sk).limit(lim).lean(),
      Question.countDocuments(filter),
    ]);

    return res.json({ total, items });
  } catch (e) {
    console.error("listQuestions error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const doc = await Question.findById(id).lean();
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (doc.question?.imageUrl) {
      try {
        const signedUrl = await getSignedImageUrl(doc.question.imageUrl);
        if (signedUrl) doc.question.imageUrl = signedUrl;
      } catch (err) {
        console.warn("Signed URL generation failed:", err.message);
      }
    }

    return res.json({ question: doc });
  } catch (e) {
    console.error("getQuestion error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};


exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const existing = await Question.findById(id).lean();
    if (!existing) return res.status(404).json({ message: "Not found" });
    if ( existing.question?.imageUrl ) {
      try {
        const signedUrl = await getSignedImageUrl(existing.question?.imageUrl)
        if (signedUrl) existing.question.imageUrl = signedUrl;
      } catch(e) {
         console.warn("Signed URL generation failed:", err.message);
      }}
    const merged = { ...existing, ...req.body, moduleId: existing.moduleId };
    const payload = validateQuestionPayload(merged);

    const doc = await Question.findByIdAndUpdate(id, payload, { new: true });
      if (doc?.question?.imageUrl) {
      try {
        const signedUrl = await getSignedImageUrl(doc.question.imageUrl);
        if (signedUrl) doc.question.imageUrl = signedUrl;
      } catch (err) {
        console.warn("Signed URL generation failed (response):", err.message);
      }
    }
    return res.json({ question: doc });
  } catch (e) {
    console.error("updateQuestion error:", e);
    return res.status(400).json({ message: e.message || "Invalid data" });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });
    const doc = await Question.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("deleteQuestion error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};
