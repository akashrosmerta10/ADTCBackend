const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const { openSheet, mark, finalize } = require('../controllers/attendanceController');

router.post('/:sessionId/open', auth, openSheet);


router.post('/:sessionId/mark', auth, mark);


router.post('/:sessionId/finalize', auth, finalize);

module.exports = router;