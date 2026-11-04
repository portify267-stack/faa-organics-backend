# Faa Organic Database Models

This directory contains the Mongoose schemas and models for the Faa Organic e-commerce platform.

---

## 1. Admin Model (`admin.model.js`)
Manages administrative users with role-based access control and encrypted credentials.
- **Fields**:
  - `name`: String (2–100 chars, required, trimmed)
  - `email`: String (required, unique, validated format, lowercase)
  - `password`: String (min 6 chars, hashed via bcryptjs pre-save hook, `select: false`)
  - `role`: Enum `['superadmin', 'admin', 'manager']` (default: `'admin'`)
  - `accountStatus`: Enum `['active', 'inactive', 'suspended']` (default: `'active'`)
  - `timestamps`: `createdAt`, `updatedAt`
- **Methods**:
  - `comparePassword(candidatePassword)`: Compares candidate password against the bcrypt hash.

---

## 2. Category Model (`category.model.js`)
Manages organic product categories and hierarchy.
- **Fields**:
  - `name`: String (2–100 chars, unique, required, trimmed)
  - `slug`: String (unique, URL-safe, auto-generated from `name`)
  - `description`: String (max 1000 chars, trimmed)
  - `image`: `{ url: String, alt: String }`
  - `status`: Enum `['active', 'inactive']` (default: `'active'`)
  - `isActive`: Boolean (synchronized with `status`)
  - `timestamps`: `createdAt`, `updatedAt`

---

## 3. Product Model (`product.model.js`)
Manages the inventory of certified organic products.
- **Fields**:
  - `name`: String (2–200 chars, required, trimmed)
  - `slug`: String (unique, URL-friendly)
  - `description`: String (max 5000 chars, required)
  - `images`: Array of `{ url, alt, isPrimary }` (at least 1 image required)
  - `price`: Number (min 0, required)
  - `discountPrice`: Number (optional, validated: `discountPrice < price`)
  - `category`: `ObjectId` referencing `Category` (required, indexed)
  - `stockQuantity`: Number (min 0, default 0, required)
  - `availabilityStatus`: Enum `['in_stock', 'out_of_stock', 'pre_order', 'discontinued']` (auto-syncs with `stockQuantity`)
  - `isFeatured`: Boolean (default: `false`, indexed)
  - `unit`: String (e.g. `'500g'`, `'1 kg'`, `'250ml'`)
  - `isOrganicCertified`: Boolean (default: `true`)
  - `timestamps`: `createdAt`, `updatedAt`

---

## 4. Order Model (`order.model.js`)
The single source of truth for customer orders, financial auditing, and sales reporting.
- **Fields**:
  - `orderId`: String (unique, e.g. `FAO-YYYYMMDD-XXXXX`, uppercase, indexed)
  - **Customer Details**: `customerName`, `customerEmail`, `customerPhone`
  - **Delivery Address**: Subdocument with `street`, `city`, `state`, `postalCode`, `country`, `landmark`
  - **Ordered Products**: Array of item snapshots:
    - `product`: `ObjectId` referencing `Product`
    - `name`: Product name at the time of ordering (historical accuracy)
    - `price`: Product price at the time of ordering (preserved against future price changes)
    - `quantity`: Number (min 1)
    - `itemTotal`: `price * quantity`
  - **Financials**: `subtotal`, `deliveryCharges`, `discount`, `finalTotal`
  - **Payment**:
    - `paymentMethod`: Enum `['cod', 'card', 'upi', 'netbanking', 'wallet', 'other']`
    - `paymentStatus`: Enum `['pending', 'paid', 'failed', 'refunded']`
    - `transactionReference`: String (optional transaction ID)
  - **Status & Dates**:
    - `orderStatus`: Enum `['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']`
    - `orderDate`: Date (default: `Date.now`, indexed)
  - **Custom Orders**:
    - `orderType`: Enum `['regular', 'custom']`
    - `customOrderDetails`: `{ isCustomOrder, specialInstructions, customPackaging, customRequirements }`
  - `timestamps`: `createdAt`, `updatedAt`

---

## 5. Sales Reporting Support (Admin Panel)
Calculates actual real-time analytics from order documents without requiring fake data or redundant collections:
- `Order.getMonthlySalesStats(monthsCount = 6)`:
  - Uses MongoDB Aggregation Pipeline
  - **Excludes cancelled and returned orders** (`orderStatus: { $nin: ['cancelled', 'returned'] }`)
  - **Excludes unpaid orders** from revenue (`paymentStatus: 'paid'`)
  - Groups by Year and Month over the last 6 months
  - Returns `totalRevenue`, `totalOrders`, `averageOrderValue`, and formatted month labels
- `Order.getSalesSummary()`:
  - Aggregates completed sales revenue, pending revenue, and cancellation statistics.
- **Compound Index**: `{ paymentStatus: 1, orderStatus: 1, orderDate: -1 }` ensures high performance even with large volumes.
