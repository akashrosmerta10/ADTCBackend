const express = require("express");
const router = express.Router();
const {startAssessment, upsertSubmission, getSubmissionByAttempt, listSubmissions, latestByModule, finalUnlock, startFinal, courseModuleStats, courseStats, getLatestFinal, getCourseAssessmentCard } = require("../controllers/assessmentSubmissionController");
const auth = require("../middleware/auth");


router.post("/start", auth, startAssessment)
router.post("/start-final", auth, startFinal)

router.post("/submissions", auth, upsertSubmission);

router.get("/latest-by-module", auth, latestByModule);
router.get("/submissions/:attemptId", auth, getSubmissionByAttempt);

router.get("/submissions", auth, listSubmissions);

router.get("/unlock-final", auth, finalUnlock);

router.get("/course-module-stats", auth, courseModuleStats);

router.get("/course-stats", auth, courseStats);

router.get("/get-latest-final", auth, getLatestFinal);

router.get ("/assessment-card", auth, getCourseAssessmentCard);

module.exports = router;
