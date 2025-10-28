const express = require("express");
const router = express.Router();
const { getPaymentOverview } = require("../controllers/statController");

router.get("/payment-overview", getPaymentOverview);

module.exports = router;
