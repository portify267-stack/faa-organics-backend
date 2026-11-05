const express = require('express');
const {
  createProduct,
  getAllAdminProducts,
  updateProduct,
  deleteProduct,
  updateProductStatus,
} = require('../controllers/product.controller');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

const router = express.Router();

// All routes here require valid admin authentication
router.use(authenticateAdmin);

// Ensure dynamic, un-cached responses for admin catalog management
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
 * @route   POST /api/admin/products
 * @desc    Create a new organic product
 * @access  Protected (Admin only)
 */
router.post('/', upload.array('images', 5), createProduct);

/**
 * @route   GET /api/admin/products
 * @desc    Get all products for admin management
 * @access  Protected (Admin only)
 */
router.get('/', getAllAdminProducts);

/**
 * @route   PUT /api/admin/products/:id
 * @desc    Update product details
 * @access  Protected (Admin only)
 */
router.put('/:id', upload.array('images', 5), updateProduct);

/**
 * @route   DELETE /api/admin/products/:id
 * @desc    Delete a product
 * @access  Protected (Admin only)
 */
router.delete('/:id', deleteProduct);

/**
 * @route   PATCH /api/admin/products/:id/status
 * @desc    Activate or deactivate a product
 * @access  Protected (Admin only)
 */
router.patch('/:id/status', updateProductStatus);

module.exports = router;

