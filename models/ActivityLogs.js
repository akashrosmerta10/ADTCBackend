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
      "SIGNUP",
      "LOGIN_ATTEMPT",
      "PASSWORD_RESET",
      "PROFILE_UPDATED",
      "COURSE_PURCHASED",
      "OTHER",
      "NEW_USER_CREATION",
      "ADDRESS_UPDATED",
      "RATING",
      "RATING_DELETED",
      "COURSE_ADDED_TO_WISHLIST",
      "COURSE_REMOVED_FROM_WISHLIST",
      "COURSE_ADDED_TO_CART",
      "COURSE_REMOVED_FROM_CART",
      "CART_CLEARED",
      "OTP_RESEND",
      
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
