const Category = require('../models/Category');
const errorResponse = require('../utils/errorResponse');

exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const category = await Category.create({ name });

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Category successfully created',
      data: category,
    });
  } catch (err) {
    return errorResponse(res, err);
  }
};

exports.getAllCategory = async (req, res) => {
  try {
    const categories = await Category.find();
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Categories fetched successfully',
      data: categories,
    });
  } catch (err) {
    return errorResponse(res, err);
  }
};

exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Category not found',
        data: {},
      });
    }
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Category fetched successfully',
      data: category,
    });
  } catch (err) {
    return errorResponse(res, err);
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Category not found',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Category successfully updated',
      data: category,
    });
  } catch (err) {
    return errorResponse(res, err);
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Category not found',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Category successfully deleted',
      data: {},
    });
  } catch (err) {
    return errorResponse(res, err);
  }
};