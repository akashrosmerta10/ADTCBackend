const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  activityType: {
    type: String,
    enum: [
      "LOGIN",
      "LOGOUT",
      "USER_CREATED",
      "USER_DELETED",
      "PROFILE_UPDATE",
      "PASSWORD_CHANGED",
      "OTP_RESEND",
      "COURSE_ADDED_TO_CART",
      "COURSE_REMOVED_FROM_CART",
      "COURSE_PURCHASED",
      "LESSON_COMPLETED",
      "QUIZ_ATTEMPTED",
      "CART_CLEARED",
      "CART_SUMMARY_VIEWED",
      "PURCHASE",
      "COURSE_COMPLETED",
      "COURSE_PROGRESS_INITIALIZED",
      "KYC_SUBMITTED",
      "KYC_UPDATED",
      "KYC_VIEWED",
      "RATING_CREATED",
      "RATING_UPDATED",
      "RATING_DELETED",
      "RATING_VIEWED",
      "SCORM_PROGRESS_SAVED",
      "SCORM_PROGRESS_VIEWED",
      "COURSE_PROGRESS_UPDATED",
      "VIDEO_PROGRESS_UPDATED",
      "COURSE_ADDED_TO_WISHLIST",
      "COURSE_REMOVED_FROM_WISHLIST",
      "WISHLIST_VIEWED",
      "OTHER"

    ],

    required: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ActivityLog", activityLogSchema);
