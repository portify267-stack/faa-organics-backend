const { sanitizeNoSql } = require('../utils/sanitize');

/**
 * Global input sanitization middleware:
 * Recursively removes MongoDB query injection operators from req.body, req.query, and req.params
 */
const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeNoSql(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeNoSql(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeNoSql(req.params);
  }
  next();
};

module.exports = {
  sanitizeInput,
};

