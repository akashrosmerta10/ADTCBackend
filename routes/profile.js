const express = require('express');
const router = express.Router();
const { createProfile, getProfile, updateProfile, deleteProfile, changePassword, saveOnBoardData, checkEmailExists } = require('../controllers/profileController');
const auth = require('../middleware/auth');
const multer = require('multer');
const User = require("../models/User");
const { uploadToS3Middleware } = require('../middleware/uploadToS3');



const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single("profilePhoto"), uploadToS3Middleware('profile'), auth,createProfile); 

router.get('/myProfile',auth, getProfile);
router.put('/change-password/password', changePassword);
router.put('/update', upload.single("profilePhoto"), uploadToS3Middleware('profile'),  auth, updateProfile);

router.post('/check-email', auth, checkEmailExists)

router.delete('/delete', auth, deleteProfile);

module.exports = router;
