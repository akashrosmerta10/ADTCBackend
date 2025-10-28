const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
  }, 
  paymentId: { type: String, required: true, unique: true }, 
  signature: { type: String, required: true },
  amount: { type: Number, required: true }, 
  status: { type: String, enum: ["verified", "failed"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
  
});

module.exports = mongoose.model("Payment", PaymentSchema);
