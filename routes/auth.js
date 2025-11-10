const express = require('express');
const router = express.Router();

const { requestOTP, verifyOTP, resendOTP, updateUserDetails, signup, login ,createAdmin, forgotPassword, resetPassword, validateusertoken, validateadmintoken, logout, requestEmailOTP, verifyEmailOTP, resendEmailOTP } = require('../controllers/authController');

const auth = require('../middleware/auth');

//const roleAuth = require('../middleware/roleAuth');

//router.post('/register', register);
//router.post('/', auth, roleAuth('Admin', 'Content Creator'), createCourse);
//router.get('/', getAllCourses);
//router.get('/:id', getCourse);
//router.put('/:id', auth, roleAuth('Admin', 'Content Creator'), updateCourse);
//router.delete('/:id', auth, roleAuth('Admin'), deleteCourse);

router.post('/request-otp', requestOTP);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);

router.post('/request-email-otp',auth,  requestEmailOTP);
router.post('/verify-email-otp',auth, verifyEmailOTP);
router.post('/resend-email-otp', auth, resendEmailOTP)


// router.get("/validate", auth, validateusertoken);
// router.get("/validateadmin", auth, validateadmintoken);
//router.post('/update-user-details', auth, updateUserDetails);
router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/logout", logout);
// router.post('/create-admin', createAdmin);

module.exports = router;