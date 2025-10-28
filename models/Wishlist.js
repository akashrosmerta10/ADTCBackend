const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    courses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
    }],
},
);

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;