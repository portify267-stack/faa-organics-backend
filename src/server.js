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

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Database connection (ready for MongoDB Atlas)
connectDB();

// Start HTTP Server
const server = app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Faa Organic Backend Server Started`);
  console.log(`🌐 Environment : ${NODE_ENV}`);
  console.log(`📡 URL         : http://localhost:${PORT}`);
  console.log(`🩺 Healthcheck : http://localhost:${PORT}/api/v1/health`);
  console.log(`===============================================`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server gracefully.');
  server.close(() => {
    console.log('HTTP server closed.');
  });
});

