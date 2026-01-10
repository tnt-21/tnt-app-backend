// ============================================
// FILE: routes/v1/analytics.routes.js
// Analytics & Reporting Routes
// ============================================

const express = require('express');
const router = express.Router();
const analyticsController = require('../../controllers/analytics.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { rateLimitMiddleware } = require('../../middlewares/rateLimit.middleware');

const { trackEventSchema } = require('../../utils/validation.util');

// ==================== PUBLIC EVENT TRACKING ====================
// Optional auth - can track events for anonymous users
router.post('/track', 
  rateLimitMiddleware(100, 60), 
  authMiddleware.optionalAuth,
  validate(trackEventSchema), 
  analyticsController.trackEvent
);

// ==================== AUTHENTICATED ROUTES ====================
router.use(authMiddleware.authenticate);

// User's own events
router.get('/events/me', rateLimitMiddleware(30, 60), analyticsController.getUserEvents);

// ==================== ADMIN ANALYTICS ROUTES ====================
// These should have additional admin role check in production

// Event analytics
router.get('/events', rateLimitMiddleware(60, 60), analyticsController.getEventStats);
router.get('/events/users/:user_id', rateLimitMiddleware(60, 60), analyticsController.getUserEvents);

// Business metrics
router.get('/metrics', rateLimitMiddleware(60, 60), analyticsController.getMetrics);
router.get('/dashboard', rateLimitMiddleware(60, 60), analyticsController.getDashboard);
router.post('/metrics/calculate', rateLimitMiddleware(20, 60), analyticsController.calculateDailyMetrics);

// Specific reports
router.get('/subscriptions', rateLimitMiddleware(60, 60), analyticsController.getSubscriptionMetrics);
router.get('/revenue', rateLimitMiddleware(60, 60), analyticsController.getRevenueBreakdown);
router.get('/caregivers', rateLimitMiddleware(60, 60), analyticsController.getCaregiverPerformance);

// General reports endpoint
router.get('/reports', rateLimitMiddleware(60, 60), analyticsController.getReports);

module.exports = router;