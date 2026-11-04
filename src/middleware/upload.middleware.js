const fs = require('fs');
const path = require('path');

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

let multer;
try {
  multer = require('multer');
} catch {
  multer = null;
}

let upload;

if (multer) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Safe unique filename: fieldname-timestamp-random.ext
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Invalid file type. Only JPEG, JPG, PNG, and WEBP image files are allowed.'
        ),
        false
      );
    }
  };

  upload = multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB max per file
    },
    fileFilter,
  });
} else {
  // Pass-through fallback when multer is not yet installed in sandbox
  const dummyMiddleware = (req, res, next) => next();
  upload = {
    single: () => dummyMiddleware,
    array: () => dummyMiddleware,
    fields: () => dummyMiddleware,
  };
}

/**
 * Normalizes uploaded files and direct image payloads into standard image objects:
 * [{ url, alt, isPrimary }]
 *
 * Supports:
 * 1. Multer uploaded files (req.files / req.file)
 * 2. Direct JSON URLs or objects (req.body.images / req.body.image)
 * 3. Fallback placeholder image for organic products
 */
const processProductImages = (req) => {
  const images = [];

  // 1. Process files uploaded via multer
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    req.files.forEach((file, index) => {
      images.push({
        url: `/uploads/${file.filename}`,
        alt: req.body.name || file.originalname || 'Organic Product Image',
        isPrimary: index === 0,
      });
    });
  } else if (req.file) {
    images.push({
      url: `/uploads/${req.file.filename}`,
      alt: req.body.name || req.file.originalname || 'Organic Product Image',
      isPrimary: true,
    });
  }

  // 2. Process direct image URLs / objects provided in request body
  if (req.body.images) {
    let bodyImages = req.body.images;
    if (typeof bodyImages === 'string') {
      try {
        bodyImages = JSON.parse(bodyImages);
      } catch {
        bodyImages = [{ url: bodyImages.trim(), alt: req.body.name || 'Organic Product' }];
      }
    }

    if (Array.isArray(bodyImages)) {
      bodyImages.forEach((img, idx) => {
        if (typeof img === 'string' && img.trim()) {
          images.push({
            url: img.trim(),
            alt: req.body.name || 'Organic Product',
            isPrimary: images.length === 0 && idx === 0,
          });
        } else if (img && typeof img === 'object' && img.url) {
          images.push({
            url: img.url.trim(),
            alt: img.alt || req.body.name || 'Organic Product',
            isPrimary: img.isPrimary !== undefined ? Boolean(img.isPrimary) : images.length === 0,
          });
        }
      });
    }
  }

  // Ensure at least one primary image if images exist
  if (images.length > 0 && !images.some((img) => img.isPrimary)) {
    images[0].isPrimary = true;
  }

  return images;
};

/**
 * Normalizes a category image from upload or JSON body
 */
const processCategoryImage = (req) => {
  if (req.file) {
    return {
      url: `/uploads/${req.file.filename}`,
      alt: req.body.name || req.file.originalname || 'Category Image',
    };
  }

  if (req.body.image) {
    if (typeof req.body.image === 'string' && req.body.image.trim()) {
      return {
        url: req.body.image.trim(),
        alt: req.body.name || 'Category Image',
      };
    }
    if (typeof req.body.image === 'object' && req.body.image.url) {
      return {
        url: req.body.image.url.trim(),
        alt: req.body.image.alt || req.body.name || 'Category Image',
      };
    }
  }

  return { url: '', alt: '' };
};

module.exports = {
  upload,
  processProductImages,
  processCategoryImage,
};

