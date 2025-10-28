const express = require("express");
const router = express.Router();
const { getCourseSales } = require("../controllers/analyticController");

router.get("/course-sales", getCourseSales);

module.exports = router;
