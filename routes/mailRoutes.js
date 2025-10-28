const express = require('express');
const router = express.Router();
const { sendMail } = require('../controllers/mailController');


router.post('/', sendMail);

module.exports = router;
