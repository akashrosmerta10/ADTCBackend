const mongoose = require("mongoose");
const Module = require("../models/Module");
const Question = require("../models/Questions");
const errorResponse = require("../utils/errorResponse");

exports.createModule = async (req, res) => {
  try {
    const { name, summary, url, questionIds } = req.body;

    if (!name || !summary || !url) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "All fields are required.",
        data: null,
      });
    }

    // let validatedQuestions = [];
    // if (Array.isArray(questions)) {
    //   validatedQuestions = questions.map((q) => {
    //     if (!q.questionText || !q.type) {
    //       throw new Error("Each question must have questionText and type.");
    //     }
    //     if (q.type === "mcq" && (!q.options || q.options.length < 2)) {
    //       throw new Error("MCQ must have at least 2 options.");
    //     }
    //     return {
    //       questionText: q.questionText,
    //       score: q.score || 1,
    //       type: q.type,
    //       options: q.type === "mcq" ? q.options : undefined,
    //       correctAnswer: q.correctAnswer,
    //     };
    //   });
    // }

    const module = new Module({
      name,
      summary,
      url,

      questionIds: Array.isArray(questionIds) ? questionIds : undefined,
    });

    await module.save();

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "Module successfully created.",
      data: module,
    });
  } catch (error) {
 return errorResponse(res, error)
  }
};

exports.getAllModules = async (req, res) => {
  try {
    const modules = await Module.find().lean();;
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Modules fetched successfully.",
      data: modules,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.getModule = async (req, res) => {
  try {
    const module = await Module.findById(req.params.id);
    if (!module) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Module not found.",
        data: null,
      });
    }
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Module fetched successfully.",
      data: module,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.updateModule = async (req, res) => {
  try {
    const { name, summary, url, questionIds } = req.body;

    const mod = await Module.findById(req.params.id);
    if (!mod) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Module not found.",
        data: null,
      });
    }

    if (name) mod.name = name;
    if (summary) mod.summary = summary;
    if (url) mod.url = url;
    if (Array.isArray(questionIds)) mod.questionIds = questionIds;

    await mod.save();

    res.status(200).json({
      success: true,
      statusCode: 200,
      msg: "Module successfully updated.",
      module: mod,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.deleteModule = async (req, res) => {
  try {
   const module = await Module.findByIdAndDelete(req.params.id);
    if (!module) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Module not found.",
        data: null,
      });
    }
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Module successfully deleted.",
      data: null,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.getModuleQuestions = async (req, res) => {
  try {
    const { id } = req.params;
    const { count = 5, shuffle = "true", active = "true" } = req.query;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid module id",
        data: null,
      });
    }

    const n = Math.max(0, Math.min(parseInt(count, 10) || 5, 50)); 
    const match = { moduleId: new mongoose.Types.ObjectId(id) };
    if (active === "true") match.active = true;

    const pipeline =
      shuffle === "true"
        ? [{ $match: match }, { $sample: { size: n } }]
        : [{ $match: match }, { $sort: { createdAt: -1 } }, { $limit: n }];

    const selectedQuestions = await Question.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Questions fetched successfully",
      data: {
        count: selectedQuestions.length,
        questions: selectedQuestions,
      },
    });
  } catch (error) {
   return errorResponse(res. error);
  }
};
