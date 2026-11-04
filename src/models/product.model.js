const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Image URL is required'],
      trim: true,
    },
    alt: {
      type: String,
      trim: true,
      default: '',
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters long'],
      maxlength: [200, 'Product name cannot exceed 200 characters'],
      index: true,
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    images: {
      type: [imageSchema],
      validate: {
        validator(val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: 'A product must have at least one image',
      },
      default: [],
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    discountPrice: {
      type: Number,
      min: [0, 'Discount price cannot be negative'],
      validate: {
        validator(val) {
          if (val === undefined || val === null) return true;
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) must be strictly less than the regular price',
      },
      default: null,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
      index: true,
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity cannot be negative'],
      default: 0,
    },
    availabilityStatus: {
      type: String,
      enum: {
        values: ['in_stock', 'out_of_stock', 'pre_order', 'discontinued'],
        message: '{VALUE} is not a valid availability status',
      },
      default: 'in_stock',
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    unit: {
      type: String,
      trim: true,
      default: '1 unit', // e.g., '500g', '1 kg', '250ml'
    },
    isOrganicCertified: {
      type: Boolean,
      default: true,
    },
    // Skincare & Botanical Formulation Details
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    keyIngredients: {
      type: String,
      trim: true,
      default: '',
    },
    benefits: {
      type: String,
      trim: true,
      default: '',
    },
    howToUse: {
      type: String,
      trim: true,
      default: '',
    },
    suitability: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: '{VALUE} is not a valid status',
      },
      default: 'active',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Pre-save hook:
 * 1. Generate slug from name
 * 2. Synchronize availability status with stockQuantity
 */
productSchema.pre('save', function (next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Auto-switch availability to out_of_stock if stock is 0 and currently in_stock
  if (this.isModified('stockQuantity')) {
    if (this.stockQuantity <= 0 && this.availabilityStatus === 'in_stock') {
      this.availabilityStatus = 'out_of_stock';
    } else if (this.stockQuantity > 0 && this.availabilityStatus === 'out_of_stock') {
      this.availabilityStatus = 'in_stock';
    }
  }

  // Synchronize isActive boolean with status string
  if (this.isModified('status')) {
    this.isActive = this.status === 'active';
  } else if (this.isModified('isActive')) {
    this.status = this.isActive ? 'active' : 'inactive';
  }

  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;

