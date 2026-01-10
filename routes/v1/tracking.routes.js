// ============================================
// FILE: routes/v1/tracking.routes.js
// GPS Tracking API Routes
// ============================================

const express = require('express');
const router = express.Router();
const trackingController = require('../../controllers/tracking.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { rateLimitMiddleware } = require('../../middlewares/rateLimit.middleware');

// Import validation schemas
const {
  startTrackingSessionSchema,
  updateLocationSchema,
  calculateETASchema
} = require('../../utils/validation.util');

// All routes require authentication
router.use(authMiddleware.authenticate);

// ==================== TRACKING SESSIONS ====================

/**
 * POST /api/v1/tracking/sessions
 * Start a new tracking session (Caregiver only)
 */
router.post(
  '/sessions',
  rateLimitMiddleware(20, 60),
  validate(startTrackingSessionSchema),
  trackingController.startSession
);

/**
 * PUT /api/v1/tracking/sessions/:session_id/location
 * Update location during active tracking session
 * High rate limit for real-time tracking (every 30 seconds)
 */
router.put(
  '/sessions/:session_id/location',
  rateLimitMiddleware(200, 60), // Allow ~2 updates per second for real-time tracking
  validate(updateLocationSchema),
  trackingController.updateLocation
);

/**
 * PUT /api/v1/tracking/sessions/:session_id/end
 * End tracking session
 */
router.put(
  '/sessions/:session_id/end',
  rateLimitMiddleware(20, 60),
  trackingController.endSession
);

/**
 * GET /api/v1/tracking/bookings/:booking_id/active-session
 * Get active tracking session for a booking (Customer view)
 */
router.get(
  '/bookings/:booking_id/active-session',
  rateLimitMiddleware(60, 60),
  trackingController.getActiveSession
);

/**
 * GET /api/v1/tracking/sessions/:session_id
 * Get tracking session details
 */
router.get(
  '/sessions/:session_id',
  rateLimitMiddleware(60, 60),
  trackingController.getSessionDetails
);

/**
 * GET /api/v1/tracking/sessions/:session_id/locations
 * Get location history for a tracking session
 */
router.get(
  '/sessions/:session_id/locations',
  rateLimitMiddleware(30, 60),
  trackingController.getLocationHistory
);

/**
 * GET /api/v1/tracking/my-sessions
 * Get user's tracking sessions (for their pets)
 */
router.get(
  '/my-sessions',
  rateLimitMiddleware(30, 60),
  trackingController.getUserSessions
);

/**
 * POST /api/v1/tracking/sessions/:session_id/calculate-eta
 * Calculate ETA to destination based on current location
 */
router.post(
  '/sessions/:session_id/calculate-eta',
  rateLimitMiddleware(60, 60),
  validate(calculateETASchema),
  trackingController.calculateETA
);

module.exports = router;