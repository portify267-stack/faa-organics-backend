const express = require('express');
const {
  getActiveCategories,
  getCategoryById,
} = require('../controllers/category.controller');

const router = express.Router();

// Allow HTTP revalidation (304 Not Modified) with ETag while preventing stale cached data
router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'public, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Vary': 'Origin, Accept-Encoding',
  });
  next();
});

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

