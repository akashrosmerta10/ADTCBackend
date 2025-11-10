// utils/activityLogger.js
const ActivityLog = require("../models/ActivityLogs");
const UAParser = require("ua-parser-js");

/**
 * Logs user activity across the app.
 * 
 * @param {Object} options
 * @param {string} [options.userId] - MongoDB ObjectId of the user performing the action
 * @param {string} options.activityType - Type of activity (must match enum in schema)
 * @param {Object} [options.metadata={}] - Additional info (optional)
 * @param {Object} [options.req] - Optional Express request to extract IP, browser, OS, device
 */
async function logUserActivity({ userId, activityType, metadata = {}, req }) {
  try {
    if (!activityType) {
      console.warn("[ActivityLogger] Missing required field: activityType");
      return;
    }

    // Extract IP and device info if `req` is provided
    let ip = "Unknown";
    let browser = "Unknown";
    let os = "Unknown";
    let device = "desktop";

    if (req) {
      ip =
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        "Unknown";

      const parser = new UAParser(req.headers["user-agent"]);
      const ua = parser.getResult();
      browser = ua.browser?.name || "Unknown";
      os = ua.os?.name || "Unknown";
      device = ua.device?.type || "desktop";
    }

    const log = new ActivityLog({
      user: userId || null,
      activityType,
      metadata: {
        ...metadata,
        ip,
        browser,
        os,
        device,
      },
    });

    await log.save();
    // console.log(`[ActivityLogger] ${activityType} logged for user: ${userId || "Guest"}`);
    return log;
  } catch (error) {
    console.error("[ActivityLogger] Failed to log activity:", error);
  }
}

module.exports = { logUserActivity };
