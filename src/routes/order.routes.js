const express = require('express');
const { createOrder } = require('../controllers/order.controller');
const { checkoutRateLimiter } = require('../middleware/rateLimiter.middleware');

const router = express.Router();

/**
 * @route   POST /api/orders
 * @desc    Place a new customer order (regular or custom)
 * @access  Public (Protected by Checkout Rate Limiter)
 */
router.post('/', checkoutRateLimiter, createOrder);

module.exports = router;

