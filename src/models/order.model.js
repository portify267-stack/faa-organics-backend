const mongoose = require('mongoose');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Ordered item schema preserving product snapshot details at time of purchase
 */
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: false,
    },
    name: {
      type: String,
      required: [true, 'Product name at order time is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price at order time is required'],
      min: [0, 'Item price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    itemTotal: {
      type: Number,
      required: [true, 'Item total is required'],
      min: [0, 'Item total cannot be negative'],
    },
  },
  { _id: false }
);

/**
 * Customer delivery address schema
 */
const deliveryAddressSchema = new mongoose.Schema(
  {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      default: 'India',
    },
    landmark: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

/**
 * Custom order details schema
 */
const customOrderDetailsSchema = new mongoose.Schema(
  {
    isCustomOrder: {
      type: Boolean,
      default: false,
    },
    specialInstructions: {
      type: String,
      trim: true,
      maxlength: [1000, 'Special instructions cannot exceed 1000 characters'],
      default: '',
    },
    customPackaging: {
      type: Boolean,
      default: false,
    },
    customRequirements: {
      type: [String],
      default: [],
    },
    awaitingPriceConfirmation: {
      type: Boolean,
      default: false,
    },
    priceConfirmed: {
      type: Boolean,
      default: false,
    },
    confirmedPrice: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  { _id: false }
);

/**
 * Status history schema for tracking order state transitions and timestamps
 */
const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: String,
      default: 'system', // 'customer' | 'admin' | admin email / ID
    },
    comment: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

/**
 * Main Order Schema
 */
const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: [true, 'Unique order ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    // Customer Details
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      minlength: [2, 'Customer name must be at least 2 characters long'],
    },
    customerEmail: {
      type: String,
      required: [true, 'Customer email is required'],
      trim: true,
      lowercase: true,
      match: [emailRegex, 'Please provide a valid customer email'],
      index: true,
    },
    customerPhone: {
      type: String,
      required: [true, 'Customer phone number is required'],
      trim: true,
      index: true,
    },
    deliveryAddress: {
      type: deliveryAddressSchema,
      required: [true, 'Delivery address is required'],
    },

    // Order Items
    orderedProducts: {
      type: [orderItemSchema],
      validate: {
        validator(items) {
          if (this.orderType === 'custom') return true;
          return Array.isArray(items) && items.length > 0;
        },
        message: 'An order must contain at least one product item',
      },
    },

    // Financial breakdown
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },
    deliveryCharges: {
      type: Number,
      min: [0, 'Delivery charges cannot be negative'],
      default: 0,
    },
    discount: {
      type: Number,
      min: [0, 'Discount cannot be negative'],
      default: 0,
    },
    finalTotal: {
      type: Number,
      required: [true, 'Final total is required'],
      min: [0, 'Final total cannot be negative'],
      index: true,
    },

    // Payment Details
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: {
        values: ['cod', 'card', 'upi', 'netbanking', 'wallet', 'other'],
        message: '{VALUE} is not a supported payment method',
      },
      default: 'cod',
      index: true,
    },
    paymentStatus: {
      type: String,
      required: [true, 'Payment status is required'],
      enum: {
        values: ['pending', 'paid', 'failed', 'refunded'],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'pending',
      index: true,
    },
    transactionReference: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },

    // Order Processing Details
    orderStatus: {
      type: String,
      required: [true, 'Order status is required'],
      enum: {
        values: [
          'pending',
          'pending_price_confirmation',
          'confirmed',
          'processing',
          'shipped',
          'delivered',
          'cancelled',
          'returned',
        ],
        message: '{VALUE} is not a valid order status',
      },
      default: 'pending',
      index: true,
    },
    orderDate: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Stock deduction idempotency guard
    stockDeducted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Status transition tracking history
    statusHistory: {
      type: [statusHistorySchema],
      default: () => [
        {
          status: 'pending',
          changedAt: new Date(),
          changedBy: 'customer',
          comment: 'Order placed by customer',
        },
      ],
    },

    // Order Type & Custom Order Information
    orderType: {
      type: String,
      enum: {
        values: ['regular', 'custom'],
        message: '{VALUE} is not a valid order type',
      },
      default: 'regular',
      index: true,
    },
    customOrderDetails: {
      type: customOrderDetailsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// -----------------------------------------------------------------------------
// Compound Indexes for Sales Reporting & Dashboard Analytics
// -----------------------------------------------------------------------------
// Optimal compound index for month-by-month sales revenue calculation:
orderSchema.index({ paymentStatus: 1, orderStatus: 1, orderDate: -1 });

// Querying customer orders:
orderSchema.index({ customerEmail: 1, orderDate: -1 });

// -----------------------------------------------------------------------------
// Pre-validate Hook: Auto-calculate and verify financial totals
// -----------------------------------------------------------------------------
orderSchema.pre('validate', function (next) {
  // Auto-generate orderId if not provided (e.g. FAO-20261031-98765)
  if (!this.orderId) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.random().toString(36).substring(2, 7).toUpperCase();
    this.orderId = `FAO-${dateStr}-${randomHex}`;
  }

  // Calculate item totals if items exist
  if (Array.isArray(this.orderedProducts)) {
    this.orderedProducts.forEach((item) => {
      if (item.price !== undefined && item.quantity !== undefined) {
        item.itemTotal = Math.round(item.price * item.quantity * 100) / 100;
      }
    });

    // Auto-compute subtotal if not explicitly supplied
    if (this.subtotal === undefined || this.subtotal === null) {
      this.subtotal = this.orderedProducts.reduce(
        (sum, item) => sum + (item.itemTotal || 0),
        0
      );
    }
  }

  // Auto-compute finalTotal: subtotal + deliveryCharges - discount
  if (this.finalTotal === undefined || this.finalTotal === null) {
    const sub = this.subtotal || 0;
    const delivery = this.deliveryCharges || 0;
    const disc = this.discount || 0;
    this.finalTotal = Math.max(0, Math.round((sub + delivery - disc) * 100) / 100);
  }

  // Synchronize custom order flag with orderType
  if (this.orderType === 'custom' && this.customOrderDetails) {
    this.customOrderDetails.isCustomOrder = true;
  }

  next();
});

