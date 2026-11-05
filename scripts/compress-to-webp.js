/**
 * Deep WebP Image Compression for MongoDB Atlas
 * Compresses Base64 images to max 480px width, WebP @ 70% quality
 * Output format: data:image/webp;base64,...
 */

const path = require('path');
const dotenv = require('dotenv');
const sharp = require('sharp');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('../src/config/db');
const { Product, Category } = require('../src/models');

async function compressBase64ToWebp(dataUri) {
  if (!dataUri || typeof dataUri !== 'string') return dataUri;
  if (!dataUri.startsWith('data:image/')) return dataUri;

  const commaIdx = dataUri.indexOf(',');
  if (commaIdx === -1) return dataUri;

  const base64Data = dataUri.slice(commaIdx + 1);
  const inputBuffer = Buffer.from(base64Data, 'base64');
  const originalBytes = inputBuffer.length;

  try {
    const outputBuffer = await sharp(inputBuffer)
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    const newBytes = outputBuffer.length;
    const newBase64 = `data:image/webp;base64,${outputBuffer.toString('base64')}`;

    return {
      success: true,
      dataUri: newBase64,
      originalBytes,
      newBytes,
      savings: originalBytes - newBytes,
    };
  } catch (err) {
    console.error('Sharp compression error:', err.message);
    return { success: false, dataUri, originalBytes, newBytes: originalBytes, savings: 0 };
  }
}

async function run() {
  console.log('====================================================');
  console.log('⚡ Faa Organics: Compressing Atlas Images to WebP (480px, 70% Q)');
  console.log('====================================================\n');

  const conn = await connectDB();
  if (!conn) {
    console.error('❌ Failed to connect to MongoDB');
    process.exit(1);
  }

  let totalOriginal = 0;
  let totalNew = 0;
  let compressedCount = 0;

  // 1. Process Products
  const products = await Product.find({});
  console.log(`📦 Found ${products.length} products to check...`);

  for (const product of products) {
    let modified = false;
    if (Array.isArray(product.images)) {
      for (let i = 0; i < product.images.length; i++) {
        const img = product.images[i];
        if (img.url && img.url.startsWith('data:image/')) {
          const res = await compressBase64ToWebp(img.url);
          if (res.success) {
            totalOriginal += res.originalBytes;
            totalNew += res.newBytes;
            compressedCount++;
            product.images[i].url = res.dataUri;
            modified = true;
            console.log(
              `  [Product: ${product.name.slice(0, 30)}] img #${i}: ${(res.originalBytes / 1024).toFixed(1)} KB -> ${(res.newBytes / 1024).toFixed(1)} KB (-${Math.round((res.savings / res.originalBytes) * 100)}%)`
            );
          }
        }
      }
    }
    if (modified) {
      await product.save();
    }
  }

  // 2. Process Categories
  const categories = await Category.find({});
  console.log(`\n🏷️ Found ${categories.length} categories to check...`);

  for (const cat of categories) {
    let catUrl = null;
    let isObject = false;

    if (typeof cat.image === 'string') {
      catUrl = cat.image;
    } else if (cat.image && typeof cat.image.url === 'string') {
      catUrl = cat.image.url;
      isObject = true;
    }

    if (catUrl && catUrl.startsWith('data:image/')) {
      const res = await compressBase64ToWebp(catUrl);
      if (res.success) {
        totalOriginal += res.originalBytes;
        totalNew += res.newBytes;
        compressedCount++;
        if (isObject) {
          cat.image.url = res.dataUri;
        } else {
          cat.image = res.dataUri;
        }
        await cat.save();
        console.log(
          `  [Category: ${cat.name}] ${(res.originalBytes / 1024).toFixed(1)} KB -> ${(res.newBytes / 1024).toFixed(1)} KB (-${Math.round((res.savings / res.originalBytes) * 100)}%)`
        );
      }
    }
  }

  console.log('\n====================================================');
  console.log(`🎉 WebP Compression Complete!`);
  console.log(`   Images Compressed : ${compressedCount}`);
  console.log(`   Original Size     : ${(totalOriginal / (1024 * 1024)).toFixed(2)} MB (${Math.round(totalOriginal / 1024)} KB)`);
  console.log(`   New WebP Size     : ${(totalNew / (1024 * 1024)).toFixed(2)} MB (${Math.round(totalNew / 1024)} KB)`);
  if (totalOriginal > 0) {
    const totalSavingsPercent = Math.round(((totalOriginal - totalNew) / totalOriginal) * 100);
    console.log(`   Total Reduction   : -${totalSavingsPercent}% 🚀`);
  }
  console.log('====================================================\n');

  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error during compression:', err);
  process.exit(1);
});
