const mongoose = require('mongoose');
const { Schema } = mongoose;

const CommentSchema = new Schema({
moduleId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Module',
  required: true,
  index: true,
},
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  commentText: {
    type: String,
    required: true,
    trim: true,
  },
  topParentCommentId: {
  type: Schema.Types.ObjectId,
  ref: 'Comment',
  default: null,
  index: true,
},
  parentCommentId: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    default: null,
  },
  edited: {
    type: Boolean,
    default: false,
  },
  likesCount: {
    type: Number,
    default: 0,
  },
  likedBy: {
    type: [Schema.Types.ObjectId],
    ref: "User",
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('Comment', CommentSchema);
