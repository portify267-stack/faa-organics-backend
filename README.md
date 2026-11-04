# Faa Organic - Backend API

Clean, scalable, and modular Node.js & Express RESTful API backend for the **Faa Organic** e-commerce platform.

---

## 📁 Project Architecture & MVC Structure

```text
Backend/
├── scripts/
│   ├── seed-admin.js             # Initial superadmin secure setup script
│   ├── test-auth.js              # 13-point authentication & security test suite
│   ├── test-product-category.js  # 19-point Product & Category test suite
│   ├── test-orders.js            # 19-point Order Placement & Management test suite
│   └── verify-models.js          # Model & database schema verification suite
├── src/
│   ├── config/
│   │   └── db.js                 # MongoDB Atlas connection handler & auto-sanitization
│   ├── controllers/
│   │   ├── admin.controller.js   # Admin login, profile, and logout handlers
│   │   ├── category.controller.js# Category management (Customer & Admin)
│   │   ├── health.controller.js  # System health & database status check
│   │   ├── order.controller.js   # Customer order placement & Admin order management
│   │   └── product.controller.js # Product management (Customer & Admin)
│   ├── middleware/
│   │   ├── auth.middleware.js    # JWT verification & Role-Based Access Control (RBAC)
│   │   ├── error.middleware.js   # Centralized error handler & status formatting
│   │   ├── notFound.middleware.js# 404 Route Not Found interceptor
│   │   ├── rateLimiter.middleware.js # Brute-force protection for login endpoints
│   │   └── upload.middleware.js  # Multer image upload & file validation middleware
│   ├── models/
│   │   ├── admin.model.js        # Admin credentials (hashed passwords) & role control
│   │   ├── category.model.js     # Organic categories with slugs & status
│   │   ├── order.model.js        # Orders, historical snapshots & sales reporting
│   │   ├── product.model.js      # Products, stock levels, organic tags & pricing
│   │   ├── index.js              # Central models export hub
│   │   └── README.md             # In-depth models schema specification
│   ├── routes/
│   │   ├── admin.routes.js       # Admin parent router (/api/admin)
│   │   ├── adminCategory.routes.js# Admin Category management routes
│   │   ├── adminOrder.routes.js  # Admin Order management routes
│   │   ├── adminProduct.routes.js# Admin Product management routes
│   │   ├── category.routes.js    # Customer Category routes (/api/categories)
│   │   ├── health.routes.js      # Health check router definition
│   │   ├── index.js              # Central API router aggregator (/api/v1)
│   │   ├── order.routes.js       # Customer Order placement routes (/api/orders)
│   │   └── product.routes.js     # Customer Product routes (/api/products)
│   ├── utils/
│   │   ├── apiError.js           # Standardized ApiError helper class
│   │   ├── apiResponse.js        # Standardized API response formatter
│   │   ├── jwt.js                # JWT token signing & verification utility
│   │   └── password.js           # Bcrypt password hashing & comparison helper
│   ├── app.js                    # Express application & middleware setup
│   └── server.js                 # Server entry point & graceful shutdown
├── public/
│   └── uploads/                  # Uploaded product and category image assets
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore file for secrets and dependencies
├── package.json                  # Project metadata, scripts, and dependencies
└── README.md                     # Documentation & setup guide
```

---

## 🛠️ Tech Stack & Key Dependencies

- **Node.js** (v18+)
- **Express.js** (v4.x) - Fast, unopinionated web framework
- **Mongoose** (v8.x) - Object Data Modeling (ODM) for MongoDB Atlas
- **jsonwebtoken** (v9.x) - Stateless JWT authentication
- **bcryptjs** (v2.x) - Secure password hashing with salt rounds
- **CORS** - Configured for customer store (`http://localhost:3000` / `5173`) and React admin panel (`http://localhost:3001` / `5174`)
- **Helmet** - Security HTTP headers
- **Morgan** - HTTP request logging
- **Dotenv** - Environment configuration management
- **Nodemon** (Dev) - Auto-reloading development server

---

## 📡 API Endpoints Reference

### 1. Customer Order Placement API
| Method | URL | Protection | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/orders` | Public | Place a new customer order (regular products or custom order) |

### 2. Admin Order Management APIs (Protected - Admin JWT Required)
| Method | URL | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/orders` | View all customer orders with pagination, search, and filtering |
| `GET` | `/api/admin/orders/stats` | Order counts summary by status, type, and payment |
| `GET` | `/api/admin/orders/:id` | View complete details of an individual order |
| `PATCH` | `/api/admin/orders/:id/status` | Update order status (with state machine validation & cancellation stock restoration) |
| `PATCH` | `/api/admin/orders/:id/payment` | Update payment details (requires verified transaction reference for non-COD) |

