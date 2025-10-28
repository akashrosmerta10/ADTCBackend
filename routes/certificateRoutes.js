const express = require('express');
const router = express.Router();
const { createCertificate, getAllCertificates, getCertificate, updateCertificate, deleteCertificate } = require('../controllers/certificateController');
const auth = require('../middleware/auth');

router.post('/', auth, createCertificate);
router.get('/', auth, getAllCertificates);
router.get('/:id', auth, getCertificate);
router.put('/:id', auth, updateCertificate);
router.delete('/:id', auth, deleteCertificate);

module.exports = router;