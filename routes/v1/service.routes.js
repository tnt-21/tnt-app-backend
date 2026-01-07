// ============================================
// FILE: routes/v1/service.routes.js
// Service and booking routes
// ============================================

const express = require('express');
const router = express.Router();
const serviceController = require('../../controllers/service.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { rateLimitMiddleware } = require('../../middlewares/rateLimit.middleware');

// Validation schemas
const {
  createBookingSchema,
  cancelBookingSchema,
  rescheduleBookingSchema,
  calculateBookingPriceSchema
} = require('../../utils/validation.util');

// ==================== PUBLIC ROUTES ====================

// Service catalog (public, but with optional auth for personalization)
router.get(
  '/catalog',
  authMiddleware.optionalAuth,
  rateLimitMiddleware(60, 60),
  serviceController.getServices
);

router.get(
  '/catalog/:service_id',
  authMiddleware.optionalAuth,
  rateLimitMiddleware(60, 60),
  serviceController.getServiceById
);

// Service categories
router.get(
  '/categories',
  rateLimitMiddleware(60, 60),
  serviceController.getServiceCategories
);

// ==================== AUTHENTICATED ROUTES ====================

router.use(authMiddleware.authenticate);

// Check eligibility for a service
router.get(
  '/catalog/:service_id/eligibility',
  rateLimitMiddleware(30, 60),
  serviceController.checkServiceEligibility
);

// Get available slots for a service
router.get(
  '/catalog/:service_id/slots',
  rateLimitMiddleware(30, 60),
  serviceController.getAvailableSlots
);

// Calculate booking price
router.post(
  '/bookings/calculate-price',
  rateLimitMiddleware(30, 60),
  validate(calculateBookingPriceSchema),
  serviceController.calculateBookingPrice
);

// ==================== BOOKING MANAGEMENT ====================

// Create booking
router.post(
  '/bookings',
  rateLimitMiddleware(10, 60),
  validate(createBookingSchema),
  serviceController.createBooking
);

// Get all bookings for user
router.get(
  '/bookings',
  rateLimitMiddleware(30, 60),
  serviceController.getBookings
);

// Get upcoming bookings
router.get(
  '/bookings/upcoming',
  rateLimitMiddleware(30, 60),
  serviceController.getUpcomingBookings
);

// Get past bookings
router.get(
  '/bookings/past',
  rateLimitMiddleware(30, 60),
  serviceController.getPastBookings
);

// Get specific booking
router.get(
  '/bookings/:booking_id',
  rateLimitMiddleware(30, 60),
  serviceController.getBookingById
);

// Cancel booking
router.post(
  '/bookings/:booking_id/cancel',
  rateLimitMiddleware(10, 60),
  validate(cancelBookingSchema),
  serviceController.cancelBooking
);

// Reschedule booking
router.post(
  '/bookings/:booking_id/reschedule',
  rateLimitMiddleware(10, 60),
  validate(rescheduleBookingSchema),
  serviceController.rescheduleBooking
);

// Get booking history
router.get(
  '/bookings/:booking_id/history',
  rateLimitMiddleware(30, 60),
  serviceController.getBookingHistory
);

module.exports = router;