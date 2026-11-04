const express = require('express');
const {
  getActiveProducts,
  getProductById,
} = require('../controllers/product.controller');

const router = express.Router();

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

