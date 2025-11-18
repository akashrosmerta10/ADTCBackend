const { getSignedImageUrl } = require('../middleware/uploadToS3');
const Category = require('../models/Category');
const errorResponse = require('../utils/errorResponse');

exports.createCategory = async (req, res) => {
  try {
    const { name, categoryImage } = req.body;
    const category = await Category.create({ name, categoryImage });

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
     for ( const cat of categories){
      if (cat.categoryImage){
        cat.categoryImage = await getSignedImageUrl(cat.categoryImage)
      }
    }
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

    for ( const cat of category){
      if (cat.categoryImage){
        cat.categoryImage = await getSignedImageUrl(cat.categoryImage)
      }
    }
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
    const { name, categoryImage } = req.body;
     const updateData = {};
    if (name) updateData.name = name;
    if (categoryImage) updateData.categoryImage = categoryImage;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
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

     if (category.categoryImage) {
      category.categoryImage = await getSignedImageUrl(category.categoryImage);
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