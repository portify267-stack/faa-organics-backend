const express = require('express');
const {
  getActiveProducts,
  getProductById,
  getProductImage,
  streamCatalogEvents,
} = require('../controllers/product.controller');

const router = express.Router();

// Allow HTTP revalidation (304 Not Modified) with ETag while preventing stale cached HTML/JSON
router.use((req, res, next) => {
  // Dedicated image endpoint sets its own long-term immutable caching
  if (!req.path.includes('/image')) {
    res.set({
      'Cache-Control': 'public, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Vary': 'Origin, Accept-Encoding',
    });
  }
  next();
});

/**
 * @route   GET /api/products/sync-stream
 * @desc    Server-Sent Events stream for instant cross-device catalog synchronization
 * @access  Public
 */
router.get('/sync-stream', streamCatalogEvents);

/**
 * @route   GET /api/products/:id/image
 * @desc    Serve optimized binary product image with strong browser & CDN caching
 * @access  Public
 */
router.get('/:id/image', getProductImage);

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

