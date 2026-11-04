/**
 * Product & Category Management Test Suite for Faa Organic
 * Verifies all Prompt 4 requirements:
 * 1. Category Creation & Duplicate Prevention
 * 2. Category Listing (Customer & Admin)
 * 3. Category Update & Status Toggle
 * 4. Product Creation & Data Validation (Price, Discount, Category reference)
 * 5. Customer Product Listing (Search, Category Filter, Sort, Pagination, Featured)
 * 6. Product Update & Status Toggle
 * 7. Category Deletion Protection (Blocked when products assigned)
 * 8. Product Deletion & Safe Category Deletion
 * 9. Security & Unauthorized Admin Access Rejection
 *
 * Run via: node scripts/test-product-category.js
 * Or: npm run test:catalog
 */

const { generateToken } = require('../src/utils/jwt');
const {
  createCategory,
  getActiveCategories,
  getAllAdminCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  updateCategoryStatus,
} = require('../src/controllers/category.controller');
const {
  createProduct,
  getActiveProducts,
  getProductById,
  getAllAdminProducts,
  updateProduct,
  deleteProduct,
  updateProductStatus,
} = require('../src/controllers/product.controller');
const { authenticateAdmin } = require('../src/middleware/auth.middleware');

console.log('===============================================================');
console.log('🍎 Faa Organic - Product & Category Management Test Suite');
console.log('===============================================================\n');

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

