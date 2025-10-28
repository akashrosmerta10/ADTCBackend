const express = require('express');
const router = express.Router();
const { getTag, createTag, updateTag, deleteTag, getAllTags, getAllFilteredTags } = require('../controllers/tagsController');
const { filteredCourses } = require('../controllers/courseController');


router.get('/', getTag);
router.post('/', createTag);
router.put('/:id', updateTag);
router.delete('/:id', deleteTag);   

router.get('/all', getAllTags);
router.get('/search-all', getAllFilteredTags);

router.get('/:id', filteredCourses);


module.exports = router;