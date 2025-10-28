const express = require("express");
const { createOrder, verifyPayment } = require("../controllers/paymentController");
const auth = require("../middleware/auth");
const router = express.Router();


router.post('/create-order',auth, createOrder);
router.post("/verify-payment", auth, verifyPayment);
// router.get("/", getOrderWithPaymentDetails)

module.exports = router;
