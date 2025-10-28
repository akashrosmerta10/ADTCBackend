
const express = require("express");
const router = express.Router();
const { getAllGrading } = require("../controllers/gradeController");

router.get("/", getAllGrading);

module.exports = router;