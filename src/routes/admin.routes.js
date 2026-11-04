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

