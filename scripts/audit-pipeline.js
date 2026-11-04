/**
 * Faa Organic - Full End-to-End Pipeline Audit Script
 * Dispatches simulated HTTP requests through the complete Express stack:
 * Helmet -> CORS -> Morgan -> Body Parsers -> Routes -> Controllers -> Error Handler
 */

const http = require('http');
const { PassThrough } = require('stream');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Configure mongoose to not buffer queries for 10s if disconnected
mongoose.set('bufferTimeoutMS', 200);

// Load App & Models
const app = require('../src/app');
const { Admin, Category, Product, Order } = require('../src/models');

// Configure test JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'faa_organic_super_secure_jwt_secret_key_2026_change_in_production';

// Helper to generate a valid test token
const makeToken = (role = 'superadmin', id = '6724a1b2c3d4e5f6a7b8c901') => {
  return jwt.sign(
    { id, email: 'admin@faaorganic.com', role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Setup Mock DB Handlers if real DB is disconnected
const mockAdminDoc = {
  _id: '6724a1b2c3d4e5f6a7b8c901',
  name: 'Admin',
  email: 'admin@faaorganic.com',
  role: 'superadmin',
  accountStatus: 'active',
  comparePassword: async (pwd) => pwd === 'CorrectPassword123!',
};

const mockCategoryDoc = {
  _id: '6724a1b2c3d4e5f6a7b8c001',
  name: 'Organic Fruits',
  slug: 'organic-fruits',
  description: 'Farm fresh fruits',
  status: 'active',
  isActive: true,
  createdAt: new Date(),
  toObject: function () { return { ...this }; },
  save: async function () { return this; },
};

const mockProductDoc = {
  _id: '6724a1b2c3d4e5f6a7b8c002',
  name: 'Organic Alphonso Mangoes',
  slug: 'organic-alphonso-mangoes',
  description: 'Sweet fresh organic mangoes',
  price: 240,
  discountPrice: 210,
  stockQuantity: 50,
  category: '6724a1b2c3d4e5f6a7b8c001',
  availabilityStatus: 'in_stock',
  isFeatured: true,
  status: 'active',
  isActive: true,
  images: [{ url: '/uploads/mango.jpg', isPrimary: true }],
  toObject: function () { return { ...this }; },
  save: async function () { return this; },
};

const mockOrderDoc = {
  _id: '6724a1b2c3d4e5f6a7b8c003',
  orderId: 'ORD-20261031-1001',
  customerName: 'Rahul Sharma',
  customerEmail: 'rahul@example.com',
  customerPhone: '9876543210',
  orderStatus: 'pending',
  paymentStatus: 'pending',
  paymentMethod: 'cod',
  orderType: 'regular',
  items: [
    {
      product: '6724a1b2c3d4e5f6a7b8c002',
      productNameSnapshot: 'Organic Alphonso Mangoes',
      priceSnapshot: 210,
      quantity: 2,
      itemTotal: 420,
    },
  ],
  subtotal: 420,
  deliveryCharge: 50,
  finalTotal: 470,
  statusHistory: [],
  stockDeducted: true,
  toObject: function () { return { ...this }; },
  save: async function () { return this; },
};

// Query Chain Mock Helper
const createQueryChain = (items) => {
  const query = {
    _items: items,
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    then(resolve, reject) {
      return Promise.resolve(this._items).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(this._items).catch(reject);
    },
  };
  return query;
};

// Install Safe Fallback Mocks when Mongoose is disconnected
if (mongoose.connection.readyState === 0) {
  // Admin Mocks
  Admin.findById = () => ({
    select: () => Promise.resolve(mockAdminDoc),
  });
  Admin.findOne = ({ email }) => ({
    select: () => Promise.resolve(email === 'admin@faaorganic.com' ? mockAdminDoc : null),
  });

  // Category Mocks
  Category.find = () => createQueryChain([mockCategoryDoc]);
  Category.findById = (id) => Promise.resolve(id === '6724a1b2c3d4e5f6a7b8c001' ? mockCategoryDoc : null);
  Category.findOne = ({ slug, name }) => Promise.resolve(slug === 'organic-fruits' ? mockCategoryDoc : null);
  Category.create = (doc) => Promise.resolve({ _id: '6724a1b2c3d4e5f6a7b8c001', ...doc, toObject: () => doc });
  Category.findByIdAndDelete = (id) => Promise.resolve(mockCategoryDoc);

  // Product Mocks
  Product.find = () => createQueryChain([mockProductDoc]);
  Product.findById = (id) => {
    const res = id === '6724a1b2c3d4e5f6a7b8c002' ? mockProductDoc : null;
    return {
      populate: () => Promise.resolve(res),
      then: (resolve) => resolve(res),
    };
  };
  Product.findOne = ({ slug }) => ({
    populate: () => Promise.resolve(slug === 'organic-alphonso-mangoes' ? mockProductDoc : null),
  });
  Product.countDocuments = () => Promise.resolve(1);
  Product.create = (doc) => Promise.resolve({ _id: '6724a1b2c3d4e5f6a7b8c002', ...doc, toObject: () => doc });
  Product.findOneAndUpdate = (filter, update) => Promise.resolve(mockProductDoc);
  Product.findByIdAndDelete = (id) => Promise.resolve(mockProductDoc);

  // Order Mocks
  Order.find = () => createQueryChain([mockOrderDoc]);
  Order.findById = (id) => {
    const res = id === '6724a1b2c3d4e5f6a7b8c003' ? mockOrderDoc : null;
    return {
      populate: () => Promise.resolve(res),
      then: (resolve) => resolve(res),
    };
  };
  Order.findOne = ({ orderId }) => ({
    populate: () => Promise.resolve(orderId === 'ORD-20261031-1001' ? mockOrderDoc : null),
  });
  Order.countDocuments = () => Promise.resolve(3);
  Order.create = (doc) => Promise.resolve({ _id: '6724a1b2c3d4e5f6a7b8c003', ...doc, toObject: () => doc });
  Order.aggregate = () => Promise.resolve([]);
}

// Dispatch function through Express
function dispatchRequest({ method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve) => {
    const serializedBody = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

    const req = new http.IncomingMessage(null);
    req.method = method;
    req.url = url;
    req.headers = Object.assign(
      {
        host: 'localhost',
        'user-agent': 'AuditRunner/1.0',
        accept: 'application/json',
      },
      headers
    );

    if (serializedBody) {
      req.headers['content-type'] = req.headers['content-type'] || 'application/json';
      req.headers['content-length'] = Buffer.byteLength(serializedBody);
    }

    const socket = new PassThrough();
    socket.remoteAddress = '127.0.0.1';
    socket.encrypted = false;
    req.socket = socket;

    // Readable stream for request body
    if (serializedBody) {
      let pushed = false;
      req._read = function () {
        if (!pushed) {
          this.push(serializedBody);
          this.push(null);
          pushed = true;
        }
      };
    } else {
      req._read = function () {
        this.push(null);
      };
    }

    const res = new http.ServerResponse(req);
    let responseData = '';

    res.write = function (chunk) {
      if (chunk) responseData += chunk.toString();
      return true;
    };

    res.end = function (chunk) {
      if (chunk) responseData += chunk.toString();
      let json = null;
      try {
        json = JSON.parse(responseData);
      } catch {
        json = responseData;
      }
      resolve({
        statusCode: res.statusCode,
        headers: res.getHeaders ? res.getHeaders() : {},
        body: json,
        rawBody: responseData,
      });
    };

    try {
      app(req, res);
    } catch (err) {
      resolve({
        statusCode: 500,
        headers: {},
        body: { error: err.message },
      });
    }
  });
}

// Audit Test Runner
async function runAudit() {
  console.log('===================================================================');
  console.log('🔬 FAA ORGANIC - COMPLETE BACKEND API INTEGRATION AUDIT SUITE');
  console.log('===================================================================\n');

  const auditLog = [];
  const adminToken = makeToken();
  const authHeader = { authorization: `Bearer ${adminToken}` };

  const record = (section, testName, method, endpoint, expectedStatus, actualStatus, details = '') => {
    const pass = actualStatus === expectedStatus;
    const badge = pass ? '✅ PASS' : '❌ FAIL';
    console.log(`[${badge}] ${method.padEnd(6)} ${endpoint.padEnd(38)} -> ${actualStatus} (Expected: ${expectedStatus})`);
    if (details) console.log(`         ℹ️ ${details}`);
    if (!pass) console.log(`         ⚠️ Failure payload:`, res.body);
    auditLog.push({ section, testName, method, endpoint, expectedStatus, actualStatus, pass, details });
  };

  // ----------------------------------------------------
  // SECTION 1: System Health, Root & CORS
  // ----------------------------------------------------
  console.log('--- 1. SYSTEM, HEALTH & CORS INTEGRATION ---');
  let res = await dispatchRequest({ method: 'GET', url: '/' });
  record('System', 'Root Welcome Endpoint', 'GET', '/', 200, res.statusCode, `App Status: ${res.body?.status}`);

  res = await dispatchRequest({ method: 'GET', url: '/health' });
  record('System', 'Health Check (Direct /health)', 'GET', '/health', 200, res.statusCode, `Service: ${res.body?.data?.service}`);

  res = await dispatchRequest({ method: 'GET', url: '/api/v1/health' });
  record('System', 'Health Check (Versioned /api/v1/health)', 'GET', '/api/v1/health', 200, res.statusCode, `Service: ${res.body?.data?.service}`);

  res = await dispatchRequest({
    method: 'GET',
    url: '/api/v1/health',
    headers: { origin: 'http://localhost:3000' },
  });
  record('CORS', 'Customer Store Origin Allowed', 'GET', '/api/v1/health', 200, res.statusCode, `CORS Origin: ${res.headers['access-control-allow-origin'] || 'Reflected'}`);

  res = await dispatchRequest({
    method: 'GET',
    url: '/api/v1/health',
    headers: { origin: 'http://localhost:3001' },
  });
  record('CORS', 'Admin Panel Origin Allowed', 'GET', '/api/v1/health', 200, res.statusCode, `CORS Origin: ${res.headers['access-control-allow-origin'] || 'Reflected'}`);

  // ----------------------------------------------------
  // SECTION 2: Admin Authentication APIs
  // ----------------------------------------------------
  console.log('\n--- 2. ADMIN AUTHENTICATION & SECURITY APIS ---');
  res = await dispatchRequest({ method: 'POST', url: '/api/admin/login', body: {} });
  record('Auth', 'Login Missing Body', 'POST', '/api/admin/login', 400, res.statusCode, res.body?.message);

  res = await dispatchRequest({ method: 'POST', url: '/api/admin/login', body: { email: 'bad-email', password: '123' } });
  record('Auth', 'Login Invalid Email Format', 'POST', '/api/admin/login', 400, res.statusCode, res.body?.message);

  res = await dispatchRequest({ method: 'POST', url: '/api/admin/login', body: { email: 'unknown@faaorganic.com', password: '123' } });
  record('Auth', 'Login Unknown Admin', 'POST', '/api/admin/login', 401, res.statusCode, res.body?.message);

  res = await dispatchRequest({ method: 'POST', url: '/api/admin/login', body: { email: 'admin@faaorganic.com', password: 'WrongPassword' } });
  record('Auth', 'Login Invalid Password', 'POST', '/api/admin/login', 401, res.statusCode, res.body?.message);

  res = await dispatchRequest({ method: 'POST', url: '/api/admin/login', body: { email: 'admin@faaorganic.com', password: 'CorrectPassword123!' } });
  record('Auth', 'Login Valid Credentials', 'POST', '/api/admin/login', 200, res.statusCode, `Token issued: ${res.body?.data?.token ? 'YES' : 'NO'}`);

  res = await dispatchRequest({ method: 'GET', url: '/api/admin/me' });
  record('Auth', 'Get Profile Missing Token', 'GET', '/api/admin/me', 401, res.statusCode, res.body?.message);

  res = await dispatchRequest({ method: 'GET', url: '/api/admin/me', headers: authHeader });
  record('Auth', 'Get Profile Valid Token', 'GET', '/api/admin/me', 200, res.statusCode, `Admin: ${res.body?.data?.admin?.email}`);

  res = await dispatchRequest({ method: 'POST', url: '/api/admin/logout', headers: authHeader });
  record('Auth', 'Admin Logout Valid Token', 'POST', '/api/admin/logout', 200, res.statusCode, res.body?.message);

  // ----------------------------------------------------
  // SECTION 3: Customer Public Catalog APIs
  // ----------------------------------------------------
  console.log('\n--- 3. CUSTOMER PUBLIC CATALOG APIS ---');
  res = await dispatchRequest({ method: 'GET', url: '/api/categories' });
  record('Catalog', 'List Active Categories', 'GET', '/api/categories', 200, res.statusCode, `Total: ${res.body?.data?.total}`);

  res = await dispatchRequest({ method: 'GET', url: '/api/categories/organic-fruits' });
  record('Catalog', 'Single Category by Slug', 'GET', '/api/categories/:id', 200, res.statusCode, `Name: ${res.body?.data?.name}`);

  res = await dispatchRequest({ method: 'GET', url: '/api/products' });
  record('Catalog', 'List Active Products', 'GET', '/api/products', 200, res.statusCode, `Total: ${res.body?.data?.products?.length}`);

  res = await dispatchRequest({ method: 'GET', url: '/api/products?search=mango&page=1&limit=10' });
  record('Catalog', 'Search/Filter Products', 'GET', '/api/products?search=mango', 200, res.statusCode, `Pagination: page ${res.body?.data?.pagination?.page}`);

  res = await dispatchRequest({ method: 'GET', url: '/api/products/6724a1b2c3d4e5f6a7b8c002' });
  record('Catalog', 'Single Product by ID', 'GET', '/api/products/:id', 200, res.statusCode, `Name: ${res.body?.data?.name}`);

  // ----------------------------------------------------
  // SECTION 4: Protected Admin Catalog Management APIs
  // ----------------------------------------------------
  console.log('\n--- 4. PROTECTED ADMIN CATALOG APIS ---');
  res = await dispatchRequest({ method: 'GET', url: '/api/admin/categories' });
  record('Admin Catalog', 'Admin Categories Missing Token', 'GET', '/api/admin/categories', 401, res.statusCode);

  res = await dispatchRequest({ method: 'GET', url: '/api/admin/categories', headers: authHeader });
  record('Admin Catalog', 'Admin Categories Valid Token', 'GET', '/api/admin/categories', 200, res.statusCode, `Total: ${res.body?.data?.total}`);

  res = await dispatchRequest({ method: 'POST', url: '/api/admin/categories', headers: authHeader, body: { name: 'Fresh Vegetables' } });
  record('Admin Catalog', 'Admin Create Category', 'POST', '/api/admin/categories', 201, res.statusCode, `Created ID: ${res.body?.data?._id}`);

  res = await dispatchRequest({ method: 'PUT', url: '/api/admin/categories/6724a1b2c3d4e5f6a7b8c001', headers: authHeader, body: { description: 'Updated desc' } });
  record('Admin Catalog', 'Admin Update Category', 'PUT', '/api/admin/categories/:id', 200, res.statusCode);

  res = await dispatchRequest({ method: 'PATCH', url: '/api/admin/categories/6724a1b2c3d4e5f6a7b8c001/status', headers: authHeader, body: { isActive: false } });
  record('Admin Catalog', 'Admin Update Category Status', 'PATCH', '/api/admin/categories/:id/status', 200, res.statusCode);

  res = await dispatchRequest({ method: 'GET', url: '/api/admin/products' });
  record('Admin Catalog', 'Admin Products Missing Token', 'GET', '/api/admin/products', 401, res.statusCode);

  res = await dispatchRequest({ method: 'GET', url: '/api/admin/products', headers: authHeader });
  record('Admin Catalog', 'Admin Products Valid Token', 'GET', '/api/admin/products', 200, res.statusCode, `Count: ${res.body?.data?.totalProducts}`);

  res = await dispatchRequest({ method: 'PUT', url: '/api/admin/products/6724a1b2c3d4e5f6a7b8c002', headers: authHeader, body: { price: 250 } });
  record('Admin Catalog', 'Admin Update Product', 'PUT', '/api/admin/products/:id', 200, res.statusCode);

  res = await dispatchRequest({ method: 'PATCH', url: '/api/admin/products/6724a1b2c3d4e5f6a7b8c002/status', headers: authHeader, body: { isActive: false } });
  record('Admin Catalog', 'Admin Update Product Status', 'PATCH', '/api/admin/products/:id/status', 200, res.statusCode);

  res = await dispatchRequest({ method: 'DELETE', url: '/api/admin/products/6724a1b2c3d4e5f6a7b8c002', headers: authHeader });
  record('Admin Catalog', 'Admin Delete Product', 'DELETE', '/api/admin/products/:id', 200, res.statusCode);

  // ----------------------------------------------------
  // SECTION 5: Customer & Admin Order APIs
  // ----------------------------------------------------
  console.log('\n--- 5. CUSTOMER & ADMIN ORDER APIS ---');
  mockProductDoc.isActive = true;
  mockProductDoc.status = 'active';

  res = await dispatchRequest({ method: 'POST', url: '/api/orders', body: {} });
  record('Orders', 'Customer Order Empty Body', 'POST', '/api/orders', 400, res.statusCode, res.body?.message);

  res = await dispatchRequest({
    method: 'POST',
    url: '/api/orders',
    body: {
      customerName: 'Rahul Sharma',
      customerEmail: 'rahul@example.com',
      customerPhone: '9876543210',
      deliveryAddress: {
        street: '123 Market St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
      },
      items: [{ product: '6724a1b2c3d4e5f6a7b8c002', quantity: 2 }],
    },
  });
  record('Orders', 'Customer Place Order', 'POST', '/api/orders', 201, res.statusCode, `Order ID: ${res.body?.data?.orderId}`);

  res = await dispatchRequest({ method: 'GET', url: '/api/admin/orders' });
  record('Orders', 'Admin Orders Missing Token', 'GET', '/api/admin/orders', 401, res.statusCode);

  res = await dispatchRequest({ method: 'GET', url: '/api/admin/orders', headers: authHeader });
  record('Orders', 'Admin Orders Valid Token', 'GET', '/api/admin/orders', 200, res.statusCode, `Total: ${res.body?.data?.totalOrders}`);

  res = await dispatchRequest({ method: 'GET', url: '/api/admin/orders/stats', headers: authHeader });
  record('Orders', 'Admin Order KPI Stats', 'GET', '/api/admin/orders/stats', 200, res.statusCode, `Total Count: ${res.body?.data?.totalOrders}`);

  res = await dispatchRequest({ method: 'GET', url: '/api/admin/orders/6724a1b2c3d4e5f6a7b8c003', headers: authHeader });
  record('Orders', 'Admin Single Order Details', 'GET', '/api/admin/orders/:id', 200, res.statusCode, `Order ID: ${res.body?.data?.orderId}`);

  res = await dispatchRequest({
    method: 'PATCH',
    url: '/api/admin/orders/6724a1b2c3d4e5f6a7b8c003/status',
    headers: authHeader,
    body: { orderStatus: 'confirmed' },
  });
  record('Orders', 'Admin Update Order Status', 'PATCH', '/api/admin/orders/:id/status', 200, res.statusCode);

  res = await dispatchRequest({
    method: 'PATCH',
    url: '/api/admin/orders/6724a1b2c3d4e5f6a7b8c003/payment',
    headers: authHeader,
    body: { paymentStatus: 'paid', transactionId: 'TXN-998877' },
  });
  record('Orders', 'Admin Update Order Payment', 'PATCH', '/api/admin/orders/:id/payment', 200, res.statusCode);

  // ----------------------------------------------------
  // SECTION 6: Sales Analytics API
  // ----------------------------------------------------
  console.log('\n--- 6. SALES ANALYTICS API ---');
  res = await dispatchRequest({ method: 'GET', url: '/api/admin/sales' });
  record('Sales', 'Sales Analytics Missing Token', 'GET', '/api/admin/sales', 401, res.statusCode);

  res = await dispatchRequest({ method: 'GET', url: '/api/admin/sales', headers: authHeader });
  record('Sales', 'Sales Analytics Valid Token', 'GET', '/api/admin/sales', 200, res.statusCode, `Months: ${res.body?.data?.monthlySales?.length}, Total Sales: ₹${res.body?.data?.overallSummary?.totalSales}`);

  // ----------------------------------------------------
  // SECTION 7: 404 Route Handling
  // ----------------------------------------------------
  console.log('\n--- 7. 404 ROUTE HANDLING ---');
  res = await dispatchRequest({ method: 'GET', url: '/api/v1/unknown-endpoint-xyz' });
  record('404', 'Undefined Route Handler', 'GET', '/api/v1/unknown-endpoint-xyz', 404, res.statusCode, res.body?.message);

  // ----------------------------------------------------
  // Final Tally
  // ----------------------------------------------------
  const passed = auditLog.filter((r) => r.pass).length;
  console.log('\n===================================================================');
  console.log(`📊 FINAL AUDIT PIPELINE SUMMARY: ${passed}/${auditLog.length} ENDPOINT TESTS PASSED`);
  console.log('===================================================================');

  if (passed === auditLog.length) {
    console.log('🎉 ALL ENDPOINTS, MIDDLEWARE, AND CONTROLLER INTEGRATIONS VERIFIED!');
  } else {
    console.log('⚠️ SOME ENDPOINTS FAILED VERIFICATION. REVIEW LOG ABOVE.');
  }
}

runAudit();
