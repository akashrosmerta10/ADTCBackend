// middlewares/validateKYCRequest.js

const validateKYCRequest = (req, res, next) => {
  const email = req.body.email || req.user?.email;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Complete your profile before submitting KYC.",
    });
  }

  next();
};

module.exports = validateKYCRequest;
