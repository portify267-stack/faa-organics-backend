/**
 * Comprehensive Authentication & Security Test Suite
 * Tests all 8 security requirements:
 * 1. Valid admin login
 * 2. Invalid password
 * 3. Unknown email
 * 4. Inactive admin account
 * 5. Missing JWT token
 * 6. Invalid JWT token
 * 7. Expired JWT token
 * 8. Protected route access & RBAC
 *
 * Run via: npm run test:auth
 * Or: node scripts/test-auth.js
 */

// Gracefully provide a lightweight mock for mongoose in test environments where npm install hasn't run yet
try {
  require.resolve('mongoose');
} catch {
  const mockSchema = function (def, opts) {
    this.obj = def;
    this.options = opts;
    this.methods = {};
    this.statics = {};
    this.pre = () => this;
    this.index = () => this;
  };
  const mockMongoose = {
    Schema: Object.assign(mockSchema, {
      Types: { ObjectId: String },
    }),
    model: (name, schema) => {
      const Model = function (doc) {
        Object.assign(this, doc);
      };
      Model.modelName = name;
      Model.schema = schema;
      Model.findOne = () => ({ select: () => Promise.resolve(null) });
      Model.findById = () => ({ select: () => Promise.resolve(null) });
      Model.create = (doc) => Promise.resolve({ _id: 'mock_id_123', ...doc });
      return Model;
    },
  };

  // Register in require.cache under a virtual mongoose path
  const Module = require('module');
  const origRequire = Module.prototype.require;
  Module.prototype.require = function (path) {
    if (path === 'mongoose') return mockMongoose;
    return origRequire.apply(this, arguments);
  };
}

const bcrypt = require('../src/utils/password');
const { generateToken, verifyToken } = require('../src/utils/jwt');
const { authenticateAdmin, authorizeRoles } = require('../src/middleware/auth.middleware');
const { loginAdmin, getAdminProfile } = require('../src/controllers/admin.controller');
const { loginRateLimiter } = require('../src/middleware/rateLimiter.middleware');

console.log('====================================================');
console.log('🛡️  Faa Organic - Authentication & Security Test Suite');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

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

