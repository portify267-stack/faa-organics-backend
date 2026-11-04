const { verifyToken } = require('../utils/jwt');
const { Admin } = require('../models');
const ApiError = require('../utils/apiError');

/**
 * Authentication Middleware: Validates JWT token and checks admin status
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1].trim();
    }

    if (!token) {
      return next(
        new ApiError(401, 'Authentication token is missing. Please provide a Bearer token.')
      );
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new ApiError(401, 'Token has expired. Please log in again.'));
      }
      return next(new ApiError(401, 'Invalid authentication token.'));
    }

    // Verify admin still exists in the database
    let admin = null;
    try {
      admin = await Admin.findById(decoded.id).select('-password');
    } catch {
      admin = null;
    }

    if (!admin) {
      return next(
        new ApiError(401, 'The admin account associated with this token no longer exists.')
      );
    }

    if (admin.accountStatus !== 'active') {
      return next(
        new ApiError(
          403,
          `Admin account is ${admin.accountStatus}. Please contact superadmin.`
        )
      );
    }

    req.admin = admin;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts access to specific admin roles (e.g. 'superadmin', 'admin', 'manager')
 * @param {...string} roles
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return next(new ApiError(401, 'Authentication required before checking roles.'));
    }

    if (!roles.includes(req.admin.role)) {
      return next(
        new ApiError(
          403,
          `Access denied. Role "${req.admin.role}" is not authorized to access this resource.`
        )
      );
    }

    next();
  };
};

module.exports = {
  authenticateAdmin,
  authorizeRoles,
};

