const express = require('express');
const { getSalesAnalytics } = require('../controllers/sales.controller');
const { authenticateAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// Require admin authentication for all sales routes
router.use(authenticateAdmin);

/**
 * @route   GET /api/admin/sales
 * @desc    Get 6-month chronological sales analytics for Admin Panel
 * @access  Protected (Admin only)
 */
router.get('/', getSalesAnalytics);

module.exports = router;