const runSuite = async () => {
  // Setup sample mock admin database records for testing
  const salt = await bcrypt.genSalt(10);
  const activePasswordHash = await bcrypt.hash('CorrectPassword@123', salt);
  const inactivePasswordHash = await bcrypt.hash('SecretPass@456', salt);

  const mockDbAdmins = [
    {
      _id: '6724a1b2c3d4e5f6a7b8c901',
      name: 'Super Admin',
      email: 'admin@faaorganic.com',
      password: activePasswordHash,
      role: 'superadmin',
      accountStatus: 'active',
      comparePassword: async function (candidate) {
        return bcrypt.compare(candidate, this.password);
      },
    },
    {
      _id: '6724a1b2c3d4e5f6a7b8c902',
      name: 'Suspended Manager',
      email: 'suspended@faaorganic.com',
      password: inactivePasswordHash,
      role: 'manager',
      accountStatus: 'inactive',
      comparePassword: async function (candidate) {
        return bcrypt.compare(candidate, this.password);
      },
    },
  ];

  // Mock Admin Model findOne and findById
  const { Admin } = require('../src/models');
  const originalFindOne = Admin.findOne;
  const originalFindById = Admin.findById;
  Admin.findOne = ({ email }) => ({
    select: () => {
      const found = mockDbAdmins.find((a) => a.email === email);
      return Promise.resolve(found || null);
    },
  });
  Admin.findById = (id) => ({
    select: () => {
      const found = mockDbAdmins.find((a) => String(a._id) === String(id));
      return Promise.resolve(found || null);
    },
  });

  // ---------------------------------------------------------------------------
  // Test 1: Valid Admin Login
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Valid Admin Login ---');
  let test1Token = '';
  let test1Response = null;
  const req1 = {
    body: {
      email: 'admin@faaorganic.com',
      password: 'CorrectPassword@123',
    },
  };
  const res1 = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      test1Response = data;
      test1Token = data?.data?.token;
      return this;
    },
  };

  await loginAdmin(req1, res1, (err) => {
    if (err) console.error('Unexpected error in Test 1:', err);
  });

  assert(
    res1.statusCode === 200 && test1Response?.success === true && test1Token,
    'Valid login returns status 200 with JWT token',
    `Token generated: ${test1Token?.substring(0, 25)}...`
  );
  assert(
    test1Response?.data?.admin?.password === undefined,
    'Password is NOT returned in API response payload'
  );
  assert(
    test1Response?.data?.admin?.passwordHash === undefined,
    'Password hash is NOT exposed in response payload'
  );

  // ---------------------------------------------------------------------------
  // Test 2: Invalid Password
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Invalid Password ---');
  let test2Error = null;
  const req2 = {
    body: {
      email: 'admin@faaorganic.com',
      password: 'WrongPassword@999',
    },
  };
  const res2 = { status: (c) => ({ json: (d) => d }) };

  await loginAdmin(req2, res2, (err) => {
    test2Error = err;
  });

  assert(
    test2Error?.statusCode === 401 &&
      test2Error?.message === 'Invalid email or password.',
    'Invalid password returns 401 with generic error message',
    `Message: "${test2Error?.message}"`
  );

  // ---------------------------------------------------------------------------
  // Test 3: Unknown Email
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Unknown Email ---');
  let test3Error = null;
  const req3 = {
    body: {
      email: 'unknown.hacker@evil.com',
      password: 'SomePassword123',
    },
  };
  const res3 = { status: (c) => ({ json: (d) => d }) };

  await loginAdmin(req3, res3, (err) => {
    test3Error = err;
  });

  assert(
    test3Error?.statusCode === 401 &&
      test3Error?.message === 'Invalid email or password.',
    'Unknown email returns identical 401 message (prevents email enumeration)',
    `Message: "${test3Error?.message}"`
  );

  // ---------------------------------------------------------------------------
  // Test 4: Inactive Admin Account
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Inactive Admin Account ---');
  let test4Error = null;
  const req4 = {
    body: {
      email: 'suspended@faaorganic.com',
      password: 'SecretPass@456',
    },
  };
  const res4 = { status: (c) => ({ json: (d) => d }) };

  await loginAdmin(req4, res4, (err) => {
    test4Error = err;
  });

  assert(
    test4Error?.statusCode === 403 &&
      test4Error?.message.includes('inactive'),
    'Inactive account is rejected with 403 Forbidden',
    `Message: "${test4Error?.message}"`
  );

  // ---------------------------------------------------------------------------
  // Test 5: Missing JWT Token
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: Missing JWT Token ---');
  let test5Error = null;
  const req5 = {
    headers: {}, // No Authorization header
  };
  const res5 = { status: (c) => ({ json: (d) => d }) };

  await authenticateAdmin(req5, res5, (err) => {
    test5Error = err;
  });

  assert(
    test5Error?.statusCode === 401 &&
      test5Error?.message.includes('missing'),
    'Missing token is rejected with 401 Unauthorized',
    `Message: "${test5Error?.message}"`
  );

  // ---------------------------------------------------------------------------
  // Test 6: Invalid / Tampered JWT Token
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: Invalid / Tampered JWT Token ---');
  let test6Error = null;
  const req6 = {
    headers: {
      authorization: 'Bearer invalid.tampered.signatureTokenHere12345',
    },
  };
  const res6 = { status: (c) => ({ json: (d) => d }) };

  await authenticateAdmin(req6, res6, (err) => {
    test6Error = err;
  });

  assert(
    test6Error?.statusCode === 401 &&
      test6Error?.message.includes('Invalid authentication token'),
    'Tampered/invalid token is rejected with 401 Unauthorized',
    `Message: "${test6Error?.message}"`
  );

  // ---------------------------------------------------------------------------
  // Test 7: Expired JWT Token
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: Expired JWT Token ---');
  let test7Error = null;
  // Generate token that expired 10 seconds ago
  const expiredToken = generateToken(
    { id: '6724a1b2c3d4e5f6a7b8c901', email: 'admin@faaorganic.com' },
    { expiresIn: '-10s' }
  );

  const req7 = {
    headers: {
      authorization: `Bearer ${expiredToken}`,
    },
  };
  const res7 = { status: (c) => ({ json: (d) => d }) };

  await authenticateAdmin(req7, res7, (err) => {
    test7Error = err;
  });

  assert(
    test7Error?.statusCode === 401 &&
      test7Error?.message.includes('expired'),
    'Expired token is rejected with 401 Unauthorized',
    `Message: "${test7Error?.message}"`
  );

  // ---------------------------------------------------------------------------
  // Test 8: Protected Route Access & Admin Details Attachment
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: Protected Route Access & Profile Retrieval ---');
  let test8AdminAttached = false;
  let test8ProfileResponse = null;

  const req8 = {
    headers: {
      authorization: `Bearer ${test1Token}`,
    },
  };
  const res8 = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      test8ProfileResponse = data;
      return this;
    },
  };

  await authenticateAdmin(req8, res8, async (err) => {
    if (!err && req8.admin) {
      test8AdminAttached = true;
      await getAdminProfile(req8, res8, () => {});
    }
  });

  assert(
    test8AdminAttached && req8.admin?.email === 'admin@faaorganic.com',
    'Middleware authenticates valid JWT and attaches admin to req.admin',
    `Admin email on request: "${req8.admin?.email}"`
  );
  assert(
    res8.statusCode === 200 && test8ProfileResponse?.data?.email === 'admin@faaorganic.com',
    'Protected GET /api/admin/me returns admin profile successfully',
    `Profile data: ${JSON.stringify(test8ProfileResponse?.data)}`
  );

  // ---------------------------------------------------------------------------
  // Test 9: Role-Based Access Control (RBAC)
  // ---------------------------------------------------------------------------
  console.log('\n--- BONUS: Role-Based Authorization Check ---');
  let rbacPassed = false;
  let rbacBlocked = false;

  const superadminOnly = authorizeRoles('superadmin');
  const managerOnly = authorizeRoles('manager');

  // Superadmin user accessing superadmin-only route
  const reqSuper = { admin: { role: 'superadmin' } };
  superadminOnly(reqSuper, {}, (err) => {
    if (!err) rbacPassed = true;
  });

  // Superadmin user accessing manager-only route
  managerOnly(reqSuper, {}, (err) => {
    if (err && err.statusCode === 403) rbacBlocked = true;
  });

  assert(
    rbacPassed && rbacBlocked,
    'RBAC permits authorized roles and returns 403 Forbidden for unauthorized roles'
  );

  // ---------------------------------------------------------------------------
  // Test 10: Login Rate Limiter
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 10: Login Rate Limiting (Brute-Force Protection) ---');
  const { createRateLimiter } = require('../src/middleware/rateLimiter.middleware');
  const testLimiter = createRateLimiter({ windowMs: 60000, maxAttempts: 3 });
  const mockReqRate = {
    headers: {},
    socket: { remoteAddress: '192.168.1.100' },
  };
  let rateStatusCode = 200;
  const mockResRate = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      rateStatusCode = code;
      return this;
    },
    json(data) {
      return data;
    },
  };

  // Run 3 allowed attempts
  testLimiter(mockReqRate, mockResRate, () => {});
  testLimiter(mockReqRate, mockResRate, () => {});
  testLimiter(mockReqRate, mockResRate, () => {});

  // 4th attempt should be blocked with 429
  let blockedOn4th = false;
  testLimiter(mockReqRate, mockResRate, () => {
    blockedOn4th = false;
  });
  if (rateStatusCode === 429) {
    blockedOn4th = true;
  }

  assert(
    blockedOn4th && mockResRate.headers['Retry-After'] !== undefined,
    'Rate limiter blocks 4th attempt with status 429 and Retry-After header',
    `Remaining attempts header: ${mockResRate.headers['X-RateLimit-Remaining']}, Status: ${rateStatusCode}`
  );

  // Restore mock
  Admin.findOne = originalFindOne;

  console.log('\n====================================================');
  console.log(`📊 Test Summary: ${passedTests}/${totalTests} Tests Passed`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('🎉 All authentication & security tests passed perfectly!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
};

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
