const Rating = require('../models/Ratings')
const { logUserActivity } = require("../utils/activityLogger");
const errorResponse = require('../utils/errorResponse');

exports.createRating = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { courseId, rating, comment } = req.body;

    if (!courseId || !rating) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Course ID and rating are required",
        data: null,
      });
    }

    const existingRating = await Rating.findOne({ user: userId, course: courseId });
    if (existingRating) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "You have already rated this course. Please edit your rating instead.",
        data: null,
      });
    }

    const newRating = new Rating({
      course: courseId,
      user: userId,
      rating,
      comment,
    });

    await newRating.save();

  await logUserActivity({
  userId,
  activityType: "RATING_CREATED",
  metadata: { courseId, rating, comment },
  req,
});

    const ratingObj = newRating.toObject();
    const { _id: ratingId, course, user, ...rest } = ratingObj;
    const response = {
      ratingId,
      courseId: course,
      userId: user,
      ...rest,
    };

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "Rating added successfully",
      data: response,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.getRating = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { courseId } = req.params;

    const rating = await Rating.findOne({ user: userId, course: courseId })
      .populate("user", "firstName");

    if (!rating) {
      return res.status(204).json({
        success: false,
        statusCode: 204,
        message: "No rating found for this course by the user",
        data: null,
      });
    }

       const { _id: ratingId, ...rest } = rating.toObject();
    const data = { ratingId, ...rest };

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "User rating fetched successfully",
      data,
    });
  } catch (error) {
   return errorResponse(res, error);
  }
};

exports.updateRating = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user?.id;

    const updatedRating = await Rating.findOneAndUpdate(
      { user: userId, course: courseId },
      { rating, comment },
      { new: true }
    );

    if (!updatedRating) {
      return res.status(204).json({
        success: false,
        statusCode: 204,
        message: "Rating not found for this course by the user",
        data: null,
      });
    }

await logUserActivity({
  userId,
  activityType: "RATING_UPDATED",
  metadata: { courseId, rating, comment },
  req,
});


        const ratingObj = updatedRating.toObject();
    const { _id: ratingId, course, user, ...rest } = ratingObj;
    const response = {
      ratingId,
      courseId: course,
      userId: user,
      ...rest,
    };
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Rating updated successfully",
      data: response,
    });
  } catch (error) {
    return errorResponse(res, error)
  }
};


exports.getAllRatings = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1 } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    const ratings = await Rating.find({ course: courseId })
      .populate("user", "firstName")
      .sort({ createdAt: -1 })      // latest first
      .skip(skip)
      .limit(limit);

    const total = await Rating.countDocuments({ course: courseId });

    const data = ratings.map(rating => {
      const { _id: ratingId, course, ...rest } = rating.toObject();
      return {
        ratingId,
        courseId: course,
        ...rest,
      };
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Ratings fetched successfully",
      data,
      total,             // total ratings count
      page: Number(page),
      hasMore: skip + ratings.length < total,  // if more exist
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};


exports.deleteRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const userId = req.user?.id;

    const rating = await Rating.findById(ratingId);

    if (!rating) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Rating not found",
        data: null,
      });
    }

    if (rating.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "You are not authorized to delete this rating",
        data: null,
      });
    }

    const deletedRating = await Rating.findByIdAndDelete(ratingId);

   await logUserActivity({
  userId,
  activityType: "RATING_DELETED",
  metadata: { ratingId, courseId: rating.course },
  req,
});


     const ratingObj = deletedRating.toObject();
    const { _id: deletedRatingId, course, user, ...rest } = ratingObj;
    const response = {
      ratingId: deletedRatingId,
      courseId: course,
      userId: user,
      ...rest,
    };

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Rating deleted successfully",
      data: response,
    });

  } catch (error) {
   return errorResponse(res, error);
  }
};