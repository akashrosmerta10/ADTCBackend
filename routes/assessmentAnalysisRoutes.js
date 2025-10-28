const express = require("express");
const router = express.Router();
const {getDashboardStats, getTraineeProgress} = require("../controllers/assessmentAnalysis");
const auth = require("../middleware/auth");

router.get("/stats", auth, getDashboardStats);
router.get("/trainee-progress", auth, getTraineeProgress);

module.exports = router;
