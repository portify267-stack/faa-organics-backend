const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (.env has priority, fallback to .env.example)
const envPath = fs.existsSync(path.resolve(process.cwd(), '.env'))
  ? path.resolve(process.cwd(), '.env')
  : fs.existsSync(path.resolve(process.cwd(), '.env.example'))
  ? path.resolve(process.cwd(), '.env.example')
  : undefined;
dotenv.config(envPath ? { path: envPath } : undefined);

const apiRoutes = require('./routes');
const adminRoutes = require('./routes/admin.routes');
const categoryRoutes = require('./routes/category.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
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

// Configure CORS for both frontend store and React admin panel
const parseOrigins = (val) =>
  val ? val.split(',').map((origin) => origin.trim()).filter(Boolean) : [];

const defaultAllowedOrigins = [
  'http://localhost:3000', // Typical Next.js / Create React App frontend
  'http://localhost:5173', // Typical Vite frontend
  'http://localhost:3001', // React admin panel
  'http://localhost:5174', // Vite React admin panel
];

const clientOrigins = parseOrigins(process.env.CLIENT_URL);
const adminOrigins = parseOrigins(process.env.ADMIN_URL);
const allowedOrigins = Array.from(
  new Set([...defaultAllowedOrigins, ...clientOrigins, ...adminOrigins])
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Dynamically allow any localhost or 127.0.0.1 development port
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocalhost || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

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

// Direct Health Check Route
app.get('/health', getHealthStatus);

// Direct /api Routes
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// API v1 Routes (e.g. /api/v1/health, /api/v1/admin, /api/v1/products)
const apiPrefix = process.env.API_PREFIX || '/api/v1';
app.use(apiPrefix, apiRoutes);

// -----------------------------------------------------------------------------
// Error Handling Middlewares
// -----------------------------------------------------------------------------
// Catch-all 404 Route Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;

