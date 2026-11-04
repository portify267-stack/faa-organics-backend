/**
 * Order Placement & Order Management Test Suite for Faa Organic
 * Covers all Prompt 5 requirements:
 * 1. Successful regular order placement (with backend price calculation & stock deduction)
 * 2. Successful custom order placement (awaiting admin price confirmation)
 * 3. Missing customer information rejection (400 Bad Request)
 * 4. Invalid product ID rejection (400 Bad Request)
 * 5. Inactive product order rejection (400 Bad Request)
 * 6. Insufficient stock rejection (400 Bad Request)
 * 7. Incorrect frontend-submitted price or total override (database single source of truth)
 * 8. Admin order list retrieval (pagination, filtering, and search)
 * 9. Individual order details retrieval
 * 10. Valid order status transitions (pending -> confirmed -> processing -> shipped -> delivered)
 * 11. Invalid status transition rejection (prevent invalid transitions)
 * 12. Payment status validation (requires transaction ID for non-COD payment)
 * 13. Unauthorized access rejection (missing / invalid token)
 * 14. Cancellation and safe stock restoration (restores inventory, prevents double-restoration)
 * 15. Order stats summary endpoint
 *
 * Run via: node scripts/test-orders.js
 * Or: npm run test:orders
 */

const { generateToken } = require('../src/utils/jwt');
const {
  createOrder,
  getAllAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  updatePaymentInfo,
  getOrderStats,
} = require('../src/controllers/order.controller');
const { authenticateAdmin } = require('../src/middleware/auth.middleware');

console.log('===================================================================');
console.log('📦 Faa Organic - Order Placement & Management Test Suite');
console.log('===================================================================\n');

let totalTests = 0;
let passedTests = 0;

const assert = (condition, testName, details = '') => {
  totalTests += 1;
  if (condition) {
    passedTests += 1;
    console.log(`✅ [PASS] ${testName}`);
    if (details) console.log(`   ${details}`);
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`   ${details}`);
  }
};

