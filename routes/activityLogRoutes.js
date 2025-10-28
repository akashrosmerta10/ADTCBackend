const express = require("express");
const {
  getAllActivityLogs,
  getActivityLogsByUser,
  deleteAllActivityLogs,
  createActivityLog,
} = require("../controllers/activityLogController.js");

const auth = require("../middleware/auth");

const router = express.Router();


router.get("/admin/activity-logs", auth, getAllActivityLogs);
router.delete("/admin/activity-logs", auth, deleteAllActivityLogs);

router.get("/user/:id", auth, getActivityLogsByUser);
router.post("/create", auth, createActivityLog);

module.exports = router;
