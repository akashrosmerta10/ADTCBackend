const User = require('../models/User');
const bcrypt = require('bcryptjs');
const path = require('path');
const { getSignedImageUrl, deleteFromS3 } = require('../middleware/uploadToS3');
const { logUserActivity } = require("../utils/activityLogger");
const OnBoardData = require("../models/OnBoardData");
const errorResponse = require('../utils/errorResponse');


exports.createProfile = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, alternatePhoneNumber, email, password, roles } = req.body;
    const profilePhoto = req.body.profilePhoto || null;
    const existingUser = await User.findOne({
      $or: [{ email: email }, { phoneNumber: phoneNumber }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "User with this email or phone number already exists.",
        data: null,
      });
    }

    const hashedPassword = await bcrypt.hash(password || '123456', 10);
    const userRoles = roles && Array.isArray(roles) ? roles : ["User"];

    const newUser = new User({
      firstName,
      lastName,
      phoneNumber: phoneNumber || "1111111111",
      alternatePhoneNumber: alternatePhoneNumber || null,
      email,
      password: hashedPassword,
      profilePhoto,
      roles: userRoles
    });


    await newUser.save();

await logUserActivity({
  userId: newUser._id,
  activityType: "USER_CREATED",
  metadata: { note: "New user profile created by admin" },
  req,
});


    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "User profile created successfully",
      data: { _id: newUser._id },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found.",
        data: null,
      });
    }

    let signedUrl = null;
    if (user.profilePhoto) {
      try {
        signedUrl = await getSignedImageUrl(user.profilePhoto);
      } catch (error) {
        console.error("Error fetching signed URL:", error.message);
        signedUrl = null;
      }
    }
    const isProfileCompleted = Boolean(
      user.firstName &&
      user.lastName &&
      user.email
    );

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "User profile fetched successfully",
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        alternatePhoneNumber: user.alternatePhoneNumber || null,
        email: user.email,
        roles: user.roles,
        profilePhoto: signedUrl || null,
        dob: user.dob,
        emailVerified: user.emailVerified,
        isProfileCompleted,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    let {
      firstName,
      lastName,
      email,
      phoneNumber,
      alternatePhoneNumber,
      roles,
      removeProfilePhoto,
      profilePhoto,
      receiveUpdates,

      hasLicense,
      licenseType,
      achievingGoals,
      yearsExperience,
      learningObjectives,
      areasOfInterest,
    } = req.body;

    removeProfilePhoto = removeProfilePhoto === "true";
    receiveUpdates = receiveUpdates === "true";

    if (roles) {
      try {
        roles = typeof roles === "string" ? JSON.parse(roles) : roles;
      } catch {
        roles = [roles];
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found.",
        data: null,
      });
    }

    const capitalize = (str) =>
      typeof str === "string" ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str;

    if (removeProfilePhoto && user.profilePhoto) {
      await deleteFromS3(user.profilePhoto);
      user.profilePhoto = null;
    } else if (profilePhoto) {
      user.profilePhoto = profilePhoto;
    }

    if (firstName) user.firstName = capitalize(firstName);
    if (lastName) user.lastName = capitalize(lastName);
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (alternatePhoneNumber) user.alternatePhoneNumber = alternatePhoneNumber;
    if (email) user.email = email;

    if (roles?.length) {
      const allowedRoles = ["Supervisor", "opsmanager", "centerhead", "User", "Trainer", "Learner", "Admin"];
      user.roles = roles.filter(r => allowedRoles.includes(r));
    }

    if (receiveUpdates !== undefined) user.receiveUpdates = receiveUpdates;

    const hasIdentity = Boolean(user.firstName && user.lastName && user.email);
    if (hasIdentity && !user.completedAt) user.completedAt = new Date();

    await user.save();

    let existingOnboard = await OnBoardData.findOne({ userId });

    if (typeof licenseType === "string") licenseType = JSON.parse(licenseType);
    if (typeof learningObjectives === "string") learningObjectives = JSON.parse(learningObjectives);
    if (typeof areasOfInterest === "string") areasOfInterest = JSON.parse(areasOfInterest);
    if (typeof achievingGoals === "string") achievingGoals = JSON.parse(achievingGoals);

    let onboardData;
    if (existingOnboard) {
      existingOnboard.hasLicense = hasLicense ?? existingOnboard.hasLicense;
      existingOnboard.licenseType = licenseType ?? existingOnboard.licenseType;
      existingOnboard.achievingGoals = achievingGoals ?? existingOnboard.achievingGoals;
      existingOnboard.yearsExperience = yearsExperience ?? existingOnboard.yearsExperience;
      existingOnboard.learningObjectives = learningObjectives ?? existingOnboard.learningObjectives;
      existingOnboard.areasOfInterest = areasOfInterest ?? existingOnboard.areasOfInterest;

      await existingOnboard.save();
      onboardData = existingOnboard;
    } else {
      onboardData = await OnBoardData.create({
        userId,
        hasLicense,
        achievingGoals,
        licenseType,
        yearsExperience,
        learningObjectives: learningObjectives || [],
        areasOfInterest: areasOfInterest || [],
      });
    }

await logUserActivity({
  userId,
  activityType: "PROFILE_UPDATE",
  metadata: { note: "User updated profile and onboarding data" },
  req,
});


    return res.status(200).json({
      success: true,
      message: "Profile and onboarding data updated successfully",
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          alternatePhoneNumber: user.alternatePhoneNumber || null,
          email: user.email,
          roles: user.roles,
          profilePhoto: user.profilePhoto,
          dob: user.dob,
          receiveUpdates: user.receiveUpdates,
          completedAt: user.completedAt,
        },
        onboardData,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};


exports.changePassword = async (req, res) => {
  try {
    const { password, newPassword } = req.body;
    const userId = req.user.id;

    if (!password || !newPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, statusCode: 404, message: "User not found." });
    }

    if (password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, statusCode: 400, message: "Current password is incorrect." });
      }
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

await logUserActivity({
  userId,
  activityType: "PASSWORD_CHANGED",
  metadata: { note: "User changed their password" },
  req,
});



    res.status(200).json({ success: true, statusCode: 200, message: "Password updated successfully." });
  } catch (error) {
    return errorResponse(res, error)
  }
};

exports.deleteProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
        data: null,
      });
    }

    await User.deleteOne({ _id: userId });

  await logUserActivity({
  userId,
  activityType: "USER_DELETED",
  metadata: { note: "User deleted their own profile" },
  req,
});


    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "User profile deleted successfully",
      data: { userId: userId },
    });
  } catch (error) {
    return errorResponse(res, error)
  }
};

exports.checkEmailExists = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!userId) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
        data: null,
      });
    }

    console.log("user", user)
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Email is required.",
      });
    }
    const existingUser = await User.findOne({ email });
    return res.status(200).json({
      success: true,
      exists: !!existingUser,
      message: existingUser ? "Email already exists." : "Email is available.",
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};
