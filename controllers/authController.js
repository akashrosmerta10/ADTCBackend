const jwt = require("jsonwebtoken");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { sendEmailOTP } = require("./mailController");
const errorResponse = require("../utils/errorResponse");
const axios = require("axios");
const { logUserActivity } = require("../utils/activityLogger");


const generateOTP = () => {
  const developmentEnv = "dev";
  if (developmentEnv === "dev") {
    return "123456";
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
};
const sendOTP = async (phoneNumber, otp) => {
  console.log(`Sending OTP ${otp} to ${phoneNumber}`);
};
const sendEOTP = async (email, otp) => {
  console.log(`Sending OTP ${otp} to ${email}`);
};

exports.requestOTP = async (req, res) => {
  try {
    const { phoneNumber, portal, token } = req.body;
     const captchaRes = await axios.post(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    })
  );

  if (!captchaRes.data.success) {
    return res.status(400).json({ message: "Captcha verification failed" });
  }
 

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Phone number is required",
        data: null,
      });
    }

    if (phoneNumber.length !== 10) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid mobile number. Must be 10 digits.",
        data: null,
      });
    }

    let user = await User.findOne({ phoneNumber });

    if (!user && portal !== "admin") {
      user = new User({
        phoneNumber,
        roles: ["User", "Learner"],
        status: "inactive",
      });
      await user.save();
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
        data: null,
      });
    }

    if (
      portal === "admin" &&
      !user.roles.some((role) =>
        ["Admin", "Supervisor", "opsmanager", "centerhead", "Trainer"].includes(
          role
        )
      )
    ) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Not authorized for admin portal",
        data: null,
      });
    }

    const otp = generateOTP();
    user.encryptedOTP = await bcrypt.hash(otp, await bcrypt.genSalt(10));
    user.otpTimestamp = new Date();
    await user.save();

    try {
      await sendOTP(phoneNumber, otp);
    } catch (err) {
      console.error("OTP sending failed:", sendErr.message);
      return res.status(500).json({
        success: false,
        statusCode: 500,
        message: "Failed to send OTP",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "OTP sent successfully",
      data: { phoneNumber, portal },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { phoneNumber, otp, portal } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "OTP is required",
        data: null,
      });
    }
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Phone number is required",
        data: null,
      });
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
        data: null,
      });
    }

    if (
      portal === "admin" &&
      !user.roles.some((r) =>
        ["Admin", "Supervisor", "opsmanager", "centerhead", "Trainer"].includes(
          r
        )
      )
    ) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Not authorized for admin portal",
        data: null,
      });
    }
    if (!user.encryptedOTP || !user.otpTimestamp) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "OTP not requested or expired",
        data: null,
      });
    }

    const isValidOTP = await bcrypt.compare(otp, user.encryptedOTP);
    const timeDiff =
      (Date.now() - new Date(user.otpTimestamp).getTime()) / (1000 * 60);

    if (!isValidOTP || timeDiff > 3) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid or expired OTP",
        data: null,
      });
    }

    user.encryptedOTP = null;
    user.otpTimestamp = null;
    if (user.status === "inactive") user.status = "active";
    user.updatedAt = new Date();
    await user.save();

    const isProfileCompleted =
      !!user.email && !!user.phoneNumber && !!user.firstName && !!user.lastName;

    const payload = {
      user: {
        id: user._id,
        roles: user.roles,
        phoneNumber: user.phoneNumber,
      },
    };

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET not set in env");
      return res.status(500).json({
        success: false,
        statusCode: 500,
        message: "Server misconfigured",
        data: null,
      });
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "8h",
    });

    await logUserActivity({
      userId: user._id,
      activityType: "LOGIN",
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        note: "OTP verified and user logged in",
        method: "OTP",
      },
      req,
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "OTP verified successfully",
      data: {
        phoneNumber: user.phoneNumber,
        roles: user.roles,
        status: user.status,
        token,
        isProfileCompleted,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.resendOTP = async (req, res) => {
  try {
    const { phoneNumber, portal } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
        data: null,
      });
    }

    if (
      portal === "admin" &&
      !user.roles.some((r) =>
        ["Admin", "Supervisor", "opsmanager", "centerhead", "Trainer"].includes(
          r
        )
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized for admin portal",
      });
    }

    const otp = generateOTP();
    user.encryptedOTP = await bcrypt.hash(otp, await bcrypt.genSalt(10));
    user.otpTimestamp = new Date();
    await user.save();

    await sendOTP(phoneNumber, otp);

    await logUserActivity({
      userId: user._id,
      activityType: "OTP_RESEND",
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        note: "User requested OTP resend",
      },
      req,
    });


    return res.status(200).json({
      success: true,
      message: "OTP resent successfully",
      data: {
        phoneNumber: user.phoneNumber,
        portal: portal,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.signup = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phoneNumber,
      email,
      password,
      confirmPassword,
      roles,
    } = req.body;

    const allowedRoles = [
      "Supervisor",
      "opsmanager",
      "centerhead",
      "User",
      "Admin",
      "Trainer",
    ];

    const normalizedRole = roles?.trim();

    if (!normalizedRole || !allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        success: true,
        statusCode: 400,
        message: "Invalid role selected",
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: true,
        statusCode: 400,
        message: "Passwords do not match.",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email || null }, { phoneNumber: phoneNumber || null }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: true,
        statusCode: 400,
        message: "Email or phone number already in use.",
      });
    }
    if (
      ["Supervisor", "opsmanager", "centerhead", "Admin"].includes(
        normalizedRole
      )
    ) {
      if (!password) {
        return res.status(400).json({
          success: true,
          statusCode: 400,
          message: "Password is required.",
        });
      }
    }

    const newUser = new User({
      firstName,
      lastName,
      phoneNumber,
      email,
      roles: [normalizedRole],
      status: "inactive",
      password,
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, roles: newUser.roles },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    await logUserActivity({
      userId: newUser._id,
      activityType: "USER_CREATED",
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        note: `${newUser.roles[0]} registered successfully`,
      },
      req,
    });


    res.status(201).json({
      success: true,
      statusCode: 201,
      message: "registered successfully!",
      data: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        roles: newUser.roles,
      },
      token: token,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.login = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Phone number and password are required.",
      });
    }
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "User not found. Please sign up first.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid credentials.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid credentials.",
      });
    }

    const allowedRoles = ["Admin", "Supervisor", "opsmanager", "centerhead"];
    const hasAccess = user.roles.some((role) => allowedRoles.includes(role));
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "You are not authorized to log in to this portal.",
      });
    }

    const payload = {
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        roles: user.roles,
      },
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "8h",
    });

    await logUserActivity({
      userId: user._id,
      activityType: "LOGIN",
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        method: "PASSWORD",
        note: "User logged in via password",
      },
      req,
    });


    res.status(200).json({
      statusCode: 200,
      message: "Login successful!",
      success: true,
      data: payload,
      token: token,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = generateResetToken(email);
    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    await sendResetEmail(email, resetLink);

    res.status(200).json({ message: "Reset link sent to your email" });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  try {
    const { email } = verifyResetToken(token);

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// exports.logout = (req, res) => {
//   res.clearCookie("authToken", {
//     httpOnly: true,
//     secure: false,
//     sameSite: "lax",
//     path: "/",
//   });

//   return res.status(200).json({
//     success: true,
//     message: "Logged out successfully",
//     role: req.user?.admin?.roles?.[0] || req.user?.roles?.[0]
//   });
// };
const tokenBlacklist = new Set();

exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      tokenBlacklist.add(token);
    }

    await logUserActivity({
      userId: req.user?.id,
      activityType: "LOGOUT",
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        note: "User logged out",
      },
      req,
    });


    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Logged out successfully",
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};


