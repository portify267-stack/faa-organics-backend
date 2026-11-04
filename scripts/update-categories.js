/**
 * Category Migration & Ordering Script
 * Path: Backend/Backend/src/scripts/update-categories.js
 * Run via: node scripts/update-categories.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('../src/config/db');
const { Category, Product } = require('../src/models');

const runCategoryUpdate = async () => {
  console.log('====================================================');
  console.log('📦 Faa Organics: Updating Categories & Display Order');
  console.log('====================================================\n');

  try {
    const conn = await connectDB();
    if (!conn) {
      throw new Error('Could not connect to MongoDB database.');
    }

    // 1. Identify Lip Care & Hair Care
    const toRemoveCats = await Category.find({
      name: { $in: [/^lip care$/i, /^hair care$/i] },
    });

    console.log(`1️⃣  Checking for categories to remove: ${toRemoveCats.map(c => c.name).join(', ') || 'None found'}`);

    for (const cat of toRemoveCats) {
      // Find if any products belong to this category
      const affectedProducts = await Product.find({ category: cat._id });
      if (affectedProducts.length > 0) {
        console.log(`   ⚠️  Found ${affectedProducts.length} product(s) in category "${cat.name}". Preserving products!`);
        // Reassign safely
        if (/hair/i.test(cat.name)) {
          let oilsCat = await Category.findOne({ name: /^herbal oils$/i });
          if (!oilsCat) {
            oilsCat = await Category.create({
              name: 'Herbal Oils',
              slug: 'herbal-oils',
              description: 'Authentic wood-pressed oils slow-cooked with fresh medicinal herbs for hair & scalp',
              displayOrder: 4,
            });
          }
          await Product.updateMany({ category: cat._id }, { $set: { category: oilsCat._id } });
          console.log(`   ✓ Reassigned ${affectedProducts.length} product(s) from "${cat.name}" to "${oilsCat.name}".`);
        } else {
          let creamsCat = await Category.findOne({ name: /^creams & balms$/i });
          await Product.updateMany({ category: cat._id }, { $set: { category: creamsCat._id } });
          console.log(`   ✓ Reassigned ${affectedProducts.length} product(s) from "${cat.name}" to "${creamsCat.name}".`);
        }
      } else {
        console.log(`   ✓ 0 products currently reference "${cat.name}". Safe to remove.`);
      }

      // Delete the category from Category collection
      await Category.findByIdAndDelete(cat._id);
      console.log(`   🗑️  Removed category: "${cat.name}" from database.`);
    }

    // 2. Bring "Soap" to Position #1
    console.log('\n2️⃣  Updating "Soap" to position #1...');
    let soapCat = await Category.findOne({
      name: { $in: [/^soaps?$/i] },
    });

    if (soapCat) {
      soapCat.name = 'Soap';
      soapCat.slug = 'soap';
      soapCat.displayOrder = 1;
      soapCat.status = 'active';
      soapCat.isActive = true;
      if (!soapCat.description) {
        soapCat.description = 'Handcrafted cold-processed organic soaps made with fresh goat milk and wild botanicals.';
      }
      await soapCat.save();
      console.log(`   ✓ Updated "Soap" category [ID: ${soapCat._id}, Order: 1]`);
    } else {
      soapCat = await Category.create({
        name: 'Soap',
        slug: 'soap',
        description: 'Handcrafted cold-processed organic soaps made with fresh goat milk and wild botanicals.',
        displayOrder: 1,
        status: 'active',
        isActive: true,
        image: { url: '/assets/images/img11.jpeg', alt: 'Handcrafted Organic Soap' },
      });
      console.log(`   ✨ Created "Soap" category [ID: ${soapCat._id}, Order: 1]`);
    }

    // 3. Add / Ensure "Combo" at Position #2
    console.log('\n3️⃣  Setting up "Combo" category at position #2...');
    let comboCat = await Category.findOne({
      name: /^combo$/i,
    });

    if (!comboCat) {
      comboCat = await Category.create({
        name: 'Combo',
        slug: 'combo',
        description: 'Special value skincare duos, curated ritual bundles, and artisanal gift sets.',
        displayOrder: 2,
        status: 'active',
        isActive: true,
        image: {
          url: '/assets/images/img2.jpeg',
          alt: 'Combo Skincare Sets',
        },
      });
      console.log(`   ✨ Created "Combo" category [ID: ${comboCat._id}, Order: 2]`);
    } else {
      comboCat.displayOrder = 2;
      comboCat.status = 'active';
      comboCat.isActive = true;
      if (!comboCat.image || !comboCat.image.url) {
        comboCat.image = { url: '/assets/images/img2.jpeg', alt: 'Combo Skincare Sets' };
      }
      await comboCat.save();
      console.log(`   ✓ Updated "Combo" category [ID: ${comboCat._id}, Order: 2]`);
    }

    // 4. Update display orders for remaining categories
    console.log('\n4️⃣  Setting display orders for remaining categories...');
    const creamsCat = await Category.findOne({ name: /^creams/i });
    if (creamsCat) {
      creamsCat.displayOrder = 3;
      await creamsCat.save();
      console.log(`   ✓ "Creams & Balms" set to Order: 3`);
    }

    const oilsCat = await Category.findOne({ name: /^herbal oils$/i });
    if (oilsCat) {
      oilsCat.displayOrder = 4;
      await oilsCat.save();
      console.log(`   ✓ "Herbal Oils" set to Order: 4`);
    }

    const powdersCat = await Category.findOne({ name: /^herbal powders$/i });
    if (powdersCat) {
      powdersCat.displayOrder = 5;
      await powdersCat.save();
      console.log(`   ✓ "Herbal Powders" set to Order: 5`);
    }

    // 5. Final verification of categories and their order
    const finalCategories = await Category.find().sort({ displayOrder: 1, name: 1 });
    console.log('\n====================================================');
    console.log('✅ Final Database Categories in Order:');
    console.log('====================================================');
    for (const [index, cat] of finalCategories.entries()) {
      const pCount = await Product.countDocuments({ category: cat._id });
      console.log(`   ${index + 1}. [Order: ${cat.displayOrder}] "${cat.name}" (slug: "${cat.slug}") — ${pCount} product(s)`);
    }

    const totalProducts = await Product.countDocuments();
    console.log(`\n📦 Total Products Preserved in Database: ${totalProducts}`);
    console.log('====================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

runCategoryUpdate();

