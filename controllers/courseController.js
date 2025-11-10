const mongoose = require('mongoose');
const Course = require('../models/Course');
const Module = require('../models/Module');
const category = require('../models/Category')
const Tag = require('../models/Tags');
const { getSignedImageUrl } = require('../middleware/uploadToS3');
const errorResponse = require('../utils/errorResponse');
const jwt = require("jsonwebtoken");
const User = require("../models/User");


exports.createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      tags,
      price,
      moduleIds,
      status,
      kycRequired,
      courseImage: image,
    } = req.body;
    

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid category ID.",
      });
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Course image is required.",
      });
    }

    const parsedModuleIds = parseAndValidateObjectIdArray(moduleIds, 'moduleIds');
    const modules = await Module.find({ _id: { $in: parsedModuleIds } });
    if (modules.length !== parsedModuleIds.length) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Some module IDs are invalid or do not exist.",
      });
    }

    const parsedTags = parseAndValidateObjectIdArray(tags, 'tags');
    const tagDocs = await Tag.find({ _id: { $in: parsedTags } });
    if (tagDocs.length !== parsedTags.length) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Some tag IDs are invalid or do not exist.",
      });
    }

    const courseStatus = parseBoolean(status, 'status');
    const kycStatus = parseBoolean(kycRequired, 'kycRequired');

    const formattedTitle = title
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());

    const formattedKeyTitle = formattedTitle
      .replace(/\s+/g, "_")
      .replace(/[^\w\-]/g, "");
    const courseKey = `COURSE_${formattedKeyTitle}`;

    const newCourse = new Course({
      title: formattedTitle,
      description,
      image,
      category: new mongoose.Types.ObjectId(category),
      tags: parsedTags,
      price: parseFloat(price),
      // creator,
      modules: parsedModuleIds,
      status: courseStatus,
      Kycrequired: kycStatus,
      courseKey,
    });

    await newCourse.save();
    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "Course created successfully.",
      data: newCourse,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Failed to create course.",
      error: error.message,
    });
  }
};


exports.getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find().populate("category", "name").populate("tags", "name");

    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.user.id);
      } catch (error) {
        user = null;
      }
    }

    const data = await Promise.all(
      courses.map(async (course) => {
        const courseObj = course.toObject();


        if (courseObj.image) {

          try {
            courseObj.image = await getSignedImageUrl(courseObj.image);
          } catch (error) {
            return errorResponse(res, error);
          }
        }

        courseObj.symbol = "₹";
        courseObj.isPurchased = false;

        if (user?.purchasedCourses?.some(id => id.toString() === courseObj._id.toString())) {
          courseObj.isPurchased = true;
        }

        return courseObj;
      })
    );

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Courses Fetched Successfully",
      data,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.getCourse = async (req, res) => {
  try {
    const courseId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid Course ID",
        data: null,
      });
    }

    const course = await Course.findById(courseId)
      .populate("category")
      .populate("modules")
      .populate("tags", "name");

    if (!course) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Course not found",
        data: null,
      });
    }
    let signedUrl = null;

    const courseObj = course.toObject();
    if (courseObj.image) {
      try {
        courseObj.image = await getSignedImageUrl(courseObj.image);
      } catch (error) {
        return errorResponse(res, error);
      }
    }

    courseObj.isPurchased = false;
    courseObj.symbol = "₹";

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.user.id);

        if (user?.purchasedCourses?.some(id => id.toString() === courseId)) {
          courseObj.isPurchased = true;
        }
      } catch (err) {
        console.log("JWT error:", err.message);
      }
    }


    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Course Fetched Successfully",
      data: courseObj,
    });

  } catch (error) {
    return errorResponse(res, error)
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      tags,
      price,
      // creator,
      moduleIds,
      status,
      courseImage: image,
    } = req.body;
    const courseId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, statusCode: 400, message: "Invalid course ID" });
    }
     const categoryId =
      typeof category === "object" && category?._id
        ? category._id
        : category;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ success: false, statusCode: 400, message: "Invalid category ID" });
    }

    if (isNaN(price)) {
      return res.status(400).json({ success: false, statusCode: 400, message: "Price must be numeric" });
    }

    const parsedModuleIds = parseAndValidateObjectIdArray(moduleIds, 'moduleIds');
    const modules = await Module.find({ _id: { $in: parsedModuleIds } });
    if (modules.length !== parsedModuleIds.length) {
      return res.status(400).json({ success: false, statusCode: 400, message: "Some module IDs are invalid or do not exist." });
    }

    const parsedTags = parseAndValidateObjectIdArray(tags, 'tags');
    const tagDocs = await Tag.find({ _id: { $in: parsedTags } });
    if (tagDocs.length !== parsedTags.length) {
      return res.status(400).json({ success: false, statusCode: 400, message: "Some tag IDs are invalid or do not exist." });
    }

    const updateData = {
      title,
      description,
      category: new mongoose.Types.ObjectId(categoryId),
      tags: parsedTags,
      price: parseFloat(price),
      // creator,
      modules: parsedModuleIds,
    };

    if (typeof status !== "undefined") {
      updateData.status = parseBoolean(status, 'status');
    }

    if (req.file || image) {
      updateData.image = image;
    }

    const updatedCourse = await Course.findByIdAndUpdate(courseId, updateData, { new: true });

    if (!updatedCourse) {
      return res.status(404).json({ success: false, statusCode: 404, message: "Course not found" });
    }

    res.status(201).json({ success: true, statusCode: 201, message: "Course updated successfully", data: updatedCourse });

  } catch (error) {
    return errorResponse(res, error)
  }
};

