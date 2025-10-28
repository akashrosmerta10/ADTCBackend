const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
});

const Tag = mongoose.model('Tag', tagSchema);

module.exports = Tag;