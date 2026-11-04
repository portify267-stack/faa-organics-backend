const express = require('express');
const {
  createCategory,
  getAllAdminCategories,
  updateCategory,
  deleteCategory,
  updateCategoryStatus,
} = require('../controllers/category.controller');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

const router = express.Router();

// All routes here require valid admin authentication
router.use(authenticateAdmin);

/**
 * @route   POST /api/admin/categories
 * @desc    Create a new category
 * @access  Protected (Admin only)
 */
router.post('/', upload.single('image'), createCategory);

/**
 * @route   GET /api/admin/categories
 * @desc    Get all categories for admin management
 * @access  Protected (Admin only)
 */
router.get('/', getAllAdminCategories);

/**
 * @route   PUT /api/admin/categories/:id
 * @desc    Update an existing category
 * @access  Protected (Admin only)
 */
router.put('/:id', upload.single('image'), updateCategory);

/**
 * @route   DELETE /api/admin/categories/:id
 * @desc    Delete a category (blocked if assigned products exist)
 * @access  Protected (Admin only)
 */
router.delete('/:id', deleteCategory);

/**
 * @route   PATCH /api/admin/categories/:id/status
 * @desc    Activate or deactivate a category
 * @access  Protected (Admin only)
 */
router.patch('/:id/status', updateCategoryStatus);

module.exports = router;

