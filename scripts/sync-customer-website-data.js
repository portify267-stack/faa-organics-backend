/**
 * Synchronization Script: Migrates ALL 7 Customer Website Products & Categories into MongoDB Atlas
 * Path: Backend/Backend/src/scripts/sync-customer-website-data.js
 * Run via: node scripts/sync-customer-website-data.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('../src/config/db');
const { Category, Product } = require('../src/models');

// Official Categories matching Customer Website Tabs
const officialCategories = [
  {
    name: 'Soaps',
    slug: 'soap',
    description: 'Handcrafted cold-processed organic soaps made with fresh goat milk and wild botanicals',
    status: 'active',
    isActive: true,
    image: {
      url: '/assets/images/img11.jpeg',
      alt: 'Handcrafted Organic Soaps',
    },
  },
  {
    name: 'Creams & Balms',
    slug: 'cream',
    description: 'Rich botanical butters, herbal night creams, lip balms, and soothing serums',
    status: 'active',
    isActive: true,
    image: {
      url: '/assets/images/img8.jpeg',
      alt: 'Nourishing Creams & Serums',
    },
  },
  {
    name: 'Herbal Oils',
    slug: 'oil',
    description: 'Authentic wood-pressed oils slow-cooked with fresh medicinal herbs for hair & scalp nutrition',
    status: 'active',
    isActive: true,
    image: {
      url: '/assets/images/img5.jpeg',
      alt: 'Herbal Hair Growth Oils',
    },
  },
  {
    name: 'Herbal Powders',
    slug: 'powder',
    description: 'Traditional sun-dried herbal bath powders, ubtan, and detan face mask packs',
    status: 'active',
    isActive: true,
    image: {
      url: '/assets/images/img6.jpeg',
      alt: 'Detan Herbal Face Mask Powders',
    },
  },
];

// The 7 Official Customer Website Products from frontend/src/data/products.js
const customerWebsiteProducts = [
  {
    id: 'skin-brightening-goat-milk-soap',
    name: 'Premium Skin Brightening Goat Milk Soap',
    price: 230,
    unit: '100 g',
    categorySlug: 'soap',
    categoryName: 'Soaps',
    image: '/assets/images/img11.jpeg',
    subtitle: 'Handcrafted Radiant Glow Formula',
    description:
      'Handcrafted with pure goat milk, manjistha, and licorice to brighten dull skin and even skin tone naturally.',
    keyIngredients:
      'Premium Goat Milk Soap Base\nManjistha\nLicorice\nOats Extract\nHerbal-Infused Oil\nFragrance Oil\nEssential Oil',
    benefits:
      'Helps remove tan\nHelps reduce dullness\nHelps reduce the appearance of dark spots\nHelps reduce the appearance of acne marks\nHelps promote a brighter-looking skin tone and complexion\nBrand-provided claim: visible difference in one wash',
    howToUse:
      'Wet your face with clean water.\nGently apply the soap and create a soft lather.\nLeave it on your face for 1 minute.\nRinse thoroughly with clean water.\nUse up to 3 times a day as part of your skincare routine.',
    suitability:
      'All skin types, including sensitive and acne-prone skin, as stated by the brand.',
    stockQuantity: 50,
  },
  {
    id: 'nalangumaavu-goat-milk-soap',
    name: 'Premium 20+ Herb Infused Nalangumaavu Goat Milk Soap',
    price: 240,
    unit: '100 g',
    categorySlug: 'soap',
    categoryName: 'Soaps',
    image: '/assets/images/img10.jpeg',
    subtitle: 'Ancient 20-Herb Ayurvedic Exfoliation Ritual',
    description:
      'Infused with sandalwood, amla, vetiver, and 20+ botanicals for gentle everyday body exfoliation and fresh glowing complexion.',
    keyIngredients:
      'Premium Goat Milk Soap Base\nPremium-quality herb-infused Nalangumaavu powder containing: Sandalwood, Orange, Almond, Amla, Manjistha, Licorice, Rosemary, Poolankilangu, Vetiver, Avarampoo, 13+ additional traditional herbs\nFragrance Oil\nEssential Oil',
    benefits:
      "Gently exfoliates the skin\nHelps remove dead skin cell buildup\nHelps reduce the appearance of dullness\nCleanses away dirt and impurities\nLeaves skin feeling soft and smooth\nHelps enhance the skin's natural-looking radiance\nSupports a fresh, glowing-looking complexion",
    howToUse:
      'Wet your face with clean water.\nGently apply the soap and create a soft lather.\nLeave it on your face for 1 minute.\nRinse thoroughly with clean water.\nUse up to 3 times a day as part of your skincare routine.',
    suitability:
      'All skin types, including sensitive and acne-prone skin, as stated by the brand.',
    stockQuantity: 45,
  },
  {
    id: 'papaya-glow-soap',
    name: 'Premium Papaya Glow Soap',
    price: 199,
    unit: '100 g',
    categorySlug: 'soap',
    categoryName: 'Soaps',
    image: '/assets/images/img9.jpeg',
    subtitle: 'Enzymatic Radiance & Pore Cleansing',
    description:
      'Papaya papain enzyme and fresh cooling cucumber to exfoliate dead cells, cleanse impurities, and reveal radiant skin.',
    keyIngredients:
      'Premium Soap Base\nPapaya\nCucumber\nEssential Oil\nFragrance Oil',
    benefits:
      'Papaya papain enzyme helps exfoliate dead skin cells and improve the appearance of dull skin.\nHelps promote a fresh, brighter-looking complexion.\nCucumber refreshes the skin and leaves it feeling soft and smooth.\nHelps cleanse dirt and impurities.\nHelps improve the appearance of uneven skin tone.\nLeaves skin feeling fresh, clean, and refreshed.\nSupports a naturally radiant-looking complexion.',
    howToUse:
      'Wet your face with clean water.\nGently apply the soap and create a soft lather.\nLeave it on your face for 1 minute.\nRinse thoroughly with clean water.\nUse up to 3 times a day as part of your skincare routine.',
    suitability:
      'All skin types, including sensitive and acne-prone skin, as stated by the brand.',
    stockQuantity: 40,
  },
  {
    id: 'glow-food-serum',
    name: 'Glow Food Serum',
    price: 549,
    unit: '30 ml',
    categorySlug: 'cream',
    categoryName: 'Creams & Balms',
    image: '/assets/images/img7.jpeg',
    subtitle: 'Glass-Skin Overnight Botanical Elixir',
    description:
      'Deep botanical infusion of Kashmiri saffron, sandalwood, and rose petals to promote a glass-skin glow and reduce dark spots.',
    keyIngredients:
      'Manjistha\nLicorice\nRose Petals\nVetiver\nSaffron\nSandalwood\nAlmonds\nNannari\nOther Selected Herbs',
    benefits:
      'Promotes a glass-skin-like glow\nHelps improve the appearance of dull skin\nSupports a brighter-looking complexion\nHelps improve the appearance of uneven skin tone\nHelps reduce the appearance of dark spots\nHelps improve the appearance of post-acne marks\nBrand-provided claim: helps reduce the appearance of dark circles\nHelps keep skin soft, smooth, and hydrated\nSupports healthy-looking, radiant skin',
    howToUse:
      'Use at night on a freshly cleansed face.\nApply 2–3 drops of Glow Food Serum to your face.\nGently massage in circular motions until evenly spread.\nLeave it on overnight; no need to wash it off.\nUse regularly as part of your nighttime skincare routine.',
    suitability:
      'All skin types, including acne-prone and sensitive skin, as stated by the brand.',
    stockQuantity: 35,
  },
  {
    id: 'acne-pimple-clear-night-cream',
    name: 'Acne & Pimple Clear Night Cream',
    price: 450,
    unit: '50 g',
    categorySlug: 'cream',
    categoryName: 'Creams & Balms',
    image: '/assets/images/img8.jpeg',
    subtitle: 'Overnight Blemish & Pore Defense Formula',
    description:
      'Overnight targeted formula with niacinamide and salicylic acid to calm active pimples, unclog pores, and fade acne blemishes.',
    keyIngredients:
      'Salicylic Acid\nNiacinamide\nSkin-Loving Botanical Ingredients',
    benefits:
      'Helps fight acne and pimples\nHelps unclog pores\nHelps control excess oil\nHelps reduce the appearance of acne marks\nHelps improve the appearance of uneven skin tone\nPromotes clearer-looking skin\nHelps maintain smooth, healthy-looking skin\nSupports acne care and helps reduce the risk of acne-related scarring',
    howToUse:
      "Cleanse your face and pat dry.\nApply a thin, even layer of cream over your face.\nGently spread it across your skin, avoiding the eyes and lips.\nLeave it on overnight while you sleep.\nUse as directed and according to your skin's tolerance.\nTip: Use sunscreen during the day.",
    suitability:
      'Acne-prone skin, Oily skin, Combination skin, Blemish-prone skin.',
    stockQuantity: 30,
  },
  {
    id: 'detan-herbal-face-mask-powder',
    name: 'Detan Herbal Face Mask Powder',
    price: 250,
    unit: '100 g',
    categorySlug: 'powder',
    categoryName: 'Herbal Powders',
    image: '/assets/images/img6.jpeg',
    subtitle: 'Sun-Dried Botanical Detox & Tan Removal',
    description:
      'Traditional sun-dried wild turmeric, poolankilangu, and sandalwood face mask powder to remove sun tan and refresh dull skin.',
    keyIngredients:
      'Poolankilangu (White Turmeric)\nKasturi Turmeric\nSandalwood\nRose Petals\nAlmonds\nGreen Gram\nBengal Gram\nUrad Dal\nManjistha\nLicorice\nChickpeas',
    benefits:
      'Helps reduce the appearance of tan\nHelps refresh dull-looking skin\nGently exfoliates dead skin cell buildup\nHelps improve the appearance of uneven skin tone\nSupports a brighter-looking complexion\nHelps remove dirt and impurities\nLeaves skin feeling soft and smooth\nSupports naturally radiant-looking skin',
    howToUse:
      "Take the required amount of powder in a clean bowl.\nMix with water to form a smooth paste.\nApply evenly to clean face, avoiding the eye area.\nLeave on for 10–15 minutes.\nRinse gently with water and pat dry.\nUse 3–4 times a week, depending on your skin's tolerance.",
    suitability:
      'All skin types, including sensitive and acne-prone skin, as stated by the brand.',
    stockQuantity: 50,
  },
  {
    id: 'herbal-hair-growth-oil',
    name: 'Herbal Hair Growth Oil',
    price: 120,
    unit: '100 ml',
    categorySlug: 'oil',
    categoryName: 'Herbal Oils',
    image: '/assets/images/img5.jpeg',
    subtitle: 'Wood-Pressed 11-Herb Scalp Nutrition Oil',
    description:
      'Traditional wood-pressed coconut oil boiled with hibiscus, kalonji, amla, and curry leaves to deeply nourish hair follicles.',
    keyIngredients:
      'Amla (Indian Gooseberry)\nCurry Leaves\nHibiscus Flowers\nHibiscus Leaves\nRosemary\nHenna\nOnion\nBlack Cumin Seeds (Kalonji)\nFenugreek Seeds\nPure Wood-Pressed Coconut Oil\nAdditional Selected Herbs',
    benefits:
      'Helps nourish the scalp and hair\nHelps reduce hair breakage\nSupports healthy-looking hair\nHelps keep hair soft and smooth\nAdds natural-looking shine\nHelps improve hair manageability\nSupports a healthy scalp-care routine',
    howToUse:
      'Apply the oil to your scalp and hair.\nGently massage your scalp using your fingertips.\nLeave it on for 1–2 hours or overnight if comfortable.\nWash thoroughly with shampoo.\nUse regularly as part of your hair-care routine.',
    suitability: 'All hair and scalp types.',
    stockQuantity: 60,
  },
];

const syncData = async () => {
  console.log('====================================================');
  console.log('🔄 Faa Organics: Website Data -> MongoDB Atlas Sync');
  console.log('====================================================\n');

  try {
    const conn = await connectDB();
    if (!conn) {
      throw new Error('Could not connect to MongoDB Atlas database.');
    }

    console.log('1️⃣  Synchronizing Categories...');
    const categoryMap = new Map();

    for (const cat of officialCategories) {
      // Find category by name or slug
      let existingCat = await Category.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${cat.name}$`, 'i') } },
          { slug: cat.slug },
        ],
      });

      if (!existingCat) {
        existingCat = await Category.create({
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          status: 'active',
          isActive: true,
          image: cat.image,
        });
        console.log(`   ✨ Created category: "${cat.name}" [ID: ${existingCat._id}, Slug: ${existingCat.slug}]`);
      } else {
        // Update category with current image & description while preserving ID
        existingCat.description = cat.description;
        existingCat.status = 'active';
        existingCat.isActive = true;
        if (!existingCat.image || !existingCat.image.url) {
          existingCat.image = cat.image;
        }
        await existingCat.save();
        console.log(`   ✓ Found/Updated category: "${existingCat.name}" [ID: ${existingCat._id}, Slug: ${existingCat.slug}]`);
      }

      categoryMap.set(cat.categorySlug || cat.slug, existingCat);
      categoryMap.set(cat.name, existingCat);
      categoryMap.set(cat.name.toLowerCase(), existingCat);
    }

    // Also support fallback mappings
    const soapsCategory = categoryMap.get('soap') || (await Category.findOne({ name: 'Soaps' }));
    const creamsCategory = categoryMap.get('cream') || (await Category.findOne({ name: 'Creams & Balms' }));
    const oilsCategory = categoryMap.get('oil') || (await Category.findOne({ name: 'Herbal Oils' }));
    const powdersCategory = categoryMap.get('powder') || (await Category.findOne({ name: 'Herbal Powders' }));

    console.log('\n2️⃣  Synchronizing 7 Customer Website Products...');
    let insertedCount = 0;
    let updatedCount = 0;

    for (const item of customerWebsiteProducts) {
      // Resolve target category ObjectId
      let targetCategory =
        categoryMap.get(item.categorySlug) ||
        categoryMap.get(item.categoryName) ||
        (item.categorySlug === 'soap' ? soapsCategory : null) ||
        (item.categorySlug === 'cream' ? creamsCategory : null) ||
        (item.categorySlug === 'oil' ? oilsCategory : null) ||
        (item.categorySlug === 'powder' ? powdersCategory : null);

      if (!targetCategory) {
        targetCategory = soapsCategory;
      }

      // Check if product already exists by exact name (case-insensitive)
      let product = await Product.findOne({
        name: { $regex: new RegExp(`^${item.name.trim()}$`, 'i') },
      });

      const productPayload = {
        name: item.name.trim(),
        description: item.description.trim(),
        price: Number(item.price),
        unit: item.unit,
        category: targetCategory._id,
        stockQuantity: Number(item.stockQuantity || 50),
        availabilityStatus: 'in_stock',
        isFeatured: false,
        isOrganicCertified: true,
        images: [
          {
            url: item.image,
            alt: item.name,
            isPrimary: true,
          },
        ],
        subtitle: item.subtitle,
        keyIngredients: item.keyIngredients,
        benefits: item.benefits,
        howToUse: item.howToUse,
        suitability: item.suitability,
        status: 'active',
        isActive: true,
      };

      if (!product) {
        product = await Product.create(productPayload);
        insertedCount++;
        console.log(`   ➕ Inserted: "${product.name}" [ID: ${product._id}, ₹${product.price}, Cat: ${targetCategory.name}]`);
      } else {
        Object.assign(product, productPayload);
        await product.save();
        updatedCount++;
        console.log(`   🔄 Updated: "${product.name}" [ID: ${product._id}, ₹${product.price}, Cat: ${targetCategory.name}]`);
      }
    }

    const totalInDB = await Product.countDocuments();
    const totalCatsInDB = await Category.countDocuments();

    console.log('\n====================================================');
    console.log('✅ Synchronization Successful!');
    console.log(`   Total Products in MongoDB Atlas  : ${totalInDB}`);
    console.log(`   Total Categories in MongoDB Atlas: ${totalCatsInDB}`);
    console.log(`   Newly Added Products             : ${insertedCount}`);
    console.log(`   Existing Updated Products        : ${updatedCount}`);
    console.log('====================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
};

syncData();

