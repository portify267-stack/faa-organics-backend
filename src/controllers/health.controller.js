const ApiResponse = require('../utils/apiResponse');
const { getDBStatus } = require('../config/db');

/**
 * Health check controller
 * @route GET /api/v1/health
 * @route GET /health
 */
const getHealthStatus = (req, res) => {
  const dbStatus = typeof getDBStatus === 'function' ? getDBStatus() : 'disconnected';

  const healthData = {
    service: 'Faa Organic Backend API',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      type: 'MongoDB Atlas',
    },
    memoryUsage: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
    },
  };

  res.status(200).json(new ApiResponse(200, healthData, 'Server is running smoothly'));
};

module.exports = {
  getHealthStatus,
};
