const express = require('express');
const router = express.Router();
const { createModule, getAllModules, getModule, updateModule, deleteModule, getModuleQuestions } = require('../controllers/moduleController');
const auth = require('../middleware/auth');

router.post('/', createModule);
router.get('/', getAllModules);
router.get('/:id', getModule);
router.put('/:id',  updateModule);
router.delete('/:id', deleteModule);
router.get("/:id/questions", auth, getModuleQuestions);

module.exports = router;