const express = require("express");

const router = express.Router();

const { createRating, getAllRatings, deleteRating, getRating, updateRating } = require('../controllers/ratingController');

const auth = require("../middleware/auth");

router.post('/', auth, createRating);
router.get('/userRating/:courseId', auth, getRating);
router.get('/:courseId', getAllRatings);
router.put('/:courseId', auth, updateRating);
router.delete('/:ratingId', auth, deleteRating);


module.exports = router;