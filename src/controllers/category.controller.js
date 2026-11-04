const mongoose = require('mongoose');
const { Category, Product } = require('../models');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { escapeRegex } = require('../utils/sanitize');
const { processCategoryImage } = require('../middleware/upload.middleware');

/**
 * 1. Create Category
 * @route   POST /api/admin/categories
 * @access  Protected (Admin only)
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, description, status, isActive } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return next(new ApiError(400, 'Category name is required.'));
    }

    const cleanName = name.trim();

    // Prevent duplicate category names
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') },
    });

    if (existingCategory) {
      return next(
        new ApiError(409, `Category with name "${cleanName}" already exists.`)
      );
    }

    const image = processCategoryImage(req);

    const category = await Category.create({
      name: cleanName,
      description: description ? description.trim() : '',
      image,
      status: status || (isActive === false ? 'inactive' : 'active'),
      isActive: isActive !== undefined ? Boolean(isActive) : status !== 'inactive',
    });

    res
      .status(201)
      .json(new ApiResponse(201, category, 'Category created successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get Active Categories (Customer Website)
 * @route   GET /api/categories
 * @access  Public
 */
const getActiveCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({
      isActive: true,
      status: 'active',
    })
      .select('name slug description image displayOrder createdAt')
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          total: categories.length,
          categories,
        },
        'Active categories retrieved successfully.'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get All Categories for Admin Management
 * @route   GET /api/admin/categories
 * @access  Protected (Admin only)
 */
const getAllAdminCategories = async (req, res, next) => {
  try {
    const { search, status } = req.query;

    const query = {};

    if (search && typeof search === 'string' && search.trim()) {
      query.name = { $regex: escapeRegex(search.trim()), $options: 'i' };
    }

    if (status && ['active', 'inactive'].includes(status)) {
      query.status = status;
    }

    const categories = await Category.find(query).sort({ displayOrder: 1, createdAt: -1 });

    // Attach product count to each category for administrative visibility
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        let productCount = 0;
        try {
          productCount = await Product.countDocuments({ category: cat._id });
        } catch {
          productCount = 0;
        }
        return {
          ...cat.toObject(),
          productCount,
        };
      })
    );

    res.status(200).json(
      new ApiResponse(
        200,
        {
          total: categoriesWithCounts.length,
          categories: categoriesWithCounts,
        },
        'Admin categories retrieved successfully.'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Get Single Category by ID or Slug
 * @route   GET /api/categories/:id
 * @access  Public
 */
const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let category = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      category = await Category.findById(id);
    }

    if (!category) {
      category = await Category.findOne({ slug: id.toLowerCase().trim() });
    }

    if (!category) {
      return next(new ApiError(404, 'Category not found.'));
    }

    res
      .status(200)
      .json(new ApiResponse(200, category, 'Category retrieved successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Update Category
 * @route   PUT /api/admin/categories/:id
 * @access  Protected (Admin only)
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ApiError(400, 'Invalid category ID format.'));
    }

    const category = await Category.findById(id);
    if (!category) {
      return next(new ApiError(404, 'Category not found.'));
    }

    const { name, description, status, isActive } = req.body;

    // Check duplicate name if name changed
    if (name && name.trim().toLowerCase() !== category.name.toLowerCase()) {
      const cleanName = name.trim();
      const duplicate = await Category.findOne({
        name: { $regex: new RegExp(`^${cleanName}$`, 'i') },
        _id: { $ne: id },
      });

      if (duplicate) {
        return next(
          new ApiError(409, `Category with name "${cleanName}" already exists.`)
        );
      }
      category.name = cleanName;
    }

    if (description !== undefined) {
      category.description = description.trim();
    }

    // Process updated image if provided
    const newImage = processCategoryImage(req);
    if (newImage && newImage.url) {
      category.image = newImage;
    }

    if (status && ['active', 'inactive'].includes(status)) {
      category.status = status;
      category.isActive = status === 'active';
    } else if (isActive !== undefined) {
      category.isActive = Boolean(isActive);
      category.status = category.isActive ? 'active' : 'inactive';
    }

    await category.save();

    res
      .status(200)
      .json(new ApiResponse(200, category, 'Category updated successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Delete Category
 * @route   DELETE /api/admin/categories/:id
 * @access  Protected (Admin only)
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ApiError(400, 'Invalid category ID format.'));
    }

    const category = await Category.findById(id);
    if (!category) {
      return next(new ApiError(404, 'Category not found.'));
    }

    // Crucial validation: Prevent deletion if products are currently assigned
    const assignedProductsCount = await Product.countDocuments({ category: id });
    if (assignedProductsCount > 0) {
      return next(
        new ApiError(
          400,
          `Cannot delete category "${category.name}" because ${assignedProductsCount} product(s) are assigned to it. Please reassign or delete these products first.`
        )
      );
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json(
      new ApiResponse(
        200,
        { deletedId: id, name: category.name },
        `Category "${category.name}" deleted successfully.`
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Activate / Deactivate Category Status
 * @route   PATCH /api/admin/categories/:id/status
 * @access  Protected (Admin only)
 */
const updateCategoryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ApiError(400, 'Invalid category ID format.'));
    }

    const category = await Category.findById(id);
    if (!category) {
      return next(new ApiError(404, 'Category not found.'));
    }

    const { status, isActive } = req.body;

    let targetStatus;
    if (status && ['active', 'inactive'].includes(status)) {
      targetStatus = status;
    } else if (isActive !== undefined) {
      targetStatus = Boolean(isActive) ? 'active' : 'inactive';
    } else {
      // Toggle if no explicit status is provided
      targetStatus = category.status === 'active' ? 'inactive' : 'active';
    }

    category.status = targetStatus;
    category.isActive = targetStatus === 'active';

    await category.save();

    res.status(200).json(
      new ApiResponse(
        200,
        category,
        `Category status updated to "${category.status}".`
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory,
  getActiveCategories,
  getAllAdminCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  updateCategoryStatus,
};

