/**
 * Seed Script: Populate MongoDB Atlas with Initial Faa Organic Categories and Sample Product
 * Run from Backend/Backend directory: node scripts/seed-initial-data.js
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (.env from Backend/Backend)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('../src/config/db');
const { Category, Product } = require('../src/models');

const categoriesToSeed = [
  {
    name: 'Soaps',
    slug: 'soaps',
    description:
      'Handcrafted cold-processed organic soaps made with fresh goat milk and botanical herbs',
    status: 'active',
    isActive: true,
    image: {
      url: '/assets/images/img11.jpeg',
      alt: 'Handcrafted Organic Soaps',
    },
  },
  {
    name: 'Creams & Balms',
    slug: 'creams-balms',
    description:
      'Nourishing organic face and body creams and healing balms',
    status: 'active',
    isActive: true,
    image: {
      url: '/assets/images/img8.jpeg',
      alt: 'Nourishing Creams & Balms',
    },
  },
  {
    name: 'Hair Care',
    slug: 'hair-care',
    description:
      'Pure herbal hair oils, cleansers, and natural hair treatments',
    status: 'active',
    isActive: true,
    image: {
      url: '/assets/images/img5.jpeg',
      alt: 'Herbal Hair Care',
    },
  },
  {
    name: 'Lip Care',
    slug: 'lip-care',
    description:
      'Organic lip balms and scrubs with natural plant butters',
    status: 'active',
    isActive: true,
    image: {
      url: '/assets/images/img7.jpeg',
      alt: 'Natural Lip Care',
    },
  },
];

const seedData = async () => {
  console.log('====================================================');
  console.log('🌿 Faa Organic - Initial Database Seeding');
  console.log('====================================================\n');

  let conn = null;
  try {
    conn = await connectDB();
    if (!conn) {
      throw new Error('Failed to establish database connection.');
    }

    console.log('🌱 Seeding initial categories into MongoDB Atlas...');
    const seededCategories = [];

    for (const catData of categoriesToSeed) {
      const cat = await Category.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${catData.name}$`, 'i') } },
        { $set: catData },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      seededCategories.push(cat);
      console.log(`   ✓ Category: "${cat.name}" [ID: ${cat._id}]`);
    }

    // Locate newly inserted "Soaps" category
    const soapsCategory = seededCategories.find((c) => c.name === 'Soaps') ||
      await Category.findOne({ name: 'Soaps' });

    if (!soapsCategory) {
      throw new Error('Failed to find or create the "Soaps" category.');
    }

    console.log(`\n🧴 Found "Soaps" Category ObjectId: ${soapsCategory._id}`);

    // Sample product payload
    const sampleProductData = {
      name: 'Premium Skin Brightening Goat Milk Soap',
      description:
        'Handcrafted with pure goat milk, manjistha, and licorice to brighten dull skin and even skin tone naturally.',
      price: 230,
      unit: '100 g',
      stockQuantity: 45,
      category: soapsCategory._id,
      status: 'active',
      isActive: true,
      availabilityStatus: 'in_stock',
      images: [
        {
          url: '/assets/images/img11.jpeg',
          alt: 'Goat Milk Soap',
          isPrimary: true,
        },
      ],
      subtitle: 'Handcrafted Radiant Glow Formula',
      keyIngredients: 'Goat Milk, Manjistha, Licorice, Cold-Pressed Coconut Oil',
      benefits: 'Helps remove tan, reduces dullness, nourishes deeply',
      howToUse: 'Apply on wet skin, lather gently, and rinse thoroughly with water',
      suitability: 'All skin types, including sensitive skin',
    };

    console.log('🌱 Seeding sample product into MongoDB Atlas...');
    const seededProduct = await Product.findOneAndUpdate(
      { name: sampleProductData.name },
      { $set: sampleProductData },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).populate('category', 'name slug');

    console.log(`   ✓ Product: "${seededProduct.name}" [ID: ${seededProduct._id}]`);
    console.log(`     Category Ref: "${seededProduct.category?.name}" [${seededProduct.category?._id || seededProduct.category}]`);
    console.log(`     Price       : ₹${seededProduct.price}`);
    console.log(`     Stock       : ${seededProduct.stockQuantity} (${seededProduct.availabilityStatus})`);
    console.log(`     Subtitle    : "${seededProduct.subtitle}"`);
    console.log(`     Ingredients : "${seededProduct.keyIngredients}"`);
    console.log(`     Benefits    : "${seededProduct.benefits}"`);
    console.log(`     How to Use  : "${seededProduct.howToUse}"`);
    console.log(`     Suitability : "${seededProduct.suitability}"`);

    console.log('\n====================================================');
    console.log('✅ Seeding Complete! Summary:');
    console.log(`   • Categories Seeded : ${seededCategories.length}`);
    console.log(`   • Products Seeded   : 1`);
    console.log('====================================================\n');

    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Seeding Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
};

seedData();

