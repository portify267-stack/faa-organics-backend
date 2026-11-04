const express = require('express');
const {
  getActiveCategories,
  getCategoryById,
} = require('../controllers/category.controller');

const router = express.Router();

/**
 * @route   GET /api/categories
 * @desc    Get all active categories for the customer website
 * @access  Public
 */
router.get('/', getActiveCategories);

/**
 * @route   GET /api/categories/:id
 * @desc    Get a single category by ID or slug
 * @access  Public
 */
router.get('/:id', getCategoryById);

module.exports = router;

