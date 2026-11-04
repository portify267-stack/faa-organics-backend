const express = require('express');
const {
  getAllAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  updatePaymentInfo,
  getOrderStats,
} = require('../controllers/order.controller');
const { authenticateAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// Require admin authentication for all routes
router.use(authenticateAdmin);

/**
 * @route   GET /api/admin/orders/stats
 * @desc    Get order counts by status and payment summary
 * @access  Protected (Admin only)
 * Note: Must precede /:id to prevent route shadowing
 */
router.get('/stats', getOrderStats);

/**
 * @route   GET /api/admin/orders
 * @desc    View all orders with filters, search, and pagination
 * @access  Protected (Admin only)
 */
router.get('/', getAllAdminOrders);

/**
 * @route   GET /api/admin/orders/:id
 * @desc    View complete details of an individual order
 * @access  Protected (Admin only)
 */
router.get('/:id', getAdminOrderById);

/**
 * @route   PATCH /api/admin/orders/:id/status
 * @desc    Update order status with state machine validation & stock restoration
 * @access  Protected (Admin only)
 */
router.patch('/:id/status', updateOrderStatus);

/**
 * @route   PATCH /api/admin/orders/:id/payment
 * @desc    Update order payment information securely
 * @access  Protected (Admin only)
 */
router.patch('/:id/payment', updatePaymentInfo);

module.exports = router;

