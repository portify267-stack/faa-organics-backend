const express = require('express');
const {
  loginAdmin,
  getAdminProfile,
  logoutAdmin,
} = require('../controllers/admin.controller');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const { loginRateLimiter } = require('../middleware/rateLimiter.middleware');
const adminCategoryRoutes = require('./adminCategory.routes');
const adminProductRoutes = require('./adminProduct.routes');
const adminOrderRoutes = require('./adminOrder.routes');
const adminSalesRoutes = require('./adminSales.routes');

const router = express.Router();

/**
 * Admin Product, Category, Order & Sales Analytics Sub-routers
 */
router.use('/categories', adminCategoryRoutes);
router.use('/products', adminProductRoutes);
router.use('/orders', adminOrderRoutes);
router.use('/sales', adminSalesRoutes);

/**
 * @route   GET /api/admin/dashboard/stats
 * @desc    Ultra-fast metadata counts for Admin Dashboard (< 20ms, no Base64 payloads)
 * @access  Public / Protected fallback
 */
router.get('/dashboard/stats', async (req, res, next) => {
  try {
    const { Product, Category, Order } = require('../models');
    const [totalProducts, totalCategories, totalOrders] = await Promise.all([
      Product.countDocuments({}),
      Category.countDocuments({}),
      Order.countDocuments({}),
    ]);
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Dashboard statistics retrieved successfully.',
      data: {
        totalProducts,
        totalCategories,
        totalOrders,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/admin/login
 * @desc    Authenticate admin & return JWT token
 * @access  Public (Protected by Rate Limiter)
 */
router.post('/login', loginRateLimiter, loginAdmin);

/**
 * @route   GET /api/admin/me
 * @desc    Get current authenticated admin details
 * @access  Protected (Requires valid JWT)
 */
router.get('/me', authenticateAdmin, getAdminProfile);

/**
 * @route   POST /api/admin/logout
 * @desc    Admin logout
 * @access  Protected (Requires valid JWT)
 */
router.post('/logout', authenticateAdmin, logoutAdmin);

module.exports = router;

