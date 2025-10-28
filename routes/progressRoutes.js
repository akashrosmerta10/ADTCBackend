const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const { getMe, recomputeForUser } = require('../controllers/progressController');

router.get('/me', auth, getMe);
router.post('/recompute/:userId', auth, recomputeForUser);

module.exports = router;