exports.deleteCourse = async (req, res) => {
  const { id } = req.params;


  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid course ID format' });
  }

  try {
    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Course not found'
      });
    }

    await course.deleteOne();
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Course successfully deleted',
      data: {},
    });
  } catch (error) {
    return errorResponse(res, error)
  }
};

exports.filteredCourses = async (req, res) => {
  try {
    const { name } = req.query;
    const filter = {};
    const orCondition = [];

    if (name) {
      orCondition.push({ title: { $regex: name, $options: "i" } });
      const matchedTags = await Tag.find({
        name: { $regex: name, $options: "i" },
      });

      const tagIds = matchedTags.map((tag) => tag._id);

      if (tagIds.length > 0) {
        orCondition.push({ tags: { $in: tagIds } });
      }
    }

    if (orCondition.length > 0) {
      filter.$or = orCondition;
    }

    let courses = await Course.find(filter).populate("category", "name")
      .populate("tags", "name")
      .sort({ createdAt: -1 });

    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.user.id);
      } catch (err) {
        user = null;
      }
    }

    courses = await Promise.all(
      courses.map(async (course) => {
        const courseObj = course.toObject();

        if (courseObj.image) {
          try {
            courseObj.image = await getSignedImageUrl(courseObj.image);
          } catch (error) {
            return errorResponse(res, error);
          }
        }

        courseObj.symbol = "₹";
        courseObj.isPurchased = false;

        if (user?.purchasedCourses?.some(id => id.toString() === courseObj._id.toString())) {
          courseObj.isPurchased = true;
        }

        return courseObj;
      })
    );

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Filtered Courses Fetched Successfully",
      data: courses,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};



exports.getTopCategory = async (req, res) => {
  try {
    const result = await Course.aggregate([
      {
        $group: {
          _id: "$category",
          courseCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      {
        $project: {
          _id: 0,
          categoryId: "$_id",
          categoryName: "$categoryDetails.name",
          courseCount: 1,
        },
      },
      { $sort: { courseCount: -1 } },

    ]);
    res.status(200).json({ success: true, statusCode: 200, message: "top category fetched successfully", data: result });
  } catch (error) {
    console.error("Error getting top categories:", error.message);
    res.status(500).json({ msg: error.message });
  }
};



function parseAndValidateObjectIdArray(input, fieldName) {
  let array = input;

  if (typeof input === 'string') {
    try {
      array = JSON.parse(input);
    } catch {
      throw new Error(`${fieldName} must be a valid JSON array`);
    }
  }

  if (!Array.isArray(array)) {
    throw new Error(`${fieldName} must be an array`);
  }

  return array.map((id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid ObjectId in ${fieldName}: ${id}`);
    }
    return new mongoose.Types.ObjectId(id);
  });
}

function parseBoolean(value, fieldName) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const val = value.toLowerCase();
    if (val === 'true') return true;
    if (val === 'false') return false;
  }
  throw new Error(`Invalid value for ${fieldName}. Must be 'true' or 'false'.`);
}
