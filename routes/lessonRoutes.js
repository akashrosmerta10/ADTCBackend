const express = require('express');
const router = express.Router();
const {getLessonsByCourseId} = require('../controllers/lessonController');

router.get('/', getLessonsByCourseId);

module.exports = router;