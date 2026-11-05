const express = require('express');
const {
  getActiveProducts,
  getProductById,
} = require('../controllers/product.controller');

const router = express.Router();

// Ensure dynamic, un-cached catalog responses so changes in MongoDB Atlas reflect instantly
router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });
  next();
});

/**
 * @route   GET /api/products
 * @desc    Get all active, available products for customer website
 * @access  Public
 */
router.get('/', getActiveProducts);

/**
 * @route   GET /api/products/:id
 * @desc    Get a single product by ID or slug
 * @access  Public
 */
router.get('/:id', getProductById);

module.exports = router;

