const razorpayInstance = require("../config/razorpayConfig");
const Payment = require('../models/Payment'); 
const Order = require('../models/Order'); 
const crypto = require("crypto");
const User = require("../models/User");
const Cart = require("../models/Cart");
const ActivityLog = require("../models/ActivityLogs");
const errorResponse = require("../utils/errorResponse");

exports.createOrder = async (req, res) => {
  try {
    const { finalPrice, currency, cartId, courseId } = req.body;
    const userId = req.user?.id; 

    if (!finalPrice || !currency) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Amount and currency are required',
        data: null,
      });
    }
     if (!cartId && !courseId) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Either cartId or courseId is required.",
        data: null,
      });
    }
    

    const options = {
      amount: finalPrice ,
      currency,
      receipt: `receipt_${Date.now()}`,
    };

  
    const razorpayOrder = await razorpayInstance.orders.create(options);

    const orderData = {
      orderId: razorpayOrder.id,
      cartId: cartId || null,
      courseId: courseId || null,
      amount: finalPrice / 100,
      currency,
      status: "created",
      receipt: razorpayOrder.receipt,
    };

    const order = new Order(orderData);
    const savedOrder = await order.save();

    let populatedOrder;
    if (cartId) {
      populatedOrder = await Order.findById(savedOrder._id).populate({
        path: "cartId",
        populate: {
          path: "cartItems",
          populate: {
            path: "category", 
            select: "name",
          },
        },
      });
    } else if (courseId) {
      populatedOrder = await Order.findById(savedOrder._id).populate({
        path: "courseId",
        populate: {
          path: "category",
          select: "name",
        },
      });
    }

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "Order created successfully",
      data: {
        order: populatedOrder,
        userId,
        symbol: "₹"
      },
    });
  } catch (error) {
  return errorResponse(res, error)
  }
};


exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const userId = req.user?.id; 

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid signature",
        data: null,
      });
    }

    const order = await Order.findOne({ orderId: razorpay_order_id }).populate("cartId").populate("courseId");

    if (!order) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Order not found",
        data: null,
      });
    }
    let purchasedCourses = [];
    if (order.courseId) {
     
      purchasedCourses = [order.courseId._id];
    } else if (order.cartId) {
     
      purchasedCourses = order.cartId.cartItems || [];
    }

    const payment = new Payment({
      razorpayOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      amount: order.amount,
      status: "verified",
      cartId: order.cartId ? order.cartId._id : null, 
      courseId: order.courseId ? order.courseId._id : null,
      orderId: order._id,
    });


    const savedPayment = await payment.save();
    const populatedPayment = await Payment.findById(savedPayment._id).populate("orderId");

    // if (userId) {
    //   await User.findByIdAndUpdate(userId, {
    //     $push: { transactions: savedPayment._id },
    //   });
    // }
  //    const courseTitle = order.courseId?.title || "a course";
    
  // const note = order.cartId
  // ? `User purchased ${cartItems?.length ?? 0} course(s)`
  // : `User purchased ${courseTitle} course`;
 if (savedPayment.status === "verified") {
  if (order.cartId && order.cartId._id) {
    await Cart.findByIdAndUpdate(order.cartId._id, {
      $set: { cartItems: [] },
    })
  } else if (order.courseId && order.courseId._id && userId) {
    await Cart.findOneAndUpdate(
      { user: userId },
      { $pull: { cartItems: order.courseId._id } },
      { new: true }
    )
  }
}



   if (savedPayment.status === "verified" && userId) {
  await User.findByIdAndUpdate(userId, {
        $push: { transactions: savedPayment._id },
        $addToSet: {
          purchasedCourses: { $each: purchasedCourses },
        },
      });
}

    // await order.cartId.save();

   


    await ActivityLog.create({
      user:  req.user?.id,
      activityType: "COURSE_PURCHASED",
      metadata: {
        transactionId: savedPayment._id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        // note,
      },
    });


    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Payment verified successfully",
      data: {
        payment: populatedPayment,
        purchasedCourses,
        symbol: "₹"
      },
    });

  } catch (error) {
   return errorResponse(res, error);
  }
};
