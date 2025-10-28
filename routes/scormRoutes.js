const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { saveProgress, getProgress, restoreProgressHandler } = require('../controllers/scormController');

router.post('/save-progress', auth, saveProgress);

router.get('/progress', auth, getProgress);

module.exports = router;
