const express = require('express');
const router = express.Router();
const { createSupportTicket, getAllSupportTickets, getSupportTicket, updateSupportTicket, deleteSupportTicket } = require('../controllers/supportTicketController');
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/authMiddleware');

router.get('/', auth, getAllSupportTickets);
router.get('/:id', auth, getSupportTicket);
router.delete('/:id', auth, deleteSupportTicket);
router.put('/:id', auth, updateSupportTicket);
router.post('/', auth, createSupportTicket);

module.exports = router;