const express = require("express");
const router = express.Router();

const { createComment, getCommentsByModule, updateComment, deleteComment, addReply, likeComment, getAllComments, getCommentThread } = require('../controllers/commentsController');
const auth = require("../middleware/auth");

router.post('/reply', auth, addReply);

router.post('/', auth, createComment);

router.get('/all', getAllComments)

router.get('/thread/:commentId', getCommentThread)

router.get('/:moduleId', getCommentsByModule);

router.put('/:commentId', auth, updateComment);

router.delete('/:commentId', auth, deleteComment);

router.put('/:commentId/like', auth, likeComment);

module.exports = router;
