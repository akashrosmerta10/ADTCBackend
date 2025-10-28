const express = require("express");
const {addToCart, Cart, removeFromCart, clearCart, totalCostSummary } = require("../controllers/cartController");
const auth = require("../middleware/auth");
const router = express.Router();


router.post('/add-to-cart', auth, addToCart);
router.get('/fetchcart', auth, Cart);
router.post("/remove-from-cart",auth, removeFromCart);
router.post("/clear-cart", auth, clearCart);
router.get("/total-cart-price", auth, totalCostSummary)



module.exports = router;
