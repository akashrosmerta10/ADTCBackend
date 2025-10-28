const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth'); 
const { book, cancel, mySchedule, rescheduleBooking } = require('../controllers/bookingController');


router.post('/', auth, book);

router.post('/:id/cancel', auth, cancel);

router.get('/me', auth, mySchedule);

router.post('/:id/reschedule', auth, rescheduleBooking);

module.exports = router;