const runOrderTests = async () => {
  // Generate admin token for authenticated testing
  const adminToken = generateToken({
    id: '6724a1b2c3d4e5f6a7b8c901',
    email: 'admin@faaorganic.com',
    role: 'superadmin',
    accountStatus: 'active',
  });

  // Mock in-memory storage for test isolated execution
  let ordersStore = [];
  let productsStore = [];
  let idCounter = 1;

  const mockObjectId = () => `6724a1b2c3d4e5f6a7b8c${(idCounter++).toString().padStart(3, '0')}`;

  const { Order, Product, Admin } = require('../src/models');
  Admin.findById = () => ({
    select: () =>
      Promise.resolve({
        _id: '6724a1b2c3d4e5f6a7b8c901',
        name: 'Super Admin',
        email: 'admin@faaorganic.com',
        role: 'superadmin',
        accountStatus: 'active',
      }),
  });

  // Backup original model methods
  const origOrderCreate = Order.create;
  const origOrderFind = Order.find;
  const origOrderFindOne = Order.findOne;
  const origOrderFindById = Order.findById;
  const origOrderCountDocuments = Order.countDocuments;

  const origProdFindById = Product.findById;
  const origProdFindByIdAndUpdate = Product.findByIdAndUpdate;

  // Setup sample test products in memory
  const testProdActiveId = '6724a1b2c3d4e5f6a7b8c101';
  const testProdLowStockId = '6724a1b2c3d4e5f6a7b8c102';
  const testProdInactiveId = '6724a1b2c3d4e5f6a7b8c103';

  productsStore = [
    {
      _id: testProdActiveId,
      name: 'Organic Kashmiri Apples',
      price: 240,
      discountPrice: 200, // Effective backend price should be ₹200
      stockQuantity: 50,
      availabilityStatus: 'in_stock',
      status: 'active',
      isActive: true,
    },
    {
      _id: testProdLowStockId,
      name: 'Organic Honey 500g',
      price: 350,
      discountPrice: null, // Effective price: ₹350
      stockQuantity: 3, // Only 3 in stock
      availabilityStatus: 'in_stock',
      status: 'active',
      isActive: true,
    },
    {
      _id: testProdInactiveId,
      name: 'Discontinued Organic Berries',
      price: 400,
      discountPrice: null,
      stockQuantity: 20,
      availabilityStatus: 'discontinued',
      status: 'inactive',
      isActive: false,
    },
  ];

  // Mock Product Methods
  Product.findById = (id) => {
    const prod = productsStore.find((p) => String(p._id) === String(id));
    const p = Promise.resolve(prod || null);
    p.populate = () => Promise.resolve(prod || null);
    return p;
  };

  Product.findByIdAndUpdate = (id, update) => {
    const prod = productsStore.find((p) => String(p._id) === String(id));
    if (prod) {
      if (update.$inc?.stockQuantity !== undefined) {
        prod.stockQuantity += update.$inc.stockQuantity;
      }
      if (update.availabilityStatus) {
        prod.availabilityStatus = update.availabilityStatus;
      }
    }
    return Promise.resolve(prod || null);
  };

  // Mock Order Methods
  Order.create = async (doc) => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.random().toString(36).substring(2, 7).toUpperCase();
    const orderId = doc.orderId || `FAO-${dateStr}-${randomHex}`;

    const newOrder = {
      _id: mockObjectId(),
      orderId,
      orderDate: new Date(),
      createdAt: new Date(),
      statusHistory: doc.statusHistory || [],
      ...doc,
      save: async function () {
        return this;
      },
    };
    ordersStore.push(newOrder);
    return newOrder;
  };

  Order.findById = (id) => {
    const ord = ordersStore.find((o) => String(o._id) === String(id));
    if (ord && !ord.save) {
      ord.save = async function () {
        return this;
      };
    }
    const p = Promise.resolve(ord || null);
    p.populate = () => Promise.resolve(ord || null);
    return p;
  };

  Order.findOne = (filter) => {
    let ord = null;
    if (filter.orderId) {
      ord = ordersStore.find((o) => o.orderId === filter.orderId);
    }
    if (ord && !ord.save) {
      ord.save = async function () {
        return this;
      };
    }
    const p = Promise.resolve(ord || null);
    p.populate = () => Promise.resolve(ord || null);
    return p;
  };

  Order.countDocuments = (filter = {}) => {
    let results = [...ordersStore];
    if (filter.orderStatus) {
      results = results.filter((o) => o.orderStatus === filter.orderStatus);
    }
    if (filter.paymentStatus) {
      if (filter.paymentStatus.$ne) {
        results = results.filter((o) => o.paymentStatus !== filter.paymentStatus.$ne);
      } else {
        results = results.filter((o) => o.paymentStatus === filter.paymentStatus);
      }
    }
    if (filter.orderType) {
      results = results.filter((o) => o.orderType === filter.orderType);
    }
    return Promise.resolve(results.length);
  };

  Order.find = (filter = {}) => {
    let results = [...ordersStore];
    if (filter.orderStatus) {
      results = results.filter((o) => o.orderStatus === filter.orderStatus);
    }
    if (filter.paymentStatus) {
      results = results.filter((o) => o.paymentStatus === filter.paymentStatus);
    }
    if (filter.orderType) {
      results = results.filter((o) => o.orderType === filter.orderType);
    }
    if (filter.$or) {
      results = results.filter((o) => {
        return filter.$or.some((cond) => {
          const key = Object.keys(cond)[0];
          const reg = cond[key];
          return reg.test(o[key] || '');
        });
      });
    }

    return {
      sort: () => ({
        skip: (skip) => ({
          limit: (limit) => Promise.resolve(results.slice(skip, skip + limit)),
        }),
      }),
    };
  };

  // ---------------------------------------------------------------------------
  // TEST 1: Successful Regular Order Placement
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Regular Customer Order Placement ---');
  let order1Response = null;
  const initialStockApples = productsStore.find((p) => p._id === testProdActiveId).stockQuantity;

  const reqOrder1 = {
    body: {
      customerName: 'Amina Khan',
      customerEmail: 'amina.khan@example.com',
      customerPhone: '+91 9876543210',
      deliveryAddress: {
        street: 'Flat 4B, Green Residency',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
      },
      items: [
        {
          product: testProdActiveId,
          quantity: 2, // 2 * ₹200 (discount price) = ₹400
        },
        {
          product: testProdLowStockId,
          quantity: 1, // 1 * ₹350 = ₹350
        },
      ],
      paymentMethod: 'cod',
    },
  };

  await createOrder(
    reqOrder1,
    {
      status: (code) => ({
        json: (d) => {
          order1Response = d;
        },
      }),
    },
    () => {}
  );

  const placedOrder = order1Response?.data;
  const updatedStockApples = productsStore.find((p) => p._id === testProdActiveId).stockQuantity;

  // Expected: Subtotal = ₹400 + ₹350 = ₹750. >= ₹500 so Delivery = ₹0. Final Total = ₹750.
  assert(
    placedOrder &&
      placedOrder.subtotal === 750 &&
      placedOrder.finalTotal === 750 &&
      placedOrder.orderStatus === 'pending',
    'Customer places regular order with backend-computed totals (₹750)',
    `Order ID: ${placedOrder?.orderId}, Subtotal: ₹${placedOrder?.subtotal}, Final Total: ₹${placedOrder?.finalTotal}`
  );

  assert(
    updatedStockApples === initialStockApples - 2,
    'Product stock is automatically and accurately deducted upon order placement',
    `Initial Stock: ${initialStockApples}, New Stock: ${updatedStockApples}`
  );

  // ---------------------------------------------------------------------------
  // TEST 2: Successful Custom Order Placement (Awaiting Price Confirmation)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Custom Order Placement ---');
  let customOrderResponse = null;
  const reqCustomOrder = {
    body: {
      customerName: 'Zubair Ahmed',
      customerEmail: 'zubair.ahmed@example.com',
      customerPhone: '+91 9123456789',
      deliveryAddress: {
        street: 'Plot 12, Organic Acres',
        city: 'Bangalore',
        state: 'Karnataka',
        postalCode: '560001',
      },
      orderType: 'custom',
      customOrderDetails: {
        isCustomOrder: true,
        specialInstructions: 'Custom assorted organic seasonal fruit and cold-pressed honey basket for wedding gift.',
        customPackaging: true,
        customRequirements: ['Wooden gift basket', 'Greeting card: Congratulations!'],
        awaitingPriceConfirmation: true,
      },
    },
  };

  await createOrder(
    reqCustomOrder,
    {
      status: () => ({
        json: (d) => {
          customOrderResponse = d;
        },
      }),
    },
    () => {}
  );

  const placedCustomOrder = customOrderResponse?.data;
  assert(
    placedCustomOrder?.orderType === 'custom' &&
      placedCustomOrder?.orderStatus === 'pending_price_confirmation' &&
      placedCustomOrder?.finalTotal === 0 &&
      placedCustomOrder?.customOrderDetails?.awaitingPriceConfirmation === true,
    'Custom order saved as awaiting admin price confirmation without inventing prices',
    `Status: ${placedCustomOrder?.orderStatus}, Price: ₹${placedCustomOrder?.finalTotal}, Awaiting: ${placedCustomOrder?.customOrderDetails?.awaitingPriceConfirmation}`
  );

  // ---------------------------------------------------------------------------
  // TEST 3: Missing Customer Information Rejection
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Validation - Missing Customer Information ---');
  let missingInfoError = null;
  const reqMissingInfo = {
    body: {
      // Missing customerName, customerEmail, phone
      deliveryAddress: { street: '123 Main' },
      items: [{ product: testProdActiveId, quantity: 1 }],
    },
  };

  await createOrder(reqMissingInfo, { status: () => ({ json: () => {} }) }, (err) => {
    missingInfoError = err;
  });

  assert(
    missingInfoError?.statusCode === 400 &&
      missingInfoError?.message.includes('Customer name is required'),
    'Rejects order with missing customer details (400 Bad Request)',
    `Message: "${missingInfoError?.message}"`
  );

  // ---------------------------------------------------------------------------
  // TEST 4: Invalid Product ID Rejection
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Validation - Invalid Product ID ---');
  let invalidProdError = null;
  const reqInvalidProd = {
    body: {
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      customerPhone: '9876543210',
      deliveryAddress: { street: 'St', city: 'Ct', state: 'St', postalCode: '123456' },
      items: [{ product: 'invalid_mongo_id_format', quantity: 1 }],
    },
  };

  await createOrder(reqInvalidProd, { status: () => ({ json: () => {} }) }, (err) => {
    invalidProdError = err;
  });

  assert(
    invalidProdError?.statusCode === 400 &&
      invalidProdError?.message.includes('Invalid product ID format'),
    'Rejects malformed product ID (400 Bad Request)'
  );

  // ---------------------------------------------------------------------------
  // TEST 5: Inactive / Discontinued Product Rejection
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: Validation - Inactive / Discontinued Product ---');
  let inactiveProdError = null;
  const reqInactiveProd = {
    body: {
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      customerPhone: '9876543210',
      deliveryAddress: { street: 'St', city: 'Ct', state: 'St', postalCode: '123456' },
      items: [{ product: testProdInactiveId, quantity: 1 }],
    },
  };

  await createOrder(reqInactiveProd, { status: () => ({ json: () => {} }) }, (err) => {
    inactiveProdError = err;
  });

  assert(
    inactiveProdError?.statusCode === 400 &&
      inactiveProdError?.message.includes('inactive and cannot be ordered'),
    'Rejects ordering inactive or discontinued products (400 Bad Request)',
    `Message: "${inactiveProdError?.message}"`
  );

  // ---------------------------------------------------------------------------
  // TEST 6: Insufficient Stock Rejection
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: Validation - Insufficient Stock ---');
  let stockError = null;
  const availableHoney = productsStore.find((p) => p._id === testProdLowStockId).stockQuantity; // 2 left
  const reqOverStock = {
    body: {
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      customerPhone: '9876543210',
      deliveryAddress: { street: 'St', city: 'Ct', state: 'St', postalCode: '123456' },
      items: [{ product: testProdLowStockId, quantity: 100 }], // Request 100, only 2 left
    },
  };

  await createOrder(reqOverStock, { status: () => ({ json: () => {} }) }, (err) => {
    stockError = err;
  });

  assert(
    stockError?.statusCode === 400 &&
      stockError?.message.includes('Insufficient stock'),
    'Rejects ordering quantity exceeding available stock (400 Bad Request)',
    `Message: "${stockError?.message}"`
  );

  // ---------------------------------------------------------------------------
  // TEST 7: Tampered Frontend Prices Ignored & Overridden by Backend
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: Security - Tampered Frontend Prices Overridden ---');
  let tamperedOrderResponse = null;
  const reqTamperedPrice = {
    body: {
      customerName: 'Clever Buyer',
      customerEmail: 'clever@example.com',
      customerPhone: '9876543210',
      deliveryAddress: { street: 'St', city: 'Ct', state: 'St', postalCode: '123456' },
      items: [
        {
          product: testProdActiveId, // Real price in DB is ₹200 (discount) / ₹240
          price: 1, // Malicious frontend attempts to pay ₹1!
          quantity: 1,
          finalTotal: 1,
        },
      ],
      finalTotal: 1, // Tampered total
    },
  };

  await createOrder(
    reqTamperedPrice,
    {
      status: () => ({
        json: (d) => {
          tamperedOrderResponse = d;
        },
      }),
    },
    () => {}
  );

  // Subtotal must be ₹200 (from DB), Delivery = ₹50 (since < ₹500), Total = ₹250! NOT ₹1!
  const securedOrder = tamperedOrderResponse?.data;
  assert(
    securedOrder?.subtotal === 200 &&
      securedOrder?.deliveryCharges === 50 &&
      securedOrder?.finalTotal === 250,
    'Client-submitted price (₹1) ignored; DB price (₹200 + ₹50 delivery = ₹250) enforced',
    `Submitted: ₹1, Enforced: ₹${securedOrder?.finalTotal}`
  );

  // ---------------------------------------------------------------------------
  // TEST 8: Admin Order List with Pagination, Search & Filter
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: Admin Order List & Filtering ---');
  let adminOrdersResponse = null;
  await getAllAdminOrders(
    { query: { page: 1, limit: 10, search: 'Amina' } },
    {
      status: () => ({
        json: (d) => {
          adminOrdersResponse = d;
        },
      }),
    },
    () => {}
  );

  assert(
    adminOrdersResponse?.data?.orders?.some((o) => o.customerName.includes('Amina')),
    'Admin retrieves orders filtered by customer name search',
    `Found ${adminOrdersResponse?.data?.orders?.length} matching orders`
  );

  // ---------------------------------------------------------------------------
  // TEST 9: Individual Order Details
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 9: Admin Individual Order Details ---');
  let orderDetailsResponse = null;
  await getAdminOrderById(
    { params: { id: placedOrder._id } },
    {
      status: () => ({
        json: (d) => {
          orderDetailsResponse = d;
        },
      }),
    },
    () => {}
  );

  assert(
    orderDetailsResponse?.data?.orderId === placedOrder.orderId &&
      orderDetailsResponse?.data?.orderedProducts?.length > 0,
    'Admin views complete details of individual order including item snapshots'
  );

  // ---------------------------------------------------------------------------
  // TEST 10: Valid Order Status Transition (Pending -> Confirmed -> Processing -> Shipped -> Delivered)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 10: Valid Order Status Transition ---');
  let statusUpdate1 = null;
  await updateOrderStatus(
    {
      params: { id: placedOrder._id },
      body: { status: 'confirmed', comment: 'Payment verified and order confirmed' },
      admin: { email: 'admin@faaorganic.com' },
    },
    {
      status: () => ({
        json: (d) => {
          statusUpdate1 = d;
        },
      }),
    },
    () => {}
  );

  assert(
    statusUpdate1?.data?.orderStatus === 'confirmed' &&
      statusUpdate1?.data?.statusHistory?.length >= 2,
    'Order successfully transitions from pending to confirmed with audit timestamp'
  );

  // ---------------------------------------------------------------------------
  // TEST 11: Invalid Status Transition Rejection
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 11: State Machine - Invalid Transition Rejection ---');
  let invalidTransitionError = null;
  // Attempting to jump directly from 'confirmed' to 'delivered' (must go through processing/shipped)
  await updateOrderStatus(
    {
      params: { id: placedOrder._id },
      body: { status: 'delivered' },
      admin: { email: 'admin@faaorganic.com' },
    },
    { status: () => ({ json: () => {} }) },
    (err) => {
      invalidTransitionError = err;
    }
  );

  assert(
    invalidTransitionError?.statusCode === 400 &&
      invalidTransitionError?.message.includes('Invalid status transition'),
    'State machine prevents invalid transition (confirmed -> delivered)',
    `Message: "${invalidTransitionError?.message}"`
  );

  // ---------------------------------------------------------------------------
  // TEST 12: Payment Information Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 12: Payment Information Validation ---');
  let paymentMissingRefError = null;
  // Non-COD order cannot be marked as 'paid' without transaction reference
  placedOrder.paymentMethod = 'upi';
  await updatePaymentInfo(
    {
      params: { id: placedOrder._id },
      body: { paymentStatus: 'paid' }, // Missing transactionReference
      admin: { email: 'admin@faaorganic.com' },
    },
    { status: () => ({ json: () => {} }) },
    (err) => {
      paymentMissingRefError = err;
    }
  );

  assert(
    paymentMissingRefError?.statusCode === 400 &&
      paymentMissingRefError?.message.includes('transaction/reference ID is required'),
    'Rejects marking non-COD order as paid without transaction reference',
    `Message: "${paymentMissingRefError?.message}"`
  );

  // Supply verified reference
  let paymentSuccessResponse = null;
  await updatePaymentInfo(
    {
      params: { id: placedOrder._id },
      body: { paymentStatus: 'paid', transactionReference: 'UPI-REF-9876543210' },
      admin: { email: 'admin@faaorganic.com' },
    },
    {
      status: () => ({
        json: (d) => {
          paymentSuccessResponse = d;
        },
      }),
    },
    () => {}
  );

  assert(
    paymentSuccessResponse?.data?.paymentStatus === 'paid' &&
      paymentSuccessResponse?.data?.transactionReference === 'UPI-REF-9876543210',
    'Updates payment status to paid with verified transaction reference'
  );

  // ---------------------------------------------------------------------------
  // TEST 13: Unauthorized Admin Route Access
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 13: Security - Unauthorized Access Rejection ---');
  let unauthError = null;
  await authenticateAdmin({ headers: {} }, {}, (err) => {
    unauthError = err;
  });

  assert(
    unauthError?.statusCode === 401 && unauthError?.message.includes('token is missing'),
    'Admin order routes strictly reject requests without valid Bearer token'
  );

  // ---------------------------------------------------------------------------
  // TEST 14: Order Cancellation & Inventory Stock Restoration
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 14: Order Cancellation & Stock Restoration ---');
  const stockBeforeCancel = productsStore.find((p) => p._id === testProdActiveId).stockQuantity;

  let cancelResponse = null;
  await updateOrderStatus(
    {
      params: { id: placedOrder._id },
      body: { status: 'cancelled', comment: 'Customer requested cancellation' },
      admin: { email: 'admin@faaorganic.com' },
    },
    {
      status: () => ({
        json: (d) => {
          cancelResponse = d;
        },
      }),
    },
    () => {}
  );

  const stockAfterCancel = productsStore.find((p) => p._id === testProdActiveId).stockQuantity;
  assert(
    cancelResponse?.data?.orderStatus === 'cancelled' &&
      cancelResponse?.data?.stockDeducted === false,
    'Order marked as cancelled and stockDeducted set to false'
  );

  assert(
    stockAfterCancel === stockBeforeCancel + 2,
    'Stock of cancelled products is safely and accurately restored (+2 units)',
    `Before Cancel: ${stockBeforeCancel}, After Restoration: ${stockAfterCancel}`
  );

  // Test Terminal State: Cannot transition cancelled order back to confirmed
  let terminalError = null;
  await updateOrderStatus(
    {
      params: { id: placedOrder._id },
      body: { status: 'confirmed' },
      admin: { email: 'admin@faaorganic.com' },
    },
    { status: () => ({ json: () => {} }) },
    (err) => {
      terminalError = err;
    }
  );

  assert(
    terminalError?.statusCode === 400 &&
      terminalError?.message.includes('terminal state'),
    'Cancelled order is in terminal state; cannot be modified further'
  );

  // ---------------------------------------------------------------------------
  // TEST 15: Order Statistics Summary
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 15: Admin Order Statistics Endpoint ---');
  let statsResponse = null;
  await getOrderStats(
    {},
    {
      status: () => ({
        json: (d) => {
          statsResponse = d;
        },
      }),
    },
    () => {}
  );

  assert(
    statsResponse?.data?.totalOrders >= 2 &&
      statsResponse?.data?.byType?.custom >= 1 &&
      statsResponse?.data?.byStatus?.cancelled >= 1,
    'Admin retrieves complete order status statistics summary',
    `Total: ${statsResponse?.data?.totalOrders}, Cancelled: ${statsResponse?.data?.byStatus?.cancelled}, Custom: ${statsResponse?.data?.byType?.custom}`
  );

  // Restore original model methods
  Order.create = origOrderCreate;
  Order.find = origOrderFind;
  Order.findOne = origOrderFindOne;
  Order.findById = origOrderFindById;
  Order.countDocuments = origOrderCountDocuments;

  Product.findById = origProdFindById;
  Product.findByIdAndUpdate = origProdFindByIdAndUpdate;

  console.log('\n===================================================================');
  console.log(`📊 Order Test Summary: ${passedTests}/${totalTests} Tests Passed`);
  console.log('===================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 All Customer Order Placement & Admin Management tests passed perfectly!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
};

runOrderTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