const runCatalogTests = async () => {
  // Generate a mock admin token for authenticated calls
  const adminToken = generateToken({
    id: '6724a1b2c3d4e5f6a7b8c901',
    email: 'admin@faaorganic.com',
    role: 'superadmin',
    accountStatus: 'active',
  });

  // Mock In-memory Storage for Product & Category collections during testing
  let categoriesStore = [];
  let productsStore = [];
  let idCounter = 1;

  const mockObjectId = () => `6724a1b2c3d4e5f6a7b8c${(idCounter++).toString().padStart(3, '0')}`;

  const { Category, Product, Admin } = require('../src/models');
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

  // Backup original models methods
  const origCatCreate = Category.create;
  const origCatFind = Category.find;
  const origCatFindOne = Category.findOne;
  const origCatFindById = Category.findById;
  const origCatFindByIdAndDelete = Category.findByIdAndDelete;

  const origProdCreate = Product.create;
  const origProdFind = Product.find;
  const origProdFindOne = Product.findOne;
  const origProdFindById = Product.findById;
  const origProdFindByIdAndDelete = Product.findByIdAndDelete;
  const origProdCountDocuments = Product.countDocuments;

  // Setup Mock Handlers
  Category.create = async (doc) => {
    const newCat = {
      _id: mockObjectId(),
      slug: doc.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'),
      isActive: doc.isActive !== undefined ? doc.isActive : true,
      status: doc.status || 'active',
      ...doc,
      createdAt: new Date(),
      save: async function () {
        return this;
      },
      toObject: function () {
        return { ...this };
      },
    };
    categoriesStore.push(newCat);
    return newCat;
  };

  Category.findOne = (filter) => {
    let cat = null;
    if (filter.name) {
      const reg = filter.name.$regex || (filter.name instanceof RegExp ? filter.name : new RegExp(`^${filter.name}$`, 'i'));
      cat = categoriesStore.find((c) => reg.test(c.name));
    } else if (filter.slug) {
      cat = categoriesStore.find((c) => c.slug === filter.slug);
    }
    const p = Promise.resolve(cat || null);
    p.populate = () => Promise.resolve(cat || null);
    return p;
  };

  Category.findById = (id) => {
    const cat = categoriesStore.find((c) => String(c._id) === String(id));
    if (cat && !cat.save) {
      cat.save = async function () {
        return this;
      };
    }
    const p = Promise.resolve(cat || null);
    p.populate = () => Promise.resolve(cat || null);
    return p;
  };

  Category.find = (filter = {}) => {
    let results = [...categoriesStore];
    if (filter.status) {
      results = results.filter((c) => c.status === filter.status);
    }
    if (filter.isActive !== undefined) {
      results = results.filter((c) => c.isActive === filter.isActive);
    }
    if (filter.name?.$regex) {
      const reg = new RegExp(filter.name.$regex, 'i');
      results = results.filter((c) => reg.test(c.name));
    }
    return {
      select: () => ({
        sort: () => Promise.resolve(results),
      }),
      sort: () => Promise.resolve(results),
    };
  };

  Category.findByIdAndDelete = (id) => {
    const idx = categoriesStore.findIndex((c) => String(c._id) === String(id));
    if (idx !== -1) {
      const deleted = categoriesStore.splice(idx, 1)[0];
      return Promise.resolve(deleted);
    }
    return Promise.resolve(null);
  };

  Product.create = async (doc) => {
    const newProd = {
      _id: mockObjectId(),
      slug: doc.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'),
      isActive: doc.isActive !== undefined ? doc.isActive : true,
      status: doc.status || 'active',
      isFeatured: Boolean(doc.isFeatured),
      availabilityStatus: doc.availabilityStatus || 'in_stock',
      ...doc,
      createdAt: new Date(),
      save: async function () {
        return this;
      },
    };
    productsStore.push(newProd);
    return newProd;
  };

  Product.findById = (id) => {
    const prod = productsStore.find((p) => String(p._id) === String(id));
    if (prod && !prod.save) {
      prod.save = async function () {
        return this;
      };
    }
    const p = Promise.resolve(prod || null);
    p.populate = () => Promise.resolve(prod || null);
    return p;
  };

  Product.findOne = (filter) => {
    let prod = null;
    if (filter.slug) {
      prod = productsStore.find((p) => p.slug === filter.slug);
    }
    const p = Promise.resolve(prod || null);
    p.populate = () => Promise.resolve(prod || null);
    return p;
  };

  Product.countDocuments = (filter = {}) => {
    let results = [...productsStore];
    if (filter.category) {
      results = results.filter((p) => String(p.category) === String(filter.category));
    }
    if (filter.status) {
      results = results.filter((p) => p.status === filter.status);
    }
    if (filter.isFeatured !== undefined) {
      results = results.filter((p) => p.isFeatured === filter.isFeatured);
    }
    return Promise.resolve(results.length);
  };

  Product.find = (filter = {}) => {
    let results = [...productsStore];
    if (filter.status) {
      results = results.filter((p) => p.status === filter.status);
    }
    if (filter.category) {
      results = results.filter((p) => String(p.category) === String(filter.category));
    }
    if (filter.isFeatured !== undefined) {
      results = results.filter((p) => p.isFeatured === filter.isFeatured);
    }
    if (filter.$or) {
      const reg = filter.$or[0].name;
      results = results.filter((p) => reg.test(p.name) || reg.test(p.description));
    }
    return {
      select: () => ({
        populate: () => ({
          sort: (sortQuery) => ({
            skip: (skip) => ({
              limit: (limit) => {
                let sorted = [...results];
                if (sortQuery?.price === 1) sorted.sort((a, b) => a.price - b.price);
                if (sortQuery?.price === -1) sorted.sort((a, b) => b.price - a.price);
                return Promise.resolve(sorted.slice(skip, skip + limit));
              },
            }),
          }),
        }),
      }),
      populate: () => ({
        sort: () => ({
          skip: (skip) => ({
            limit: (limit) => Promise.resolve(results.slice(skip, skip + limit)),
          }),
        }),
      }),
    };
  };

  Product.findByIdAndDelete = (id) => {
    const idx = productsStore.findIndex((p) => String(p._id) === String(id));
    if (idx !== -1) {
      return Promise.resolve(productsStore.splice(idx, 1)[0]);
    }
    return Promise.resolve(null);
  };

  // ---------------------------------------------------------------------------
  // SECTION 1: Category Management Tests
  // ---------------------------------------------------------------------------
  console.log('--- SECTION 1: Category Management Tests ---');

  // Test 1: Create Category
  let cat1Response = null;
  const reqCat1 = {
    body: {
      name: 'Organic Fresh Fruits',
      description: 'Hand-picked 100% certified organic fruits straight from orchards.',
      image: { url: '/uploads/fruits.webp', alt: 'Organic Fruits' },
    },
  };
  const resCat1 = {
    statusCode: 200,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(d) {
      cat1Response = d;
      return this;
    },
  };

  await createCategory(reqCat1, resCat1, () => {});
  const createdCatId = cat1Response?.data?._id;

  assert(
    resCat1.statusCode === 201 && cat1Response?.data?.slug === 'organic-fresh-fruits',
    'Admin creates category with auto-slug generation',
    `Created Category ID: ${createdCatId}, Slug: ${cat1Response?.data?.slug}`
  );

  // Test 2: Duplicate Category Name Prevention
  let cat2Error = null;
  const reqCat2 = {
    body: {
      name: 'Organic Fresh Fruits', // duplicate
    },
  };
  await createCategory(reqCat2, { status: () => ({ json: () => {} }) }, (err) => {
    cat2Error = err;
  });

  assert(
    cat2Error?.statusCode === 409,
    'Duplicate category name rejected with 409 Conflict',
    `Message: "${cat2Error?.message}"`
  );

  // Test 3: Get Active Categories (Customer)
  let catListResponse = null;
  await getActiveCategories(
    {},
    {
      statusCode: 200,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(d) {
        catListResponse = d;
      },
    },
    () => {}
  );

  assert(
    catListResponse?.data?.categories?.length === 1,
    'Customer API returns list of active categories',
    `Found ${catListResponse?.data?.categories?.length} active categories`
  );

  // Test 4: Update Category
  let catUpdateResponse = null;
  const reqCatUpdate = {
    params: { id: createdCatId },
    body: {
      description: 'Updated orchard-fresh description.',
    },
  };
  await updateCategory(
    reqCatUpdate,
    {
      status: () => ({
        json: (d) => {
          catUpdateResponse = d;
        },
      }),
    },
    () => {}
  );

  assert(
    catUpdateResponse?.data?.description === 'Updated orchard-fresh description.',
    'Admin updates category details successfully'
  );

  // Test 5: Category Status Toggle
  let catStatusResponse = null;
  const reqCatStatus = {
    params: { id: createdCatId },
    body: { status: 'inactive' },
  };
  await updateCategoryStatus(
    reqCatStatus,
    {
      status: () => ({
        json: (d) => {
          catStatusResponse = d;
        },
      }),
    },
    () => {}
  );

  assert(
    catStatusResponse?.data?.status === 'inactive' && catStatusResponse?.data?.isActive === false,
    'Admin deactivates category status successfully'
  );

  // Re-activate category for product testing
  reqCatStatus.body.status = 'active';
  await updateCategoryStatus(
    reqCatStatus,
    { status: () => ({ json: () => {} }) },
    () => {}
  );

  // ---------------------------------------------------------------------------
  // SECTION 2: Product Management Tests
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Product Management Tests ---');

  // Test 6: Create Product
  let prod1Response = null;
  const reqProd1 = {
    body: {
      name: 'Organic Kashmiri Apples',
      description: 'Crisp, sweet, and chemical-free organic apples.',
      price: 240,
      discountPrice: 210,
      category: createdCatId,
      stockQuantity: 50,
      unit: '1 kg',
      isFeatured: true,
      images: [
        { url: '/uploads/kashmiri-apples.webp', alt: 'Kashmiri Apples', isPrimary: true },
      ],
    },
  };
  const resProd1 = {
    statusCode: 200,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(d) {
      prod1Response = d;
      return this;
    },
  };

  await createProduct(reqProd1, resProd1, () => {});
  const createdProdId = prod1Response?.data?._id;

  assert(
    resProd1.statusCode === 201 && prod1Response?.data?.name === 'Organic Kashmiri Apples',
    'Admin creates product referencing category',
    `Product ID: ${createdProdId}, Price: ₹${prod1Response?.data?.price}, Discount: ₹${prod1Response?.data?.discountPrice}`
  );

  // Test 7: Validate Discount Price Must Be Less Than Regular Price
  let prodDiscountError = null;
  const reqProdInvalidDiscount = {
    body: {
      name: 'Bad Discount Product',
      description: 'Invalid pricing item',
      price: 100,
      discountPrice: 150, // Invalid: discount > price
      category: createdCatId,
    },
  };
  await createProduct(reqProdInvalidDiscount, { status: () => ({ json: () => {} }) }, (err) => {
    prodDiscountError = err;
  });

  assert(
    prodDiscountError?.statusCode === 400 &&
      prodDiscountError?.message.includes('Discount price'),
    'Product rejects discount price exceeding regular price (400 Bad Request)',
    `Message: "${prodDiscountError?.message}"`
  );

  // Test 8: Validate Negative Price
  let prodPriceError = null;
  const reqProdInvalidPrice = {
    body: {
      name: 'Negative Price Product',
      description: 'Test',
      price: -50,
      category: createdCatId,
    },
  };
  await createProduct(reqProdInvalidPrice, { status: () => ({ json: () => {} }) }, (err) => {
    prodPriceError = err;
  });

  assert(
    prodPriceError?.statusCode === 400,
    'Product rejects negative price (400 Bad Request)'
  );

  // Test 9: Validate Non-existent Category
  let prodCatError = null;
  const reqProdInvalidCat = {
    body: {
      name: 'Orphan Product',
      description: 'Product with non-existent category',
      price: 100,
      category: '6724a1b2c3d4e5f6a7b8c999', // non-existent
    },
  };
  await createProduct(reqProdInvalidCat, { status: () => ({ json: () => {} }) }, (err) => {
    prodCatError = err;
  });

  assert(
    prodCatError?.statusCode === 400 &&
      prodCatError?.message.includes('category does not exist'),
    'Product rejects non-existent category reference (400 Bad Request)',
    `Message: "${prodCatError?.message}"`
  );

  // ---------------------------------------------------------------------------
  // SECTION 3: Customer Product Listing (Search, Sort, Filter, Pagination)
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Product Search, Filter, Sort & Pagination ---');

  // Add second product for search & sort testing
  await Product.create({
    name: 'Organic Alphonso Mangoes',
    description: 'Sweet seasonal Ratnagiri Alphonso mangoes.',
    price: 600,
    discountPrice: 550,
    category: createdCatId,
    stockQuantity: 20,
    isFeatured: false,
    status: 'active',
    isActive: true,
  });

  // Test 10: Search by product name
  let searchResponse = null;
  await getActiveProducts(
    { query: { search: 'Mangoes' } },
    {
      status: () => ({
        json: (d) => {
          searchResponse = d;
        },
      }),
    },
    () => {}
  );

  assert(
    searchResponse?.data?.products?.some((p) => p.name.includes('Mangoes')),
    'Customer product search by keyword works accurately',
    `Found: "${searchResponse?.data?.products?.[0]?.name}"`
  );

  // Test 11: Sort by Price (Ascending & Descending)
  let sortAscResponse = null;
  await getActiveProducts(
    { query: { sort: 'price_asc' } },
    {
      status: () => ({
        json: (d) => {
          sortAscResponse = d;
        },
      }),
    },
    () => {}
  );

  const firstPrice = sortAscResponse?.data?.products?.[0]?.price;
  const secondPrice = sortAscResponse?.data?.products?.[1]?.price;
  assert(
    firstPrice <= secondPrice,
    'Products sort correctly by price ascending',
    `First: ₹${firstPrice}, Second: ₹${secondPrice}`
  );

  // Test 12: Featured Product Filter
  let featuredResponse = null;
  await getActiveProducts(
    { query: { featured: 'true' } },
    {
      status: () => ({
        json: (d) => {
          featuredResponse = d;
        },
      }),
    },
    () => {}
  );

  assert(
    featuredResponse?.data?.products?.every((p) => p.isFeatured === true),
    'Featured filter returns only featured items'
  );

  // Test 13: Pagination Verification
  let paginationResponse = null;
  await getActiveProducts(
    { query: { page: 1, limit: 1 } },
    {
      status: () => ({
        json: (d) => {
          paginationResponse = d;
        },
      }),
    },
    () => {}
  );

  assert(
    paginationResponse?.data?.pagination?.limit === 1 &&
      paginationResponse?.data?.pagination?.totalPages === 2,
    'Pagination metadata computes correctly (page, limit, totalPages)'
  );

  // ---------------------------------------------------------------------------
  // SECTION 4: Product Editing, Status & Deletion
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Product Editing & Status Updates ---');

  // Test 14: Update Product Details
  let prodUpdateResponse = null;
  await updateProduct(
    {
      params: { id: createdProdId },
      body: {
        stockQuantity: 120,
        price: 250,
      },
    },
    {
      status: () => ({
        json: (d) => {
          prodUpdateResponse = d;
        },
      }),
    },
    () => {}
  );

  assert(
    prodUpdateResponse?.data?.stockQuantity === 120 && prodUpdateResponse?.data?.price === 250,
    'Admin updates product stock quantity and price successfully'
  );

  // Test 15: Activate / Deactivate Product Status
  let prodStatusResponse = null;
  await updateProductStatus(
    {
      params: { id: createdProdId },
      body: { status: 'inactive' },
    },
    {
      status: () => ({
        json: (d) => {
          prodStatusResponse = d;
        },
      }),
    },
    () => {}
  );

  assert(
    prodStatusResponse?.data?.status === 'inactive' &&
      prodStatusResponse?.data?.isActive === false,
    'Admin updates product status to inactive'
  );

  // ---------------------------------------------------------------------------
  // SECTION 5: Category Deletion Protection (Integrity Check)
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Category Deletion Protection ---');

  // Test 16: Category cannot be deleted if products belong to it
  let catDeleteError = null;
  await deleteCategory(
    { params: { id: createdCatId } },
    { status: () => ({ json: () => {} }) },
    (err) => {
      catDeleteError = err;
    }
  );

  assert(
    catDeleteError?.statusCode === 400 &&
      catDeleteError?.message.includes('product(s) are assigned to it'),
    'Prevents category deletion while assigned products exist (400 Bad Request)',
    `Message: "${catDeleteError?.message}"`
  );

  // Delete products first
  await deleteProduct(
    { params: { id: createdProdId } },
    { status: () => ({ json: () => {} }) },
    () => {}
  );
  productsStore = []; // clear remaining products

  // Test 17: Safe deletion of empty category
  let catDeleteSuccess = null;
  await deleteCategory(
    { params: { id: createdCatId } },
    {
      status: () => ({
        json: (d) => {
          catDeleteSuccess = d;
        },
      }),
    },
    () => {}
  );

  assert(
    catDeleteSuccess?.success === true,
    'Category deletes safely once all assigned products are removed'
  );

  // ---------------------------------------------------------------------------
  // SECTION 6: Security & Unauthorized Admin Access
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Security & Unauthorized Access Tests ---');

  // Test 18: Missing Token on Admin Products
  let unauthError = null;
  const reqUnauth = { headers: {} }; // no token
  await authenticateAdmin(reqUnauth, {}, (err) => {
    unauthError = err;
  });

  assert(
    unauthError?.statusCode === 401 && unauthError?.message.includes('token is missing'),
    'Admin product/category route rejects unauthenticated request (401 Unauthorized)',
    `Message: "${unauthError?.message}"`
  );

  // Test 19: Valid Token Allows Access
  let authPass = false;
  const reqAuth = { headers: { authorization: `Bearer ${adminToken}` } };
  await authenticateAdmin(reqAuth, {}, (err) => {
    if (!err && reqAuth.admin) authPass = true;
  });

  assert(
    authPass && reqAuth.admin?.email === 'admin@faaorganic.com',
    'Admin product/category route permits valid admin JWT'
  );

  // Restore model methods
  Category.create = origCatCreate;
  Category.find = origCatFind;
  Category.findOne = origCatFindOne;
  Category.findById = origCatFindById;
  Category.findByIdAndDelete = origCatFindByIdAndDelete;

  Product.create = origProdCreate;
  Product.find = origProdFind;
  Product.findOne = origProdFindOne;
  Product.findById = origProdFindById;
  Product.findByIdAndDelete = origProdFindByIdAndDelete;
  Product.countDocuments = origProdCountDocuments;

  console.log('\n===============================================================');
  console.log(`📊 Catalog Test Summary: ${passedTests}/${totalTests} Tests Passed`);
  console.log('===============================================================');

  if (passedTests === totalTests) {
    console.log('🎉 All Product & Category Management tests passed perfectly!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
};

runCatalogTests().catch((err) => {
  console.error('Fatal error during catalog tests:', err);
  process.exit(1);
});
