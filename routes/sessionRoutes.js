const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const {
createSession,
listTrainerCalendar,
listAvailableForTrainee,
updateSession,
setStatus,
stats
} = require('../controllers/sessionController');

router.post('/', auth, createSession);

router.get('/trainer/calendar', auth, listTrainerCalendar);

router.get('/trainee/available', auth, listAvailableForTrainee);

router.patch('/:id', auth, updateSession);

router.post('/:id/status', auth, setStatus);

router.get('/trainer/stats', auth, stats);

module.exports = router;