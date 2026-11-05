const express = require('express');
const {
  getActiveCategories,
  getCategoryById,
} = require('../controllers/category.controller');

const router = express.Router();

// Ensure dynamic, un-cached category responses so changes in MongoDB Atlas reflect instantly
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

