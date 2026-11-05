const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (.env in local dev; in cloud/Render, variables are injected directly into process.env)
const localEnvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else {
  dotenv.config();
}

const apiRoutes = require('./routes');
const adminRoutes = require('./routes/admin.routes');
const categoryRoutes = require('./routes/category.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { getHealthStatus } = require('./controllers/health.controller');
const { sanitizeInput } = require('./middleware/sanitize.middleware');
const { apiRateLimiter } = require('./middleware/rateLimiter.middleware');
const notFoundHandler = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Disable x-powered-by to prevent server technology fingerprinting
app.disable('x-powered-by');

// -----------------------------------------------------------------------------
// Security & Utility Middlewares
// -----------------------------------------------------------------------------
// HTTP response compression (Gzip/Brotli) to cut JSON/Base64 transfer size by 50-70%
app.use(compression());

app.use(
  helmet({
    contentSecurityPolicy: false, // Allows cross-origin assets (fonts, images) while preserving security headers
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// Global API rate limiter protecting all endpoints from brute-force & denial of service
app.use(apiRateLimiter);

// Configure CORS for frontend store, React admin panel, and Vercel deployments
const parseOrigins = (val) =>
  val ? val.split(',').map((origin) => origin.trim()).filter(Boolean) : [];

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  'http://localhost:5174',
  'https://faa-organics-frontend-xne7.vercel.app',
  'https://faa-organics-frontend.vercel.app',
];

const clientOrigins = parseOrigins(process.env.CLIENT_URL);
const adminOrigins = parseOrigins(process.env.ADMIN_URL);
const allowedOrigins = Array.from(
  new Set([...defaultAllowedOrigins, ...clientOrigins, ...adminOrigins])
);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Dynamically allow any localhost or 127.0.0.1 development port
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    // Dynamically allow any Vercel deployment preview or production domain
    const isVercel = /\.vercel\.app$/i.test(origin) || origin.includes('vercel.app');
    // Dynamically allow any Render domain
    const isRender = /\.onrender\.com$/i.test(origin);

    if (isLocalhost || isVercel || isRender || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Permissive fallback so any custom deployment origin is allowed without breaking
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'Expires',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Explicitly handle OPTIONS preflight across all endpoints
app.options('*', cors(corsOptions));

// Request Logging
const isDev = (process.env.NODE_ENV || 'development') === 'development';
app.use(morgan(isDev ? 'dev' : 'combined'));

// Body Parsers with safe size limits
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Input sanitization against NoSQL injection attacks
app.use(sanitizeInput);

// Serve static uploaded product and category assets
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
app.use('/assets/images', express.static(path.join(process.cwd(), 'public', 'uploads')));

// -----------------------------------------------------------------------------
// Database Connection Guard Middleware (Fast-fail when DB disconnected)
// -----------------------------------------------------------------------------
const dbConnectionGuard = async (req, res, next) => {
  // If already connected, continue immediately
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  // If in the process of connecting, wait up to 1500ms
  if (mongoose.connection.readyState === 2) {
    let waited = 0;
    while (mongoose.connection.readyState === 2 && waited < 1500) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      waited += 150;
    }
    if (mongoose.connection.readyState === 1) {
      return next();
    }
  }

  // If disconnected, attempt to connect if credentials exist in environment
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('<username>')) {
    try {
      await connectDB();
      if (mongoose.connection.readyState === 1) {
        return next();
      }
    } catch (err) {
      console.warn('[Database Guard] Auto-reconnect failed:', err.message);
    }
  }

  return res.status(503).json({
    success: false,
    statusCode: 503,
    message: 'Database service is currently unavailable. Please ensure MONGODB_URI is configured in Render Environment Variables.',
    database: {
      status: 'disconnected',
    },
  });
};

// -----------------------------------------------------------------------------
// API Endpoints
// -----------------------------------------------------------------------------
// Root welcome endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Faa Organic Backend API',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/v1/health',
  });
});

// Ultra-fast lightweight health/ping endpoints for UptimeRobot / ping services (prevents Render cold starts)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: Math.floor(process.uptime()), timestamp: Date.now() });
});
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Direct /api Routes (Protected with DB guard)
app.use('/api/admin', dbConnectionGuard, adminRoutes);
app.use('/api/categories', dbConnectionGuard, categoryRoutes);
app.use('/api/products', dbConnectionGuard, productRoutes);
app.use('/api/orders', dbConnectionGuard, orderRoutes);

// API v1 Routes (e.g. /api/v1/health, /api/v1/admin, /api/v1/products)
const apiPrefix = process.env.API_PREFIX || '/api/v1';
// Apply DB guard to data routes under API v1, leaving health check route accessible
app.use(`${apiPrefix}/admin`, dbConnectionGuard);
app.use(`${apiPrefix}/categories`, dbConnectionGuard);
app.use(`${apiPrefix}/products`, dbConnectionGuard);
app.use(`${apiPrefix}/orders`, dbConnectionGuard);
app.use(apiPrefix, apiRoutes);

// -----------------------------------------------------------------------------
// Error Handling Middlewares
// -----------------------------------------------------------------------------
// Catch-all 404 Route Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;

