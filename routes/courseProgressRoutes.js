const express = require("express");

const router = express.Router();

const {createProgress, getCourseProgress, UpdateModuleProgress, getAverageProgressPerUser} = require('../controllers/courseProgressController');

const auth = require("../middleware/auth");


router.post("/", auth, createProgress);
router.get("/avgProgress", auth, getAverageProgressPerUser)
router.get("/:courseId", auth, getCourseProgress);
router.patch("/module", auth, UpdateModuleProgress);


module.exports = router;