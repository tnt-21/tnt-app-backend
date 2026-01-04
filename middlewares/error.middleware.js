// ============================================
// FILE: middlewares/error.middleware.js
// ============================================

const ResponseUtil = require('../utils/response.util');

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ResponseUtil.unauthorized(res, 'Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return ResponseUtil.unauthorized(res, 'Token expired');
  }

  // Database errors
  if (err.code === '23505') {
    return ResponseUtil.error(res, 'Duplicate entry', 409);
  }
  if (err.code === '23503') {
    return ResponseUtil.error(res, 'Referenced record does not exist', 400);
  }

  // Default
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  return ResponseUtil.error(res, message, statusCode);
};

module.exports = { errorHandler };