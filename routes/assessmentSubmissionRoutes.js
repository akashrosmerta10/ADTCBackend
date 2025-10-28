const express = require("express");
const router = express.Router();
const {upsertSubmission, getSubmissionByAttempt, listSubmissions, latestByModule, finalUnlock } = require("../controllers/assessmentSubmissionController");
const auth = require("../middleware/auth");

router.post("/submissions", auth, upsertSubmission);

router.get("/submissions/:attemptId", auth, getSubmissionByAttempt);

router.get("/submissions", auth, listSubmissions);


router.get("/latest-by-module", auth, latestByModule);
router.get("/unlock-final", auth, finalUnlock);

module.exports = router;
