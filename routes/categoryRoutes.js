const express = require('express');
const router = express.Router();
const {createCategory, getAllCategory, getCategory, updateCategory, deleteCategory} = require('../controllers/categoryController');
const { uploadToS3Middleware } = require('../middleware/uploadToS3');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });


router.get('/', getAllCategory);
router.post('/', upload.single("categoryImage"), uploadToS3Middleware("categoryImage"), createCategory);
router.get('/:id', getCategory);
router.put('/:id',upload.single("categoryImage"), uploadToS3Middleware("categoryImage"), updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;