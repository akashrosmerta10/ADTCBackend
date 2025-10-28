const Module = require('../models/Module');

exports.getLessonsByCourseId = async (req, res) => {
  try {
    const courseId = req.query.courseId;
    const lessons = await Module.find({ courseId }).sort('order');
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ message: "Error fetching lessons", error: error.message });
  }
};