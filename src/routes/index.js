const express = require('express');
const healthRoutes = require('./health.routes');
const adminRoutes = require('./admin.routes');
const categoryRoutes = require('./category.routes');
const productRoutes = require('./product.routes');
const orderRoutes = require('./order.routes');

const router = express.Router();

// Health routes
router.use('/health', healthRoutes);

// Admin authentication & management routes (/admin, /admin/products, /admin/categories, /admin/orders)
router.use('/admin', adminRoutes);

// Customer-facing routes
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);

module.exports = router;
