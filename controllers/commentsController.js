const Comment = require('../models/Comments');
const errorResponse = require("../utils/errorResponse");
const User = require("../models/User");

exports.createComment = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { moduleId, commentText, parentCommentId } = req.body;

    if (!moduleId || !commentText) {
      return res.status(400).json({
        statusCode: 400,
        message: 'moduleId and commentText are required',
        data: null
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        message: 'User not found',
        data: null
      });
    }

    if (!parentCommentId) {
      let newComment = new Comment({ moduleId, userId, commentText });
      const savedComment = await newComment.save();

      savedComment.topParentCommentId = savedComment._id;
      await savedComment.save();

      const populatedComment = await Comment.findById(savedComment._id)
        .populate({ path: "userId", select: "firstName lastName profilePhoto" });

      return res.status(201).json({
        statusCode: 201,
        message: 'Comment created successfully',
        data: populatedComment
      });
    } else {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({
          statusCode: 404,
          message: 'Parent comment not found',
          data: null
        });
      }

      const topParentId = parentComment.topParentCommentId || parentComment._id;

      const replyComment = new Comment({
        moduleId,
        userId,
        commentText,
        parentCommentId,
        topParentCommentId: topParentId,
      });
      const savedReply = await replyComment.save();

      const populatedReply = await Comment.findById(savedReply._id)
        .populate({ path: "userId", select: "firstName lastName profilePhoto" });

      return res.status(201).json({
        statusCode: 201,
        message: 'Reply created successfully',
        data: populatedReply
      });
    }
  } catch (error) {
    console.error('Error in createComment:', error);
    return errorResponse(res, error);
  }
};

exports.getCommentsByModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    if (!moduleId) {
      return res.status(400).json({
        statusCode: 400,
        message: 'moduleId is required',
        data: null
      });
    }

    const comments = await Comment.find({ moduleId })
      .sort({ createdAt: -1 })
      .populate({ path: 'userId', select: 'firstName lastName profilePhoto' })
      .exec();

    return res.status(200).json({
      statusCode: 200,
      message: 'Comments fetched successfully',
      data: comments
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return errorResponse(res, error);
  }
};


exports.updateComment = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { commentId } = req.params;
    const { commentText } = req.body;

    if (!commentText) {
      return res.status(400).json({
        statusCode: 400,
        message: 'commentText is required',
        data: null
      });
    }

    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      { commentText, updatedAt: Date.now(), edited: true },
      { new: true }
    ).populate({ path: 'userId', select: 'firstName lastName profilePhoto' });

    if (!updatedComment) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Comment not found',
        data: null
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: 'Comment updated successfully',
      data: updatedComment
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    return errorResponse(res, error);
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        message: 'User not found',
        data: null
      });
    }


    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Comment not found',
        data: null
      });
    }

    if (comment.userId.toString() !== userId) {
      return res.status(403).json({
        statusCode: 403,
        message: 'You are not authorized to delete this comment',
        data: null
      });
    }


    const deletedComment = await Comment.findByIdAndDelete(commentId);


    if (!deletedComment) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Comment not found',
        data: null
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: 'Comment deleted successfully',
      data: deletedComment
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return errorResponse(res, error);
  }
};

exports.addReply = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { moduleId, commentText, parentCommentId } = req.body;

    if (!moduleId || !commentText || !parentCommentId) {
      return res.status(400).json({
        statusCode: 400,
        message: 'moduleId, commentText and parentCommentId are required',
        data: null
      });
    }

    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Parent comment not found',
        data: null
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        message: 'User not found',
        data: null
      });
    }

    const topParentId = parentComment.topParentCommentId || parentComment._id;

    const replyComment = new Comment({
      moduleId: parentComment.moduleId,
      userId,
      commentText,
      parentCommentId,
      topParentCommentId: topParentId,
    });

    const savedReply = await replyComment.save();

    const populatedReply = await Comment.findById(savedReply._id)
      .populate({ path: "userId", select: "firstName lastName profilePhoto" });

    return res.status(201).json({
      statusCode: 201,
      message: 'Reply added successfully',
      data: populatedReply
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    return errorResponse(res, error);
  }
};

exports.likeComment = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { commentId } = req.params;

    if (!userId) {
      return res.status(401).json({
        statusCode: 401,
        message: "Unauthorized: User not authenticated",
        data: null,
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        statusCode: 404,
        message: "Comment not found",
        data: null,
      });
    }

    if (!Array.isArray(comment.likedBy)) {
      comment.likedBy = [];
    }

    const userIndex = comment.likedBy.findIndex(
      (id) => id.toString() === userId.toString()
    );

    if (userIndex === -1) {
      comment.likedBy.push(userId);
    } else {
      comment.likedBy.splice(userIndex, 1);
    }

    comment.likesCount = comment.likedBy.length;

    await comment.save();

    const populatedComment = await Comment.findById(commentId)
      .populate({ path: "userId", select: "firstName lastName profilePhoto" });

    return res.status(200).json({
      statusCode: 200,
      message: userIndex === -1 ? "Comment liked" : "Comment unliked",
      data: populatedComment,
    });
  } catch (error) {
    console.error("Error liking comment:", error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal server error",
      data: null,
    });
  }
};

exports.getCommentThread = async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!commentId) {
      return res.status(400).json({
        statusCode: 400,
        message: "commentId is required",
        data: null,
      });
    }

    const rootComment = await Comment.findById(commentId)
      .populate({ path: "userId", select: "firstName lastName profilePhoto" })
      .exec();

    if (!rootComment) {
      return res.status(404).json({
        statusCode: 404,
        message: "Comment not found",
        data: null,
      });
    }

    const threadComments = await Comment.find({ topParentCommentId: commentId })
      .populate({ path: "userId", select: "firstName lastName profilePhoto" })
      .sort({ createdAt: 1 })
      .exec();

    return res.status(200).json({
      statusCode: 200,
      message: "Comment thread fetched successfully",
      data: {
        rootComment,
        replies: threadComments.filter((c) => c._id.toString() !== commentId),
      },
    });
  } catch (error) {
    console.error("Error fetching comment thread:", error);
    return errorResponse(res, error);
  }
};

exports.getAllComments = async (req, res) => {
  try {
    const comments = await Comment.find({})
      .sort({ createdAt: -1 })
      .populate({ path: "userId", select: "firstName lastName profilePhoto" })
      .populate({ path: "moduleId", select: "name" })
      .exec();

    return res.status(200).json({
      statusCode: 200,
      message: "All comments fetched successfully",
      data: comments,
    });
  } catch (error) {
    console.error("Error fetching all comments:", error);
    return errorResponse(res, error);
  }
};
