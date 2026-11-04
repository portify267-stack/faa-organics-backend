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

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

let server;

// Initialize Database connection BEFORE starting HTTP server to accept API traffic
const startServer = async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error(`⚠️ Initial DB connection attempt encountered an issue: ${err.message}`);
  }

  server = app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 Faa Organic Backend Server Started`);
    console.log(`🌐 Environment : ${NODE_ENV}`);
    console.log(`📡 URL         : http://localhost:${PORT}`);
    console.log(`🩺 Healthcheck : http://localhost:${PORT}/api/v1/health`);
    console.log(`===============================================`);
  });
};

startServer();

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

