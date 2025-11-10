const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth')
const multer = require('multer');
const { uploadToS3Middleware } = require('../middleware/uploadToS3');
const { submitkyc, getKYC, updateKYC } = require('../controllers/kycController');
const upload = multer({ storage: multer.memoryStorage() });

const validateKYCRequest = (req, res, next) => {
  console.log("rr",req.body)
  if (!req.body.email) {
    return res.status(400).json({
      success: false,
      message: "Complete your profile before submitting KYC.",
    });
  }
  next(); 
};


router.post('/submit', auth,
  upload.fields([
    { name: "docPhoto", maxCount: 10 },
    { name: "licenceFile", maxCount: 1 },
  ]),
  validateKYCRequest,
  uploadToS3Middleware("docPhoto", "licenceFile"),
  submitkyc);

router.get("/getkyc", auth, getKYC);

router.put(
  "/editkyc",
  auth,
  upload.fields([
    { name: "docPhoto", maxCount: 5 },
    { name: "licenceFile", maxCount: 1 },
  ]),
  uploadToS3Middleware("docPhoto", "licenceFile"),
  updateKYC
);
router.patch(
  "/editkyc",
  auth,
  upload.fields([
    { name: "docPhoto", maxCount: 5 },
    { name: "licenceFile", maxCount: 1 },
  ]),
  uploadToS3Middleware("docPhoto", "licenceFile"),
  updateKYC
);

module.exports = router;