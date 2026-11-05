const mongoose = require('mongoose');
const { Order, Product } = require('../models');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { escapeRegex } = require('../utils/sanitize');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valid Status State Machine Transitions
const VALID_STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  pending_price_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned', 'cancelled'],
  delivered: ['returned'],
  cancelled: [], // Terminal state
  returned: [],  // Terminal state
};

/**
 * 1. Customer Order Placement
 * @route   POST /api/orders
 * @access  Public (Customer)
 */
const createOrder = async (req, res, next) => {
  try {
    const {
      customerName: rawCustomerName,
      name,
      customerEmail: rawCustomerEmail,
      email,
      customerPhone: rawCustomerPhone,
      phone,
      deliveryAddress: rawDeliveryAddress,
      address,
      city: rawCity,
      state: rawState,
      pincode,
      postalCode: rawPostalCode,
      landmark: rawLandmark,
      items,
      orderedProducts,
      cart,
      orderType = 'regular',
      customOrderDetails = {},
      paymentMethod = 'cod',
      shippingCharge,
      deliveryCharges: rawDeliveryCharges,
      notes,
      description,
    } = req.body;

    const customerName = (rawCustomerName || name || '').trim();
    const customerEmail = (rawCustomerEmail || email || '').trim();
    const customerPhone = (rawCustomerPhone || phone || '').trim();

    // Validate Customer Details
    if (!customerName) {
      return next(new ApiError(400, 'Customer name is required.'));
    }

    if (!customerEmail || !emailRegex.test(customerEmail)) {
      return next(new ApiError(400, 'A valid customer email address is required.'));
    }

    if (!customerPhone) {
      return next(new ApiError(400, 'Customer phone number is required.'));
    }

    const isCustom = orderType === 'custom';

    // Normalize Delivery Address
    const addrObj = rawDeliveryAddress && typeof rawDeliveryAddress === 'object' ? rawDeliveryAddress : {};
    const street = (addrObj.street || addrObj.address || address || '').trim();
    const state = (addrObj.state || rawState || '').trim();
    const postalCode = (addrObj.postalCode || addrObj.pincode || pincode || rawPostalCode || '').trim();
    const city = (addrObj.city || rawCity || addrObj.district || state || 'Chennai').trim();
    const country = (addrObj.country || 'India').trim();
    const landmark = (addrObj.landmark || rawLandmark || '').trim();

    if (!isCustom && (!street || !state || !postalCode)) {
      return next(
        new ApiError(
          400,
          'Street address, state, and pincode/postal code are required in delivery address.'
        )
      );
    }

    const cleanDeliveryAddress = {
      street: street || (isCustom ? 'Custom Formulation Consultation' : 'N/A'),
      city: city || 'Chennai',
      state: state || 'Tamil Nadu',
      postalCode: postalCode || '600001',
      country: country || 'India',
      landmark: landmark || '',
    };

    const rawItems = items || orderedProducts || cart || [];

    // Case A: Custom Order with No Fixed Price Yet (Awaiting Admin Price Confirmation)
    if (isCustom && (rawItems.length === 0 || customOrderDetails.awaitingPriceConfirmation || description)) {
      const specialInstructions = (
        customOrderDetails.specialInstructions ||
        description ||
        notes ||
        ''
      ).trim();

      if (
        !specialInstructions &&
        (!customOrderDetails.customRequirements || customOrderDetails.customRequirements.length === 0)
      ) {
        return next(
          new ApiError(
            400,
            'Please provide custom order requirements or special instructions for custom orders.'
          )
        );
      }

      const customOrder = await Order.create({
        customerName,
        customerEmail: customerEmail.toLowerCase(),
        customerPhone,
        deliveryAddress: cleanDeliveryAddress,
        orderedProducts: [],
        subtotal: 0,
        deliveryCharges: 0,
        discount: 0,
        finalTotal: 0, // Awaiting admin price confirmation; do not invent a price
        paymentMethod: paymentMethod || 'other',
        paymentStatus: 'pending',
        orderStatus: 'pending_price_confirmation',
        orderType: 'custom',
        stockDeducted: false,
        customOrderDetails: {
          isCustomOrder: true,
          specialInstructions,
          customPackaging: Boolean(customOrderDetails.customPackaging),
          customRequirements: Array.isArray(customOrderDetails.customRequirements)
            ? customOrderDetails.customRequirements
            : [],
          awaitingPriceConfirmation: true,
          priceConfirmed: false,
          confirmedPrice: null,
        },
        statusHistory: [
          {
            status: 'pending_price_confirmation',
            changedAt: new Date(),
            changedBy: 'customer',
            comment: 'Custom order placed by customer; awaiting admin price confirmation',
          },
        ],
      });

      return res.status(201).json(
        new ApiResponse(
          201,
          customOrder,
          'Custom order submitted successfully. Our team will review your requirements and confirm pricing shortly.'
        )
      );
    }

    // Case B: Regular Order (or Custom Order with selected catalog products)
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return next(new ApiError(400, 'Order must contain at least one product item.'));
    }

    const snapshotItems = [];
    const productsToUpdate = [];

    // Process & verify each product against MongoDB directly
    for (const item of rawItems) {
      const isFreeGift =
        item.id === '__free-gift__' ||
        item._id === '__free-gift__' ||
        item.product === '__free-gift__' ||
        (item.name && item.name.toLowerCase().includes('free gift')) ||
        item.price === 0;

      const quantity = parseInt(item.quantity || item.qty || 1, 10);
      if (isNaN(quantity) || quantity <= 0) continue;

      if (isFreeGift) {
        snapshotItems.push({
          name: item.name || 'Special Free Gift',
          price: 0,
          quantity: 1,
          itemTotal: 0,
        });
        continue;
      }

      const rawId = item.product || item.id || item._id;
      let product = null;

      if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
        product = await Product.findById(rawId);
      } else if (rawId && typeof rawId === 'string' && !item.name && !item.price) {
        // If an explicit ID string is provided without product name/price fallback, validate ID format
        if (!mongoose.Types.ObjectId.isValid(rawId)) {
          return next(
            new ApiError(
              400,
              `Invalid product ID format "${rawId}". Expected 24-character hexadecimal ObjectId.`
            )
          );
        }
      }

      if (!product && rawId && typeof rawId === 'string') {
        product = await Product.findOne({ slug: rawId });
      }

      if (!product && item.name && typeof item.name === 'string') {
        product = await Product.findOne({
          name: new RegExp(`^${escapeRegex(item.name.trim())}$`, 'i'),
        });
      }

      if (product) {
        // Check product active status
        if (product.status === 'inactive' || product.isActive === false) {
          return next(
            new ApiError(
              400,
              `Product "${product.name}" is currently inactive and cannot be ordered.`
            )
          );
        }

        if (product.availabilityStatus === 'discontinued') {
          return next(
            new ApiError(
              400,
              `Product "${product.name}" is discontinued and no longer available.`
            )
          );
        }

        // Check sufficient inventory
        if (
          product.stockQuantity !== undefined &&
          quantity > product.stockQuantity
        ) {
          return next(
            new ApiError(
              400,
              `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Requested: ${quantity}.`
            )
          );
        }

        const actualUnitPrice =
          product.discountPrice !== null &&
          product.discountPrice !== undefined &&
          product.discountPrice < product.price
            ? product.discountPrice
            : product.price;

        const itemTotal = Math.round(actualUnitPrice * quantity * 100) / 100;

        snapshotItems.push({
          product: product._id,
          name: product.name,
          price: actualUnitPrice,
          quantity,
          itemTotal,
        });

        productsToUpdate.push({
          product,
          quantity,
        });
      } else {
        // Fallback snapshot if product is custom or unseeded
        const fallbackPrice = parseFloat(item.price) || 0;
        const itemTotal = Math.round(fallbackPrice * quantity * 100) / 100;
        snapshotItems.push({
          name: item.name || `Product (${rawId || 'item'})`,
          price: fallbackPrice,
          quantity,
          itemTotal,
        });
      }
    }

    if (snapshotItems.length === 0) {
      return next(new ApiError(400, 'Order must contain at least one valid product item.'));
    }

    // Backend calculation of financials
    const subtotal = Math.round(
      snapshotItems.reduce((acc, item) => acc + item.itemTotal, 0) * 100
    ) / 100;

    // Delivery calculation: Free delivery above ₹300, else supplied charge or flat ₹50
    let deliveryCharges = 0;
    if (subtotal < 300) {
      if (shippingCharge !== undefined && shippingCharge !== null) {
        deliveryCharges = parseFloat(shippingCharge) || 0;
      } else if (rawDeliveryCharges !== undefined && rawDeliveryCharges !== null) {
        deliveryCharges = parseFloat(rawDeliveryCharges) || 0;
      } else {
        deliveryCharges = 50;
      }
    }

    const discount = 0;
    const finalTotal = Math.round((subtotal + deliveryCharges - discount) * 100) / 100;

    // Prevent duplicate order submissions within rapid 15-second window
    const recentDuplicate = await Order.findOne({
      customerEmail: customerEmail.toLowerCase(),
      customerPhone,
      finalTotal,
      createdAt: { $gte: new Date(Date.now() - 15000) },
    });

    if (recentDuplicate) {
      return res.status(200).json(
        new ApiResponse(
          200,
          recentDuplicate,
          'Your order has already been received and is being processed.'
        )
      );
    }

    // Deduct stock for verified products
    for (const update of productsToUpdate) {
      const newStock = Math.max(0, update.product.stockQuantity - update.quantity);
      const newAvailability =
        newStock === 0 && update.product.availabilityStatus === 'in_stock'
          ? 'out_of_stock'
          : update.product.availabilityStatus;

      await Product.findByIdAndUpdate(update.product._id, {
        $inc: { stockQuantity: -update.quantity },
        availabilityStatus: newAvailability,
      });
    }

    // Create Order Document
    const order = await Order.create({
      customerName,
      customerEmail: customerEmail.toLowerCase(),
      customerPhone,
      deliveryAddress: cleanDeliveryAddress,
      orderedProducts: snapshotItems,
      subtotal,
      deliveryCharges,
      discount,
      finalTotal,
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'pending',
      orderType: isCustom ? 'custom' : 'regular',
      stockDeducted: productsToUpdate.length > 0,
      customOrderDetails: isCustom
        ? {
            isCustomOrder: true,
            specialInstructions: customOrderDetails.specialInstructions || notes || '',
            customPackaging: Boolean(customOrderDetails.customPackaging),
            customRequirements: Array.isArray(customOrderDetails.customRequirements)
              ? customOrderDetails.customRequirements
              : [],
            awaitingPriceConfirmation: false,
            priceConfirmed: true,
            confirmedPrice: finalTotal,
          }
        : {
            isCustomOrder: false,
            specialInstructions: notes || '',
          },
      statusHistory: [
        {
          status: 'pending',
          changedAt: new Date(),
          changedBy: 'customer',
          comment: 'Order placed by customer',
        },
      ],
    });

    res
      .status(201)
      .json(new ApiResponse(201, order, 'Order placed successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get All Orders for Admin
 * @route   GET /api/admin/orders
 * @access  Protected (Admin only)
 */
const getAllAdminOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 15,
      status,
      paymentStatus,
      orderType,
      search,
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (status && status.trim()) {
      query.orderStatus = status.trim();
    }

    if (paymentStatus && paymentStatus.trim()) {
      query.paymentStatus = paymentStatus.trim();
    }

    if (orderType && ['regular', 'custom'].includes(orderType.trim())) {
      query.orderType = orderType.trim();
    }

    // Search by orderId or customer info (escaped to prevent ReDoS / query injection)
    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { orderId: searchRegex },
        { customerName: searchRegex },
        { customerEmail: searchRegex },
        { customerPhone: searchRegex },
      ];
    }

    // Filter by order date range
    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) {
        query.orderDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.orderDate.$lte = toDate;
      }
    }

    const [totalOrders, orders] = await Promise.all([
      Order.countDocuments(query),
      Order.find(query)
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const totalPages = Math.ceil(totalOrders / limitNum);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          orders,
          pagination: {
            total: totalOrders,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
          },
        },
        'Orders retrieved successfully.'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get Order Details by ID for Admin
 * @route   GET /api/admin/orders/:id
 * @access  Protected (Admin only)
 */
const getAdminOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id)
        .populate('orderedProducts.product', 'name images slug price availabilityStatus')
        .lean();
    }

    if (!order) {
      order = await Order.findOne({ orderId: id.toUpperCase().trim() })
        .populate('orderedProducts.product', 'name images slug price availabilityStatus')
        .lean();
    }

    if (!order) {
      return next(new ApiError(404, 'Order not found.'));
    }

    res
      .status(200)
      .json(new ApiResponse(200, order, 'Order details retrieved successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Update Order Status (Admin)
 * Validates state machine transitions, tracks history, and restores stock on cancellation
 * @route   PATCH /api/admin/orders/:id/status
 * @access  Protected (Admin only)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comment, confirmedPrice } = req.body;
    const status = req.body.status || req.body.orderStatus;

    if (!status || typeof status !== 'string') {
      return next(new ApiError(400, 'New order status is required.'));
    }

    const targetStatus = status.trim().toLowerCase();

    // Find order
    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderId: id.toUpperCase().trim() });
    }
    if (!order) {
      return next(new ApiError(404, 'Order not found.'));
    }

    const currentStatus = order.orderStatus;

    // Reject changes on terminal states
    if (currentStatus === 'cancelled' || currentStatus === 'returned') {
      return next(
        new ApiError(
          400,
          `Cannot modify order status. Order is already in terminal state: "${currentStatus}".`
        )
      );
    }

    // Validate state machine transition
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(targetStatus)) {
      return next(
        new ApiError(
          400,
          `Invalid status transition from "${currentStatus}" to "${targetStatus}". Allowed next statuses: [${allowedTransitions.join(
            ', '
          )}].`
        )
      );
    }

    // Stock Restoration Guard:
    // If transitioning to 'cancelled' and stock was deducted, safely restore inventory
    if (targetStatus === 'cancelled' && order.stockDeducted) {
      if (Array.isArray(order.orderedProducts)) {
        for (const item of order.orderedProducts) {
          if (item.product && item.quantity) {
            await Product.findByIdAndUpdate(item.product, {
              $inc: { stockQuantity: item.quantity },
              availabilityStatus: 'in_stock', // Reactivate stock availability
            });
          }
        }
      }
      order.stockDeducted = false; // Prevents double restoration
    }

    // Custom Order Price Confirmation
    if (
      currentStatus === 'pending_price_confirmation' &&
      targetStatus === 'confirmed'
    ) {
      if (confirmedPrice !== undefined && confirmedPrice !== null) {
        const numPrice = Number(confirmedPrice);
        if (isNaN(numPrice) || numPrice < 0) {
          return next(
            new ApiError(400, 'Confirmed price must be a valid non-negative number.')
          );
        }
        order.customOrderDetails.confirmedPrice = numPrice;
        order.customOrderDetails.priceConfirmed = true;
        order.customOrderDetails.awaitingPriceConfirmation = false;
        order.subtotal = numPrice;
        order.finalTotal = numPrice;
      }
    }

    order.orderStatus = targetStatus;

    // Append to status audit history
    order.statusHistory.push({
      status: targetStatus,
      changedAt: new Date(),
      changedBy: req.admin?.email || 'admin',
      comment: comment ? comment.trim() : `Status updated to ${targetStatus}`,
    });

    await order.save();

    res.status(200).json(
      new ApiResponse(
        200,
        order,
        `Order status successfully updated to "${targetStatus}".`
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Update Payment Information (Admin)
 * @route   PATCH /api/admin/orders/:id/payment
 * @access  Protected (Admin only)
 */
const updatePaymentInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentStatus, transactionReference, paymentMethod, paymentAmount } =
      req.body;

    if (!paymentStatus && !transactionReference && !paymentMethod) {
      return next(
        new ApiError(
          400,
          'Please provide paymentStatus, transactionReference, or paymentMethod to update.'
        )
      );
    }

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderId: id.toUpperCase().trim() });
    }
    if (!order) {
      return next(new ApiError(404, 'Order not found.'));
    }

    // Validate payment status
    if (paymentStatus) {
      const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
      if (!validStatuses.includes(paymentStatus)) {
        return next(
          new ApiError(
            400,
            `Invalid payment status "${paymentStatus}". Allowed: ${validStatuses.join(
              ', '
            )}.`
          )
        );
      }

      // Security requirement: Do not mark as paid without verified payment information
      if (paymentStatus === 'paid') {
        const effectiveRef =
          transactionReference || order.transactionReference;
        if (!effectiveRef && order.paymentMethod !== 'cod') {
          return next(
            new ApiError(
              400,
              'A valid transaction/reference ID is required to mark non-COD orders as paid.'
            )
          );
        }
        order.paidAt = new Date();
      }

      order.paymentStatus = paymentStatus;
    }

    if (transactionReference !== undefined) {
      order.transactionReference = transactionReference ? transactionReference.trim() : null;
    }

    if (paymentMethod) {
      const validMethods = ['cod', 'card', 'upi', 'netbanking', 'wallet', 'other'];
      if (!validMethods.includes(paymentMethod)) {
        return next(
          new ApiError(
            400,
            `Invalid payment method "${paymentMethod}". Allowed: ${validMethods.join(
              ', '
            )}.`
          )
        );
      }
      order.paymentMethod = paymentMethod;
    }

    // Append to audit history
    order.statusHistory.push({
      status: order.orderStatus,
      changedAt: new Date(),
      changedBy: req.admin?.email || 'admin',
      comment: `Payment details updated: status=${order.paymentStatus}${
        order.transactionReference ? `, ref=${order.transactionReference}` : ''
      }`,
    });

    await order.save();

    res.status(200).json(
      new ApiResponse(
        200,
        order,
        `Payment information updated successfully.`
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Order Statistics Summary (Admin Dashboard)
 * @route   GET /api/admin/orders/stats
 * @access  Protected (Admin only)
 */
const getOrderStats = async (req, res, next) => {
  try {
    const [
      totalOrders,
      pending,
      pendingPriceConfirmation,
      confirmed,
      processing,
      shipped,
      delivered,
      cancelled,
      returned,
      customOrdersCount,
      paidOrdersCount,
      unpaidOrdersCount,
    ] = await Promise.all([
      Order.countDocuments({}),
      Order.countDocuments({ orderStatus: 'pending' }),
      Order.countDocuments({ orderStatus: 'pending_price_confirmation' }),
      Order.countDocuments({ orderStatus: 'confirmed' }),
      Order.countDocuments({ orderStatus: 'processing' }),
      Order.countDocuments({ orderStatus: 'shipped' }),
      Order.countDocuments({ orderStatus: 'delivered' }),
      Order.countDocuments({ orderStatus: 'cancelled' }),
      Order.countDocuments({ orderStatus: 'returned' }),
      Order.countDocuments({ orderType: 'custom' }),
      Order.countDocuments({ paymentStatus: 'paid' }),
      Order.countDocuments({ paymentStatus: { $ne: 'paid' } }),
    ]);

    const stats = {
      totalOrders,
      byStatus: {
        pending,
        pendingPriceConfirmation,
        confirmed,
        processing,
        shipped,
        delivered,
        cancelled,
        returned,
      },
      byType: {
        regular: totalOrders - customOrdersCount,
        custom: customOrdersCount,
      },
      byPayment: {
        paid: paidOrdersCount,
        unpaid: unpaidOrdersCount,
      },
    };

    res
      .status(200)
      .json(new ApiResponse(200, stats, 'Order statistics retrieved successfully.'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getAllAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  updatePaymentInfo,
  getOrderStats,
};

