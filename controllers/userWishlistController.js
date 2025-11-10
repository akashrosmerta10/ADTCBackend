const Wishlist = require('../models/Wishlist');
const Course = require('../models/Course');
const { getSignedImageUrl } = require('../middleware/uploadToS3');
const errorResponse = require('../utils/errorResponse');
const { logUserActivity } = require("../utils/activityLogger");

exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, courses: [] });
      await wishlist.save();
    }

    wishlist = await Wishlist.findOne({ user: userId }).populate("courses");

    const courses = [];
    for (const course of wishlist.courses || []) {
      const courseObj = course.toObject();
      if (courseObj.image) {
        try {
          courseObj.image = await getSignedImageUrl(courseObj.image);
        } catch (error) {
          console.error("Error generating signed URL for course:", courseObj._id, error.message);
          return errorResponse(res, error);
        }
      }
      courseObj.symbol = "₹";
      courses.push(courseObj);
    }

    const response = {
      wishlistId: wishlist._id,
      userId: wishlist.user,
      courses,
      createdAt: wishlist.createdAt,
      updatedAt: wishlist.updatedAt,
      symbol: "₹",
    };

    // await logUserActivity({
    //   userId,
    //   activityType: "WISHLIST_VIEWED",
    //   req,
    //   metadata: { wishlistId: wishlist._id, totalCourses: courses.length },
    // });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Wishlist Fetched Successfully",
      data: response,
    });

  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.addToWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Course ID is required",
        data: null,
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Course not found",
        data: null,
      });
    }

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, courses: [] });
    }

    if (wishlist.courses.includes(courseId)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Course already in wishlist",
        data: null,
      });
    }

    wishlist.courses.push(courseId);
    await wishlist.save();

    await logUserActivity({
      userId,
      activityType: "COURSE_ADDED_TO_WISHLIST",
      metadata: { courseId, wishlistId: wishlist._id },
      req,
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Course added to wishlist successfully",
      data: {
        wishlistId: wishlist._id,
        userId: wishlist.user,
        courses: wishlist.courses.map(id => ({ courseId: id })),
        createdAt: wishlist.createdAt,
        updatedAt: wishlist.updatedAt,
      },
    });

  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Course ID is required",
        data: null,
      });
    }

    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Wishlist not found",
        data: null,
      });
    }

    const index = wishlist.courses.indexOf(courseId);
    if (index === -1) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Course not in wishlist",
        data: null,
      });
    }

    wishlist.courses.splice(index, 1);
    await wishlist.save();

    await logUserActivity({
      userId,
      activityType: "COURSE_REMOVED_FROM_WISHLIST",
      metadata: { courseId, wishlistId: wishlist._id },
      req,
    });

    const response = {
      wishlistId: wishlist._id,
      userId: wishlist.user,
      courses: wishlist.courses.map(id => ({ courseId: id })),
      createdAt: wishlist.createdAt,
      updatedAt: wishlist.updatedAt,
    };

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Course removed from wishlist successfully",
      data: response,
    });

  } catch (error) {
    return errorResponse(res, error);
  }
};
