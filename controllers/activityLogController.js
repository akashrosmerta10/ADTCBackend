const ActivityLog = require("../models/ActivityLogs");
const User = require("../models/User");
const mongoose = require("mongoose");
const UAParser = require("ua-parser-js");
const errorResponse = require("../utils/errorResponse");

exports.logActivity = async (
  userId,
  activityType,
  metadata = {}
) => {
  try {
    const log = new ActivityLog({
      user: userId,
      activityType,
      metadata,
    });

    await log.save();
    return {
      success: true,
      statusCode: 201,
      message: "Activity logged successfully",
      data: log,
    };
  } catch (error) {
    errorResponse(res, error);
  }
};


exports.getAllActivityLogs = async (req, res) => {
  try {
    const { userId } = req.query;

    const filter = userId && mongoose.Types.ObjectId.isValid(userId)
      ? { user: userId }
      : {};

    const data = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .populate("user", "firstName lastName email");

   res.status(200).json({
  success: true,
  statusCode: 200,
  message: "Activity logs fetched successfully",
  data: logs,
});

  } catch (error) {
   errorResponse(res, error);
  }
};

exports.getActivityLogsByUser = async (req, res) => {
  try {
    const adminId = req.user.id; 
    const requestedUserId = req.params.userId;

    const admin = await User.findById(adminId);
 if (!admin || !admin.roles.some(r => ["Admin", "Trainer"].includes(r))) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Only admins can view activity logs",
        data: null,
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalLogs = await ActivityLog.countDocuments({ user: requestedUserId });

    const logs = await ActivityLog.find({ user: requestedUserId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "firstName lastName email");

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Logs fetched successfully",
      data: logs,
      totalPages: Math.ceil(totalLogs / limit),
      currentPage: page,
    });
  } catch (error) {
    errorResponse(res, error);
  }
};



exports.deleteAllActivityLogs = async (req, res) => {
  try {
    await ActivityLog.deleteMany();
    res.status(200).json({
       success: true, 
      statusCode: 200,
      message: "All logs deleted successfully." 
    });
  } catch (error) {
   errorResponse(res, error);
  }
};

exports.createActivityLog = async (req, res) => {
  try {
    const userId = req.user._id;
    const { activityType, metadata = {} } = req.body;

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      "Unknown";

    const parser = new UAParser(req.headers["user-agent"]);
    const uaResult = parser.getResult();
    const finalMetadata = {
      ...metadata,
      ip,
      browser: uaResult.browser?.name || "Unknown",
      os: uaResult.os?.name || "Unknown",
      device: uaResult.device?.type || "desktop",
    };

    const newLog = await ActivityLog.create({
      user: userId,
      activityType,
      metadata: finalMetadata,
    });

    const { _id: activityId, ...rest } = newLog.toObject();

    const response = { activityId, ...rest };

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "Activity log created successfully",
      data: response,
    });
  } catch (error) {
    return errorResponse(res, error)
  }
};
