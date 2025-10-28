const express = require('express');
const router = express.Router();
const { createAssignment, getAllAssignments, getAssignment, updateAssignment, deleteAssignment } = require('../controllers/assignmentController');
const auth = require('../middleware/auth');

router.post('/', auth, createAssignment);
router.get('/', getAllAssignments);
router.get('/:id', getAssignment);
router.put('/:id', auth, updateAssignment);
router.delete('/:id', auth, deleteAssignment);

module.exports = router;