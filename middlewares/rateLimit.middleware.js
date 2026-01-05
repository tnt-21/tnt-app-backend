const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/response.util');

const rateLimitMiddleware = (maxRequests = 100, windowMinutes = 15) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Please try again after ${windowMinutes} minutes.`
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use user_id if authenticated, otherwise IP
      return req.user?.user_id || req.ip;
    },
    handler: (req, res) => {
      return errorResponse(
        res,
        `Too many requests. Please try again after ${windowMinutes} minutes.`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }
  });
};

module.exports = { rateLimitMiddleware };