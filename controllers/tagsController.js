const express = require('express');
const Course = require('../models/Course');
const Tag = require('../models/Tags');
const errorResponse = require('../utils/errorResponse');


exports.createTag = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Tag name is required.",
                data: null,
            });
        }

        const existingTag = await Tag.findOne({ name });
        if (existingTag) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Tag already exists.",
                data: null,
            });
        }

        const newTag = await Tag.create({ name });

        return res.status(201).json({
            success: true,
            statusCode: 201,
            message: "Tag created successfully.",
            data: newTag,
        });
    } catch (error) {
        return errorResponse(res, error);
    }
};

exports.getTag = async (req, res) => {
    try {
        const tags = await Tag.find({});
        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Tags fetched successfully.",
            data: tags,
        });
    } catch (error) {
        return errorResponse(res, error);
    }
};

exports.deleteTag = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Tag ID is required.",
                data: null,
            });
        }

        const deletedTag = await Tag.findByIdAndDelete(id);
        if (!deletedTag) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "Tag not found.",
                data: null,
            });
        }

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Tag deleted successfully.",
            data: deletedTag,
        });
    } catch (error) {
        return errorResponse(res, error);
    }
};

exports.getAllTags = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1; // default to 1
    let limit = parseInt(req.query.limit) || 10; // default to 10
    if (page < 1) page = 1;

    const totalTags = await Tag.countDocuments();
    const totalPages = Math.ceil(totalTags / limit);
    const skip = (page - 1) * limit;


    const tags = await Tag.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Tags fetched successfully.",
      data: {
        tags,
        totalTags,
        totalPages,
        currentPage: page,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error fetching tags",
      error: error.message,
    });
  }
};



exports.updateTag = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!id || !name) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Tag ID and new name are required.",
                data: null,
            });
        }

        const updatedTag = await Tag.findByIdAndUpdate(
            id,
            { name },
            { new: true }
        );

        if (!updatedTag) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "Tag not found.",
                data: null,
            });
        }

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Tag updated successfully.",
            data: updatedTag,
        });
    } catch (error) {
        return errorResponse(res, error);
    }
};

// Controller: getAllFilteredTags (no pagination)
exports.getAllFilteredTags = async (req, res) => {
  try {
    const { search = "" } = req.query;

    // Case-insensitive regex search on the 'name' field
    const searchRegex = new RegExp(search, "i");
    const query = { name: searchRegex };

    // Fetch all matching tags
    const tags = await Tag.find(query).sort({ createdAt: -1 });

    console.log("filtered tags", tags)

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Filtered tags fetched successfully.",
      data: {
        tags,
        totalTags: tags.length,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error fetching filtered tags",
      error: error.message,
    });
  }
};