// -----------------------------------------------------------------------------
// Static Methods for Sales Reporting (Used by Admin Panel Sales Dashboard)
// -----------------------------------------------------------------------------

/**
 * Calculates actual sales for the last N months (default: 6), grouped month by month.
 * Strictly adheres to business rules:
 * - Excludes cancelled and returned orders from sales revenue
 * - Excludes unpaid orders from completed revenue (only paymentStatus: 'paid')
 * - Uses actual Order collection records as single source of truth
 *
 * @param {number} monthsCount - Number of months to calculate (default: 6)
 * @returns {Promise<Array<{ year: number, month: number, label: string, totalRevenue: number, totalOrders: number, averageOrderValue: number }>>}
 */
orderSchema.statics.getMonthlySalesStats = async function (monthsCount = 6) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - (monthsCount - 1));
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const pipeline = [
    {
      $match: {
        paymentStatus: 'paid', // Exclude unpaid orders from revenue
        orderStatus: { $nin: ['cancelled', 'returned'] }, // Exclude cancelled orders
        orderDate: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$orderDate' },
          month: { $month: '$orderDate' },
        },
        totalRevenue: { $sum: '$finalTotal' },
        totalOrders: { $sum: 1 },
        averageOrderValue: { $avg: '$finalTotal' },
      },
    },
    {
      $sort: {
        '_id.year': 1,
        '_id.month': 1,
      },
    },
  ];

  const results = await this.aggregate(pipeline);

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  return results.map((item) => ({
    year: item._id.year,
    month: item._id.month,
    label: `${monthNames[item._id.month - 1]} ${item._id.year}`,
    totalRevenue: Math.round(item.totalRevenue * 100) / 100,
    totalOrders: item.totalOrders,
    averageOrderValue: Math.round(item.averageOrderValue * 100) / 100,
  }));
};

/**
 * Overall Sales Summary (total completed revenue, pending revenue, order counts)
 * @returns {Promise<Object>}
 */
orderSchema.statics.getSalesSummary = async function () {
  const summary = await this.aggregate([
    {
      $facet: {
        completedSales: [
          {
            $match: {
              paymentStatus: 'paid',
              orderStatus: { $nin: ['cancelled', 'returned'] },
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$finalTotal' },
              totalOrders: { $sum: 1 },
              averageOrderValue: { $avg: '$finalTotal' },
            },
          },
        ],
        pendingSales: [
          {
            $match: {
              paymentStatus: 'pending',
              orderStatus: { $nin: ['cancelled', 'returned'] },
            },
          },
          {
            $group: {
              _id: null,
              pendingRevenue: { $sum: '$finalTotal' },
              pendingOrders: { $sum: 1 },
            },
          },
        ],
        cancelledOrders: [
          {
            $match: {
              orderStatus: 'cancelled',
            },
          },
          {
            $group: {
              _id: null,
              cancelledCount: { $sum: 1 },
              cancelledAmount: { $sum: '$finalTotal' },
            },
          },
        ],
      },
    },
  ]);

  const completed = summary[0]?.completedSales[0] || {
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
  };
  const pending = summary[0]?.pendingSales[0] || {
    pendingRevenue: 0,
    pendingOrders: 0,
  };
  const cancelled = summary[0]?.cancelledOrders[0] || {
    cancelledCount: 0,
    cancelledAmount: 0,
  };

  return {
    completedRevenue: Math.round(completed.totalRevenue * 100) / 100,
    completedOrdersCount: completed.totalOrders,
    averageOrderValue: Math.round(completed.averageOrderValue * 100) / 100,
    pendingRevenue: Math.round(pending.pendingRevenue * 100) / 100,
    pendingOrdersCount: pending.pendingOrders,
    cancelledOrdersCount: cancelled.cancelledCount,
    cancelledAmount: Math.round(cancelled.cancelledAmount * 100) / 100,
  };
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;

