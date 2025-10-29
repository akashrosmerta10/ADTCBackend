const ActivityLog = require("../models/ActivityLogs");
const User = require("../models/User");
const mongoose = require("mongoose");
const errorResponse = require("../utils/errorResponse");

/**
 * @desc Get all activity logs (Admin only)
 * @route GET /api/activity-logs
 * @access Admin
 */
exports.getAllActivityLogs = async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await User.findById(adminId);

    if (!admin || !admin.roles.some(r => ["Admin", "Trainer"].includes(r))) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Only admins can view all activity logs",
        data: null,
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const totalLogs = await ActivityLog.countDocuments();

    const logs = await ActivityLog.find()
      .populate("user", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "All activity logs fetched successfully",
      data: logs,
      totalPages: Math.ceil(totalLogs / limit),
      currentPage: page,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

/**
 * @desc Get activity logs by a specific user (Admin/Trainer only)
 * @route GET /api/activity-logs/user/:userId
 * @access Admin, Trainer
 */
exports.getActivityLogsByUser = async (req, res) => {
  try {
    const adminId = req.user.id;
    const requestedUserId = req.params.userId;

    const admin = await User.findById(adminId);
    if (!admin || !admin.roles.some(r => ["Admin", "Trainer"].includes(r))) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Only admins or trainers can view user activity logs",
        data: null,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(requestedUserId)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid user ID",
        data: null,
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const totalLogs = await ActivityLog.countDocuments({ user: requestedUserId });

    const logs = await ActivityLog.find({ user: requestedUserId })
      .populate("user", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "User activity logs fetched successfully",
      data: logs,
      totalPages: Math.ceil(totalLogs / limit),
      currentPage: page,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

/**
 * @desc Delete all activity logs (Admin only)
 * @route DELETE /api/activity-logs
 * @access Admin
 */
exports.deleteAllActivityLogs = async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await User.findById(adminId);

    if (!admin || !admin.roles.includes("Admin")) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Only admins can delete activity logs",
        data: null,
      });
    }

    await ActivityLog.deleteMany();

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "All activity logs deleted successfully",
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};
