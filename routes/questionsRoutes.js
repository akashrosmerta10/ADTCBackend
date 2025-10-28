
const express = require("express");
const router = express.Router();
const {createQuestion, listQuestions, getQuestion, updateQuestion, deleteQuestion} = require("../controllers/questionController");
const auth = require("../middleware/auth");
const { uploadToS3Middleware } = require('../middleware/uploadToS3');
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", auth, upload.single("questionimage"), uploadToS3Middleware("questionimage"), createQuestion);
router.get("/", auth, listQuestions);
router.get("/:id", auth, getQuestion);
router.put("/:id", auth, upload.single("questionimage"), uploadToS3Middleware("questionimage"), updateQuestion);
router.delete("/:id", auth, deleteQuestion);

module.exports = router;
