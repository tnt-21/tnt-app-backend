const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit'); // ✅ import helper
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
      // Use user_id if authenticated, otherwise IPv6-safe IP
      return req.user?.user_id || ipKeyGenerator(req);
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