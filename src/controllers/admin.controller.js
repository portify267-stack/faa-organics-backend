const { Admin } = require('../models');
const { generateToken } = require('../utils/jwt');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Admin Login Controller
 * @route POST /api/admin/login
 * @route POST /api/v1/admin/login
 * @access Public (Protected by rate limiter)
 */
const loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return next(new ApiError(400, 'Please provide both email and password.'));
    }

    if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return next(new ApiError(400, 'Please provide a valid email address.'));
    }

    const cleanEmail = email.toLowerCase().trim();

    // Query admin including hidden password field
    const admin = await Admin.findOne({ email: cleanEmail }).select('+password');

    // Generic error message to prevent account enumeration / revealing if email exists
    const invalidCredentialsMsg = 'Invalid email or password.';

    if (!admin) {
      return next(new ApiError(401, invalidCredentialsMsg));
    }

    // Compare passwords securely using bcrypt
    const isPasswordMatch = await admin.comparePassword(password);
    if (!isPasswordMatch) {
      return next(new ApiError(401, invalidCredentialsMsg));
    }

    // Check account status
    if (admin.accountStatus !== 'active') {
      return next(
        new ApiError(
          403,
          `Your admin account is ${admin.accountStatus}. Please contact superadmin.`
        )
      );
    }

    // Reset rate limiter on successful login
    if (typeof req.resetLoginRateLimit === 'function') {
      req.resetLoginRateLimit();
    }

    // Generate JWT token
    const token = generateToken({
      id: admin._id,
      email: admin.email,
      role: admin.role,
      accountStatus: admin.accountStatus,
    });

    // Sanitized admin response data (passwords never exposed)
    const adminData = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      accountStatus: admin.accountStatus,
    };

    res.status(200).json(
      new ApiResponse(
        200,
        {
          admin: adminData,
          token,
        },
        'Admin login successful'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Authenticated Admin Profile
 * @route GET /api/admin/me
 * @route GET /api/v1/admin/me
 * @access Protected (Admin only)
 */
const getAdminProfile = async (req, res, next) => {
  try {
    const admin = req.admin;

    const profileData = {
      id: admin._id || admin.id,
      name: admin.name || 'Admin',
      email: admin.email,
      role: admin.role,
      accountStatus: admin.accountStatus,
      createdAt: admin.createdAt,
    };

    res
      .status(200)
      .json(new ApiResponse(200, profileData, 'Admin profile retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Logout
 * @route POST /api/admin/logout
 * @route POST /api/v1/admin/logout
 * @access Protected (Admin only)
 */
const logoutAdmin = async (req, res, next) => {
  try {
    // With stateless JWT tokens, client clears token from storage/headers
    res.status(200).json(
      new ApiResponse(
        200,
        {
          tokenInvalidated: true,
        },
        'Admin logged out successfully. Please clear your token from client storage.'
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  loginAdmin,
  getAdminProfile,
  logoutAdmin,
};

