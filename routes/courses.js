const express = require('express');
const router = express.Router();
const { createCourse, getAllCourses, getCourse, updateCourse, deleteCourse, filteredCourses, getTopCategory } = require('../controllers/courseController');
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/authMiddleware');
const { uploadToS3Middleware } = require('../middleware/uploadToS3');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/filter', filteredCourses);
router.get('/', getAllCourses);
router.get('/:id', getCourse);
router.get('/dashboard/top-categories', getTopCategory);


router.post(
  '/',
  upload.single('image'),                     
  uploadToS3Middleware('courses'),        
  createCourse                               
);
router.put(
  '/:id',
  upload.single('image'),
  uploadToS3Middleware('courses'),
  updateCourse
);

router.delete('/:id', deleteCourse);

module.exports = router;