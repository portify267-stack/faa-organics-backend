const mongoose = require('mongoose');
const { Product, Category } = require('../models');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { escapeRegex } = require('../utils/sanitize');
const { processProductImages } = require('../middleware/upload.middleware');

/**
 * 1. Create Product
 * @route   POST /api/admin/products
 * @access  Protected (Admin only)
 */
const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      discountPrice,
      category,
      stockQuantity,
      availabilityStatus,
      isFeatured,
      unit,
      isOrganicCertified,
      subtitle,
      keyIngredients,
      benefits,
      howToUse,
      suitability,
      status,
      isActive,
    } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return next(new ApiError(400, 'Product name is required.'));
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return next(new ApiError(400, 'Product description is required.'));
    }

    if (price === undefined || price === null || price === '') {
      return next(new ApiError(400, 'Product price is required.'));
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return next(new ApiError(400, 'Price must be a valid non-negative number.'));
    }

    // Validate optional discount price
    let numDiscountPrice = null;
    if (discountPrice !== undefined && discountPrice !== null && discountPrice !== '') {
      numDiscountPrice = Number(discountPrice);
      if (isNaN(numDiscountPrice) || numDiscountPrice < 0) {
        return next(
          new ApiError(400, 'Discount price must be a valid non-negative number.')
        );
      }
      if (numDiscountPrice >= numPrice) {
        return next(
          new ApiError(
            400,
            `Discount price (${numDiscountPrice}) must be strictly less than the regular price (${numPrice}).`
          )
        );
      }
    }

    // Validate Category exists
    if (!category) {
      return next(new ApiError(400, 'Product category reference is required.'));
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return next(new ApiError(400, 'Invalid category ID format.'));
    }

    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return next(
        new ApiError(400, 'Referenced category does not exist in the database.')
      );
    }

    // Stock Quantity validation
    const stock = stockQuantity !== undefined ? Math.max(0, parseInt(stockQuantity, 10) || 0) : 0;

    // Process images from multer or JSON body
    let images = processProductImages(req);
    if (!images || images.length === 0) {
      // Assign default placeholder if no images supplied
      images = [
        {
          url: '/uploads/default-organic-product.webp',
          alt: name.trim(),
          isPrimary: true,
        },
      ];
    }

    const product = await Product.create({
      name: name.trim(),
      description: description.trim(),
      images,
      price: numPrice,
      discountPrice: numDiscountPrice,
      category,
      stockQuantity: stock,
      availabilityStatus: availabilityStatus || (stock > 0 ? 'in_stock' : 'out_of_stock'),
      isFeatured: isFeatured !== undefined ? Boolean(isFeatured) : false,
      unit: unit ? unit.trim() : '1 unit',
      isOrganicCertified: isOrganicCertified !== undefined ? Boolean(isOrganicCertified) : true,
      subtitle: subtitle ? subtitle.trim() : '',
      keyIngredients: keyIngredients ? keyIngredients.trim() : '',
      benefits: benefits ? benefits.trim() : '',
      howToUse: howToUse ? howToUse.trim() : '',
      suitability: suitability ? suitability.trim() : '',
      status: status || (isActive === false ? 'inactive' : 'active'),
      isActive: isActive !== undefined ? Boolean(isActive) : status !== 'inactive',
    });

    const populatedProduct = await Product.findById(product._id).populate(
      'category',
      'name slug'
    );

    res
      .status(201)
      .json(new ApiResponse(201, populatedProduct, 'Product created successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get Active Products for Customer Website
 * Supports: pagination, category filter (id/slug), search, price sort, featured
 * @route   GET /api/products
 * @access  Public
 */
const getActiveProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      sort,
      featured,
      minPrice,
      maxPrice,
      inStockOnly,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    // Base query: Active products only
    const query = {
      isActive: true,
      status: 'active',
      availabilityStatus: { $ne: 'discontinued' },
    };

    // Filter by stock
    if (inStockOnly === 'true') {
      query.availabilityStatus = 'in_stock';
      query.stockQuantity = { $gt: 0 };
    }

    // Filter by category (supports ObjectId or slug)
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        const catDoc = await Category.findOne({ slug: category.toLowerCase().trim() });
        if (catDoc) {
          query.category = catDoc._id;
        } else {
          // Category slug does not match any category
          return res.status(200).json(
            new ApiResponse(
              200,
              {
                products: [],
                pagination: {
                  total: 0,
                  page: pageNum,
                  limit: limitNum,
                  totalPages: 0,
                  hasNextPage: false,
                  hasPrevPage: false,
                },
              },
              'No products found for this category.'
            )
          );
        }
      }
    }

    // Search by product name or description
    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    // Filter by featured
    if (featured === 'true') {
      query.isFeatured = true;
    }

    // Filter by price range
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined && !isNaN(Number(minPrice))) {
        query.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
        query.price.$lte = Number(maxPrice);
      }
    }

    // Determine sorting order
    let sortQuery = { createdAt: -1 };
    switch (sort) {
      case 'price_asc':
      case 'price_low':
        sortQuery = { price: 1 };
        break;
      case 'price_desc':
      case 'price_high':
        sortQuery = { price: -1 };
        break;
      case 'name_asc':
        sortQuery = { name: 1 };
        break;
      case 'featured':
        sortQuery = { isFeatured: -1, createdAt: -1 };
        break;
      case 'newest':
      default:
        sortQuery = { createdAt: -1 };
        break;
    }

    // Execute queries in parallel for high performance
    const [totalProducts, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .select(
          'name slug subtitle keyIngredients benefits howToUse suitability description images price discountPrice category stockQuantity availabilityStatus isFeatured unit isOrganicCertified createdAt'
        )
        .populate('category', 'name slug')
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(totalProducts / limitNum);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          products,
          pagination: {
            total: totalProducts,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
          },
        },
        'Products retrieved successfully.'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get Single Product by ID or Slug
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let product = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id).populate('category', 'name slug description');
    }

    if (!product) {
      product = await Product.findOne({ slug: id.toLowerCase().trim() }).populate(
        'category',
        'name slug description'
      );
    }

    if (!product || product.status === 'inactive') {
      return next(new ApiError(404, 'Product not found.'));
    }

    res
      .status(200)
      .json(new ApiResponse(200, product, 'Product retrieved successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Get All Products for Admin Management
 * Includes inactive, out of stock, and discontinued products
 * @route   GET /api/admin/products
 * @access  Protected (Admin only)
 */
const getAllAdminProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status,
      availability,
      featured,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (search && typeof search === 'string' && search.trim()) {
      query.name = { $regex: escapeRegex(search.trim()), $options: 'i' };
    }

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      query.category = category;
    }

    if (status && ['active', 'inactive'].includes(status)) {
      query.status = status;
    }

    if (
      availability &&
      ['in_stock', 'out_of_stock', 'pre_order', 'discontinued'].includes(availability)
    ) {
      query.availabilityStatus = availability;
    }

    if (featured !== undefined) {
      query.isFeatured = featured === 'true';
    }

    const [totalProducts, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .populate('category', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(totalProducts / limitNum);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          products,
          pagination: {
            total: totalProducts,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
          },
        },
        'Admin products retrieved successfully.'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Update Product
 * @route   PUT /api/admin/products/:id
 * @access  Protected (Admin only)
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ApiError(400, 'Invalid product ID format.'));
    }

    const product = await Product.findById(id);
    if (!product) {
      return next(new ApiError(404, 'Product not found.'));
    }

    const {
      name,
      description,
      price,
      discountPrice,
      category,
      stockQuantity,
      availabilityStatus,
      isFeatured,
      unit,
      isOrganicCertified,
      subtitle,
      keyIngredients,
      benefits,
      howToUse,
      suitability,
      status,
      isActive,
    } = req.body;

    if (name && name.trim()) {
      product.name = name.trim();
    }

    if (description && description.trim()) {
      product.description = description.trim();
    }

    if (price !== undefined && price !== '') {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return next(new ApiError(400, 'Price must be a non-negative number.'));
      }
      product.price = numPrice;
    }

    if (discountPrice !== undefined) {
      if (discountPrice === '' || discountPrice === null) {
        product.discountPrice = null;
      } else {
        const numDiscount = Number(discountPrice);
        if (isNaN(numDiscount) || numDiscount < 0) {
          return next(new ApiError(400, 'Discount price must be a non-negative number.'));
        }
        if (numDiscount >= product.price) {
          return next(
            new ApiError(
              400,
              `Discount price (${numDiscount}) must be strictly less than product price (${product.price}).`
            )
          );
        }
        product.discountPrice = numDiscount;
      }
    }

    // Verify category if changed
    if (category && category !== String(product.category)) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return next(new ApiError(400, 'Invalid category ID format.'));
      }
      const categoryDoc = await Category.findById(category);
      if (!categoryDoc) {
        return next(new ApiError(400, 'Referenced category does not exist.'));
      }
      product.category = category;
    }

    if (stockQuantity !== undefined) {
      product.stockQuantity = Math.max(0, parseInt(stockQuantity, 10) || 0);
    }

    if (availabilityStatus) {
      product.availabilityStatus = availabilityStatus;
    }

    if (isFeatured !== undefined) {
      product.isFeatured = Boolean(isFeatured);
    }

    if (unit !== undefined) {
      product.unit = unit.trim();
    }

    if (isOrganicCertified !== undefined) {
      product.isOrganicCertified = Boolean(isOrganicCertified);
    }

    if (subtitle !== undefined) {
      product.subtitle = typeof subtitle === 'string' ? subtitle.trim() : '';
    }

    if (keyIngredients !== undefined) {
      product.keyIngredients = typeof keyIngredients === 'string' ? keyIngredients.trim() : '';
    }

    if (benefits !== undefined) {
      product.benefits = typeof benefits === 'string' ? benefits.trim() : '';
    }

    if (howToUse !== undefined) {
      product.howToUse = typeof howToUse === 'string' ? howToUse.trim() : '';
    }

    if (suitability !== undefined) {
      product.suitability = typeof suitability === 'string' ? suitability.trim() : '';
    }

    if (status && ['active', 'inactive'].includes(status)) {
      product.status = status;
      product.isActive = status === 'active';
    } else if (isActive !== undefined) {
      product.isActive = Boolean(isActive);
      product.status = product.isActive ? 'active' : 'inactive';
    }

    // Process new images if uploaded or provided
    const updatedImages = processProductImages(req);
    if (updatedImages && updatedImages.length > 0) {
      product.images = updatedImages;
    }

    await product.save();

    const populatedProduct = await Product.findById(product._id).populate(
      'category',
      'name slug'
    );

    res
      .status(200)
      .json(new ApiResponse(200, populatedProduct, 'Product updated successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Delete Product
 * @route   DELETE /api/admin/products/:id
 * @access  Protected (Admin only)
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ApiError(400, 'Invalid product ID format.'));
    }

    const product = await Product.findById(id);
    if (!product) {
      return next(new ApiError(404, 'Product not found.'));
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json(
      new ApiResponse(
        200,
        { deletedId: id, name: product.name },
        `Product "${product.name}" deleted successfully.`
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Activate / Deactivate Product Status
 * @route   PATCH /api/admin/products/:id/status
 * @access  Protected (Admin only)
 */
const updateProductStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ApiError(400, 'Invalid product ID format.'));
    }

    const product = await Product.findById(id);
    if (!product) {
      return next(new ApiError(404, 'Product not found.'));
    }

    const { status, isActive } = req.body;

    let targetStatus;
    if (status && ['active', 'inactive'].includes(status)) {
      targetStatus = status;
    } else if (isActive !== undefined) {
      targetStatus = Boolean(isActive) ? 'active' : 'inactive';
    } else {
      // Toggle if no explicit status is provided
      targetStatus = product.status === 'active' ? 'inactive' : 'active';
    }

    product.status = targetStatus;
    product.isActive = targetStatus === 'active';

    await product.save();

    res.status(200).json(
      new ApiResponse(
        200,
        product,
        `Product status updated to "${product.status}".`
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getActiveProducts,
  getProductById,
  getAllAdminProducts,
  updateProduct,
  deleteProduct,
  updateProductStatus,
};

