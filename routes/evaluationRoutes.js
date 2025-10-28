const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const {
getTemplate,
saveEvaluation,
listPending,
listResults,
} = require('../controllers/evaluationController');

router.get('/template', auth, getTemplate);

router.post('/', auth, saveEvaluation);

router.get('/pending', auth, listPending);

router.get('/results', auth, listResults);

module.exports = router;