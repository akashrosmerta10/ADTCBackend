const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const { createSlots, list, closeSlotLinkSession } = require('../controllers/availabilityController');


router.post('/', auth, createSlots);


router.get('/', auth, list);


router.post('/link', auth, closeSlotLinkSession);

module.exports = router;