exports.requestEmailOTP = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, statusCode: 401, message: "Unauthorized", data: null });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, statusCode: 400, message: "Email is required", data: null });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, statusCode: 404, message: "User not found", data: null });
    }

    user.pendingEmail = email;

    const otp = generateOTP();

    user.emailEncryptedOTP = await bcrypt.hash(otp, await bcrypt.genSalt(10));
    user.emailOtpTimestamp = new Date();
    await user.save();

    try {
      await sendEmailOTP({ to: email, otp });
    } catch (err) {
      return res.status(500).json({ success: false, statusCode: 500, message: "Failed to send email OTP", data: null });
    }

    await logUserActivity({
      userId: user._id,
      activityType: "EMAIL_OTP_SENT",
      metadata: { email },
      req,
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Email OTP sent successfully",
      data: { email },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.verifyEmailOTP = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { email, otp } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, statusCode: 401, message: "Unauthorized", data: null });
    }
    if (!email) {
      return res.status(400).json({ success: false, statusCode: 400, message: "Email is required", data: null });
    }
    if (!otp) {
      return res.status(400).json({ success: false, statusCode: 400, message: "OTP is required", data: null });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, statusCode: 404, message: "User not found", data: null });
    }

    if (!user.emailEncryptedOTP || !user.emailOtpTimestamp) {
      return res.status(400).json({ success: false, statusCode: 400, message: "OTP not requested or expired", data: null });
    }

    if (user.pendingEmail && user.pendingEmail !== email) {
      return res.status(400).json({ success: false, statusCode: 400, message: "Email does not match pending email", data: null });
    }

    const isValidOTP = await bcrypt.compare(otp, user.emailEncryptedOTP);
    const minutes = (Date.now() - new Date(user.emailOtpTimestamp).getTime()) / 60000;
    if (!isValidOTP || minutes > 5) {
      return res.status(400).json({ success: false, statusCode: 400, message: "Invalid or expired OTP", data: null });
    }

    if (user.pendingEmail) {
      user.email = user.pendingEmail;
    }
    user.pendingEmail = null;
    user.emailVerified = true;
    user.emailEncryptedOTP = null;
    user.emailOtpTimestamp = null;
    user.updatedAt = new Date();


    const domain = user.email.split("@")[1];
   const freeDomains = process.env.FREE_DOMAINS.split(",");

    if (freeDomains.includes(domain)) {
      user.freeDomainUser = true;
    }

    await user.save();

    await logUserActivity({
      userId: user._id,
      activityType: "EMAIL_VERIFIED",
      metadata: { email: user.email },
      req,
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Email verified successfully",
      data: { emailVerified: true, email: user.email, freeDomainUser: user.freeDomainUser || false  },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};


exports.resendEmailOTP = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { email } = req.body || {};

    if (!userId) {
      return res.status(401).json({ success: false, statusCode: 401, message: "Unauthorized", data: null });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, statusCode: 404, message: "User not found", data: null });
    }

    let targetEmail = user.pendingEmail;
    if (!targetEmail && email) {
      targetEmail = email;
      user.pendingEmail = email;
    }

    if (!targetEmail) {
      return res.status(400).json({ success: false, statusCode: 400, message: "No email to send OTP to", data: null });
    }

    const now = Date.now();
    const last = user.emailOtpTimestamp ? new Date(user.emailOtpTimestamp).getTime() : 0;
    const secondsSinceLast = (now - last) / 1000;
    if (secondsSinceLast < 60) {
      return res.status(429).json({
        success: false,
        statusCode: 429,
        message: `Please wait ${Math.ceil(60 - secondsSinceLast)} seconds before requesting another OTP`,
        data: null,
      });
    }

    const otp = generateOTP();
    user.emailEncryptedOTP = await bcrypt.hash(otp, await bcrypt.genSalt(10));
    user.emailOtpTimestamp = new Date();
    await user.save();

    await sendEmailOTP({ to: targetEmail, otp });

    await logUserActivity({
      userId: user._id,
      activityType: "EMAIL_OTP_RESEND",
      metadata: { email: targetEmail },
      req,
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Email OTP resent successfully",
      data: { email: targetEmail },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};
