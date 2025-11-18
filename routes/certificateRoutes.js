const express = require("express");
const router = express.Router();
const { issueCertificate, getUserCertificates, getUserCertificateByCourse } = require("../controllers/certificateController");
const auth = require("../middleware/auth");

router.post("/issue", auth, issueCertificate);

router.get("/mine", auth, getUserCertificates);

router.get("/mine/:courseId", auth, getUserCertificateByCourse);

module.exports = router;
