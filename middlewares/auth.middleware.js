// ============================================
// FILE: middlewares/auth.middleware.js
// JWT Authentication Middleware
// ============================================

const authService = require('../services/auth.service');
const ResponseUtil = require('../utils/response.util');

/**
 * Verify JWT access token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ResponseUtil.unauthorized(res, 'Access token required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify token
    const decoded = authService.verifyToken(token, 'access');

    if (decoded.type !== 'access') {
      return ResponseUtil.unauthorized(res, 'Invalid token type');
    }

    // Attach user info to request
    req.user = {
      user_id: decoded.user_id,
      phone: decoded.phone,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ResponseUtil.unauthorized(res, 'Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      return ResponseUtil.unauthorized(res, 'Invalid token');
    }
    return ResponseUtil.error(res, 'Authentication failed', 401);
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = authService.verifyToken(token, 'access');

      req.user = {
        user_id: decoded.user_id,
        phone: decoded.phone,
        role: decoded.role
      };
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = { authenticate, optionalAuth };