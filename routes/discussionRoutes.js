const express = require('express');
const router = express.Router();
const { createDiscussion, getAllDiscussions, getDiscussion, updateDiscussion, deleteDiscussion } = require('../controllers/discussionController');
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/authMiddleware');

router.get('/', getAllDiscussions);
router.get('/:id', getDiscussion);
router.delete('/:id', auth, deleteDiscussion);
router.put('/:id', auth, updateDiscussion);
router.post('/', auth, createDiscussion);

module.exports = router;