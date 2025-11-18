const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true }, 
   cartId: { type: mongoose.Schema.Types.ObjectId, ref: "Cart"}, 
   orderedCourses: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  ],
    courseId: {type: mongoose.Schema.Types.ObjectId, ref: 'Course'},
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" }, 
  status: { type: String, enum: ["created", "paid", "failed"], default: "created" }, 
  receipt: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", OrderSchema);