---

### 3. Product & Category Management APIs

#### Customer APIs (Public)
| Method | URL | Description |
| :--- | :--- | :--- |
| `GET` | `/api/products` | Customer product catalog (pagination, search, filter, sort) |
| `GET` | `/api/products/:id` | Single product by ID or slug |
| `GET` | `/api/categories` | Active customer categories |
| `GET` | `/api/categories/:id` | Single category by ID or slug |

#### Admin Catalog APIs (Admin JWT Required)
| Method | URL | Description |
| :--- | :--- | :--- |
| `POST` | `/api/admin/products` | Create a new product |
| `GET` | `/api/admin/products` | Get all products (active/inactive/out-of-stock) |
| `PUT` | `/api/admin/products/:id` | Update product details |
| `DELETE` | `/api/admin/products/:id` | Delete a product |
| `PATCH` | `/api/admin/products/:id/status` | Activate/deactivate product |
| `POST` | `/api/admin/categories` | Create a new category |
| `GET` | `/api/admin/categories` | Get all categories with assigned product counts |
| `PUT` | `/api/admin/categories/:id` | Update category details |
| `DELETE` | `/api/admin/categories/:id` | Delete category (blocked if products assigned) |
| `PATCH` | `/api/admin/categories/:id/status` | Activate/deactivate category |

---

### 4. Admin Authentication APIs
| Method | URL | Protection | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/admin/login` | Public (Rate Limited) | Authenticate admin credentials and return JWT |
| `GET` | `/api/admin/me` | Protected (`Bearer <token>`) | Get profile details of authenticated admin |
| `POST` | `/api/admin/logout` | Protected (`Bearer <token>`) | Log out admin and invalidate client session |

---

## 🧪 Testing Suites & Verification

Run the full automated test suite verifying all 51 test cases across the system:

```bash
# 1. Customer Order Placement & Admin Management Test Suite (19 tests)
npm run test:orders

# 2. Product & Category Management Test Suite (19 tests)
npm run test:catalog

# 3. Admin Authentication & Security Test Suite (13 tests)
npm run test:auth

# 4. Mongoose Model & Database Architecture Verification
npm run verify
```

---

## 📬 Postman Testing Guide

### 1. Place a Customer Order
1. **Method:** `POST`
2. **URL:** `http://localhost:5000/api/orders`
3. **Body (JSON):**
   ```json
   {
     "customerName": "Amina Khan",
     "customerEmail": "amina.khan@example.com",
     "customerPhone": "+91 9876543210",
     "deliveryAddress": {
       "street": "Flat 4B, Green Residency",
       "city": "Mumbai",
       "state": "Maharashtra",
       "postalCode": "400001"
     },
     "items": [
       {
         "product": "<paste_product_id_here>",
         "quantity": 2
       }
     ],
     "paymentMethod": "cod"
   }
   ```
4. Click **Send** $\rightarrow$ Status `201 Created`. Copy `data._id` and `data.orderId`.

### 2. View All Orders in Admin Dashboard
1. **Method:** `GET`
2. **URL:** `http://localhost:5000/api/admin/orders?page=1&limit=10&status=pending`
3. **Authorization:** Select `Bearer Token`, paste your Admin JWT.
4. Click **Send** $\rightarrow$ Status `200 OK` with paginated order records.

### 3. Update Order Status
1. **Method:** `PATCH`
2. **URL:** `http://localhost:5000/api/admin/orders/<paste_order_id_here>/status`
3. **Authorization:** Select `Bearer Token`, paste your Admin JWT.
4. **Body (JSON):**
   ```json
   {
     "status": "confirmed",
     "comment": "Customer confirmed order via phone"
   }
   ```
5. Click **Send** $\rightarrow$ Status `200 OK`. Order status transitions to `confirmed` and updates `statusHistory`.

### 4. Update Payment Information
1. **Method:** `PATCH`
2. **URL:** `http://localhost:5000/api/admin/orders/<paste_order_id_here>/payment`
3. **Authorization:** Select `Bearer Token`, paste your Admin JWT.
4. **Body (JSON):**
   ```json
   {
     "paymentStatus": "paid",
     "transactionReference": "UPI-REF-20261031-98765"
   }
   ```
5. Click **Send** $\rightarrow$ Status `200 OK`.
