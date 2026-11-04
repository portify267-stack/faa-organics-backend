/**
 * Seed Script: Populate MongoDB Atlas with 1 Sample Test Order
 * Path: Backend/Backend/scripts/seed-sample-order.js
 * Run via: node scripts/seed-sample-order.js
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from Backend/Backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('../src/config/db');
const { Product, Order } = require('../src/models');

const seedSampleOrder = async () => {
  console.log('====================================================');
  console.log('📦 Faa Organic - Seed Sample Test Order');
  console.log('====================================================\n');

  try {
    const conn = await connectDB();
    if (!conn) {
      throw new Error('Failed to connect to MongoDB Atlas.');
    }

    // 1. Fetch the sample product
    console.log('🔍 Looking for "Premium Skin Brightening Goat Milk Soap"...');
    let product = await Product.findOne({
      name: { $regex: /Premium Skin Brightening Goat Milk Soap/i },
    });

    if (!product) {
      product = await Product.findOne({ status: 'active' });
    }

    if (!product) {
      throw new Error(
        'No product found in database. Please run the product seed script first.'
      );
    }

    console.log(`   ✓ Found Product: "${product.name}" [ID: ${product._id}] (₹${product.price})\n`);

    // 2. Prepare Sample Order Data
    const orderData = {
      orderId: 'FAO-2026-1049',
      customerName: 'Test Customer',
      customerEmail: 'customer@example.com',
      customerPhone: '9876543210',
      deliveryAddress: {
        street: '123 Organic St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postalCode: '600001',
        country: 'India',
      },
      orderedProducts: [
        {
          product: product._id,
          name: product.name,
          price: 230,
          quantity: 2,
          itemTotal: 460,
        },
      ],
      subtotal: 460,
      deliveryCharges: 50,
      finalTotal: 510,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      orderStatus: 'processing',
      orderDate: new Date(),
    };

    // 3. Upsert Order in MongoDB Atlas
    console.log('🌱 Creating sample test order in MongoDB Atlas...');
    const order = await Order.findOneAndUpdate(
      { orderId: orderData.orderId },
      { $set: orderData },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).populate('orderedProducts.product', 'name images unit price');

    console.log('\n====================================================');
    console.log('✅ Sample Order Created Successfully!');
    console.log('====================================================');
    console.log(`   • Mongo _id      : ${order._id}`);
    console.log(`   • Order ID       : ${order.orderId}`);
    console.log(`   • Customer Name  : ${order.customerName}`);
    console.log(`   • Email          : ${order.customerEmail}`);
    console.log(`   • Phone          : ${order.customerPhone}`);
    console.log(`   • Delivery City  : ${order.deliveryAddress?.city}, ${order.deliveryAddress?.state} - ${order.deliveryAddress?.postalCode}`);
    console.log(`   • Items Count    : ${order.orderedProducts?.length} product(s)`);
    console.log(`   • Item Details   : ${order.orderedProducts[0]?.name} (Qty: ${order.orderedProducts[0]?.quantity} × ₹${order.orderedProducts[0]?.price})`);
    console.log(`   • Subtotal       : ₹${order.subtotal}`);
    console.log(`   • Delivery Fee   : ₹${order.deliveryCharges}`);
    console.log(`   • Final Total    : ₹${order.finalTotal}`);
    console.log(`   • Order Status   : ${order.orderStatus}`);
    console.log(`   • Payment Status : ${order.paymentStatus}`);
    console.log('====================================================\n');

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Error Seeding Order: ${error.message}`);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
};

seedSampleOrder();

