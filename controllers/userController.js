const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { getSignedImageUrl, deleteFromS3 } = require('../middleware/uploadToS3');
const ActivityLog = require("../models/ActivityLogs");
const errorResponse = require("../utils/errorResponse");


exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search ? req.query.search.trim() : "";

    // Build search filter
    const searchFilter = search
      ? {
          $or: [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { phoneNumber: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const totalUsers = await User.countDocuments(searchFilter);

    const users = await User.find(searchFilter)
      .populate("courses", "title _id")
      .select("-password -encryptedOTP -otpTimestamp")
      .populate("purchasedCourses", "title")
      .populate("transactions", "amount")
      .skip(skip)
      .limit(limit);

    const formattedUsers = users.map((user) => ({
      ...user.toObject(),
      userType: user.roles === "Admin" ? "admin" : "user",
    }));

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Users fetched successfully",
      data: {
        totalUsers,
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        pageSize: users.length,
        formattedUsers,
      },
    });
  } catch (error) {
    errorResponse(res, error);
  }
};


exports.getUserById = async (req, res) => {
  try {
    const userId = req.user?.id

    const user = await User.findById(userId)
      .select("-password -encryptedOTP -otpTimestamp")
      .populate("purchasedCourses")
      .populate("wishlist", "courses")
      .populate({
        path: "transactions",
        populate: {
          path: "orderId",
          model: "Order",
        },
        options: { strictPopulate: false }
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
      });
    }

    if (user.roles === "Admin") {
      user.transactions = undefined;
    }

    let signedProfilePhoto = null;
    if (user.profilePhoto) {
      signedProfilePhoto = await getSignedImageUrl(user.profilePhoto);
    }



    if (user.purchasedCourses && Array.isArray(user.purchasedCourses)) {
      for (const course of user.purchasedCourses) {
        if (course.image && !course.image.startsWith("http")) {
          course.image = await getSignedImageUrl(course.image);
        }
      }
    }


    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "User fetched successfully",
      data: {
        ...user.toObject(),
        profilePhoto: signedProfilePhoto || null,
      },
    });

  } catch (error) {
    errorResponse(res, error)
  }
};

exports.updateUser = async (req, res) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Unauthorized: No admin info",
      });
    }

    const targetUserId = req.params.id;

    const admin = await User.findById(adminId);
  if (!admin || !admin.roles.some(r => ["Admin", "Trainer", "Supervisor", "opsmanager", "centerhead"].includes(r))) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Only admins can update users",
      });
    }

    const updates = { ...req.body };
    delete updates.password;
    delete updates.encryptedOTP;
    delete updates.otpTimestamp;

    let user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
      });
    }

    const shouldBeAdmin =
      updates.role &&
      ["Admin", "Moderator", "Content Creator"].includes(updates.role);

    if (user.roles !== (shouldBeAdmin ? updates.role : "User")) {
      user.roles = shouldBeAdmin ? updates.role : "User";
    }
    Object.assign(user, updates);
    await user.save();

    const updatedUser = await User.findById(targetUserId).populate("courses", "_id title");
    const userResponse = updatedUser.toObject();
    delete userResponse.password;
    delete userResponse.encryptedOTP;
    delete userResponse.otpTimestamp;

    await ActivityLog.create({
      user: adminId,
      activityType: "OTHER",
      metadata: {
        note: `Admin updated user details of ${targetUserId}`,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "User updated",
      data: userResponse,
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
      });
    }

    await ActivityLog.create({
      user: id,
      activityType: "OTHER",
      metadata: {
        note: `Admin deleted a user account`,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });


    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "User deleted successfully",
    });

  } catch (error) {
    errorResponse(res, error)
  }
};
exports.getUserRoles = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select("roles");
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "User roles fetched successfully",
      roles: user.roles,
    });

  } catch (error) {
    errorResponse(res, error)
  }
};

exports.createUser = async (req, res) => {
  try {
    const {
      email,
      phoneNumber,
      roles = ["User"],
      status = "inactive",
    } = req.body;
    if (!dob) {
      return res.status(400).json({ msg: "Date of Birth is required." });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email || null }, { phoneNumber: phoneNumber || null }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "User with this email or phone number already exists",
      });
    }
    const defaultPassword = "123456";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);
    const newUser = new User({
      email,
      phoneNumber,
      password: hashedPassword,
      roles,
      status,
      dob: new Date(dob),
    });
    if (newUser.roles.includes("User")) {
      newUser.transactions = [];
    }

    await ActivityLog.create({
      user: newUser._id,
      activityType: "NEW_USER_CREATION",
      metadata: {
        note: `Admin created a new user`,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    await newUser.save();
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      msg: "User created successfully",
      user: userResponse,
    });
  } catch (error) {
 return errorResponse(res, error)
  }
};

exports.addUserAddress = async (req, res) => {
  try {
    const userId = req.user.id;

    const { address, pincode, state, city, country } = req.body;

    if (!address || !pincode || !state || !city) {
      return res.status(400).json({ msg: "All address fields are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.address = {
      address,
      pincode,
      state,
      city,
      country: country || "India",
    };

    await user.save();
    await ActivityLog.create({
      user: user._id,
      activityType: "ADDRESS_UPDATED",
      metadata: {
        note: `User added/updated their address`,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });


    res.status(200).json({ success: true, statusCode: 200, message: "Address added successfully", address: user.address });
  } catch (error) {
   return errorResponse(res, error)
  }
};
exports.getUserAddress = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("address");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (!user.address || Object.keys(user.address).length === 0) {
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "No address found for this user",
        address: null,
      });
    }

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "User address fetched successfully",
      address: user.address,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};


