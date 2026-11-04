const ApiError = require('../utils/apiError');

/**
 * 404 Route Not Found Middleware
 */
const notFoundHandler = (req, res, next) => {
  const error = new ApiError(
    404,
    `Cannot find ${req.method} ${req.originalUrl} on this server`
  );
  next(error);
};

module.exports = notFoundHandler;

