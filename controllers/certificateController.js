const Certificate = require("../models/Certificate");
const Course = require("../models/Course");
const User = require("../models/User");
const crypto = require("crypto");
const mongoose = require('mongoose');

exports.issueCertificate = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user._id || req.user.id;

    if (!courseId || !userId) {
      return res.status(400).json({ success: false, message: "Missing courseId or userId" });
    }
    const existing = await Certificate.findOne({ userId, courseId });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Certificate already issued",
        data: existing,
      });
    }

    const course = await Course.findById(courseId);
    const user = await User.findById(userId);

    if (!course || !user) {
      return res.status(404).json({ success: false, message: "User or course not found" });
    }

    const certificateId = crypto.randomBytes(4).toString("hex").toUpperCase();

    const newCertificate = await Certificate.create({
      userId,
      courseId,
      certificateId,
      username: user.firstName + " " + user.lastName,
      courseName: course.title,
      issueDate: new Date(),
      status: "issued",
    })

    return res.status(201).json({
      success: true,
      message: "Certificate issued successfully",
      data: newCertificate,
    });
  } catch (err) {
    console.error("Error issuing certificate:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
exports.getUserCertificates = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing userId" });
    }
    const certificates = await Certificate.find({ userId }).populate("courseId", "title");

    res.status(200).json({ success: true, data: certificates });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getUserCertificateByCourse = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { courseId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing userId' });
    }

    const isValidCourseId = mongoose.Types.ObjectId.isValid(courseId);

    if (!isValidCourseId) {
      return res.status(400).json({ success: false, message: 'Invalid courseId' });
    }

    const certificate = await Certificate
      .findOne({ userId, courseId })
      .populate('courseId', 'title');

    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    return res.status(200).json({ success: true, data: certificate });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
