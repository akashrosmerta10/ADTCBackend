const Cart = require("../models/Cart");
const Course = require("../models/Course");
const { getSignedImageUrl, deleteFromS3 } = require('../middleware/uploadToS3');
const ActivityLog = require("../models/ActivityLogs");
const errorResponse = require("../utils/errorResponse");
const { logUserActivity } = require("../utils/activityLogger");
const User = require("../models/User");


exports.addToCart = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "User ID is required.",
        data: null,
      });
    }

    if (!courseId) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Course ID is required.",
        data: null,
      });
    }

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $addToSet: { cartItems: courseId } },
      { upsert: true, new: true }
    );

await logUserActivity({
  userId,
  activityType: "COURSE_ADDED_TO_CART",
  metadata: {
    courseId,
    action: "add_to_cart",
    note: `Course ${courseId} added to cart.`,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  },
  req,
});


    const { _id: cartId, user, cartItems, ...rest } = cart.toObject();

    const formattedCartItems = cartItems.map(id => ({ courseId: id }));

    const response = { cartId, userId:user, cartItems: formattedCartItems, ...rest };

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Course added to cart.",
      data: response,
    });

  } catch (error) {
    return errorResponse(res, error)
  }
};

exports.Cart = async (req, res) => {
  try {
    const userId = req.user?.id;
    const result = await Cart.findOne({ user: userId });

    if (!result || !result.cartItems.length) {
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "Cart is empty",
        data: { cartId: result?._id || null, cartItems: [], symbol: "₹" },
      });
    }

    const courseIds = result.cartItems.map((item) => item._id);

    const courses = await Course.find({ _id: { $in: courseIds } }).populate(
      "category",
      "name"
    );

    const coursesWithImages = await Promise.all(
      courses.map(async (course) => {
        let signedUrl = null;

        if (course.image) {
          try {
            signedUrl = await getSignedImageUrl(course.image);
          } catch (err) {
            console.error(
              "Error generating signed URL for course:",
              course._id,
              err.message
            );
          }
        }

        const { _id, ...rest } = course.toObject();

        return {
          courseId: _id,
          ...rest,
          image: signedUrl,
          symbol: "₹",
        };
      })
    );

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Cart fetched successfully",
      data: { 
        cartId: result._id, 
        cartItems: coursesWithImages, 
        symbol: "₹"
      },
    });

  } catch (error) {
    return errorResponse(res, error);
  }
};


exports.removeFromCart = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user?.id;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Course ID is required.",
        data: null,
      });
    }

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $pull: { cartItems: courseId } },
      { new: true }
    );

    if (!cart) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Cart not found.",
        data: null,
      });
    }

  await logUserActivity({
  userId,
  activityType: "COURSE_REMOVED_FROM_CART",
  metadata: {
    courseId,
    action: "remove_from_cart",
    note: `Course ${courseId} removed from cart.`,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  },
  req,
});


    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Course removed from cart.",
      data: { cartId: cart._id, cartItems: cart.cartItems.map(id => ({ courseId: id })), },
    });

  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.clearCart = async (req, res) => {
  try {
    const userId = req.user?.id;

      if (!userId) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "not authorized to clear cart.",
        data: null,
      });
    }

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $set: { cartItems: [] } },
      { new: true }
    );

    if (!cart) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Cart not found.",
        data: null,
      });
    }

await logUserActivity({
  userId,
  activityType: "CART_CLEARED",
  metadata: {
    cartId: cart._id,
    action: "clear_cart",
    note: "Cart cleared successfully.",
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  },
  req,
});

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Cart cleared successfully.",
      data: { cartId: cart._id, cartItems: cart.cartItems },
    });

  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.totalCostSummary = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
        data: null,
      });
    }

    const { cartId, courseId } = req.query;

    let courseIds = [];

    let appliedCoupon = { code: "SAVE20", discountType: "percent", value: 20 };

    if (courseId) {
      courseIds = [courseId];
    } else if (cartId) {
      const cart = await Cart.findById(cartId);
      if (!cart) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: "Cart not found.",
        });
      }
      courseIds = cart.cartItems;
      if (cart.appliedCoupon) appliedCoupon = cart.appliedCoupon;
    } else {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Either cartId or courseId must be provided.",
      });
    }

    const courses = await Course.find({ _id: { $in: courseIds } });
    if (!courses.length) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "No courses found.",
      });
    }

    const subtotal = courses.reduce((sum, course) => sum + course.price, 0);

    const EMPLOYEE_COUPON = { code: "EMPLOYEE100", discountType: "percent", value: 100 };
    const effectiveCoupon = user.freeDomainUser ? EMPLOYEE_COUPON : appliedCoupon;

    const discountAmount =
      effectiveCoupon.discountType === "percent"
        ? (subtotal * effectiveCoupon.value) / 100
        : effectiveCoupon.value;

    const taxPercent = 18;
    const taxableBase = Math.max(subtotal - discountAmount, 0);
    const taxAmount = (taxableBase * taxPercent) / 100;

    const isEmployee = user.freeDomainUser;
    let total = isEmployee ? 0 : taxableBase + taxAmount;

    const currency = "INR";
    const symbol = "₹";
    const moneyField = (amount, extra = {}) => ({ amount, symbol, ...extra });

   const items = await Promise.all(
  courses.map(async (course) => {
    const { _id, ...rest } = course.toObject();

    let signedUrl = null;
    if (course.image) {
      try {
        signedUrl = await getSignedImageUrl(course.image);
      } catch (err) {
        console.error("Error generating signed URL:", course._id, err.message);
      }
    }

    return {
      courseId: _id,
      ...rest,
      image: signedUrl, // only this key is replaced
      price: moneyField(course.price),
      quantity: 1,
    };
  })
);

    

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Summary calculated successfully.",
      data: {
        mode: courseId ? "buy_now" : "cart_checkout",
        currency,
        subtotal: moneyField(subtotal),
        discount: moneyField(Math.min(discountAmount, subtotal), {
          code: effectiveCoupon.code,
          percent: effectiveCoupon.discountType === "percent" ? effectiveCoupon.value : undefined,
          discountType: effectiveCoupon.discountType,
          isEmployeeCoupon: isEmployee,
        }),
        tax: moneyField(isEmployee ? 0 : taxAmount, { percent: isEmployee ? 0 : taxPercent }),
        total: moneyField(total),
        items,
      },
    });
  } catch (error) {
    console.error("Error calculating total:", error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Failed to calculate summary.",
      error: error.message,
    });
  }
};
