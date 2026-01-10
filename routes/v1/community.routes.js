// ============================================
// FILE: routes/v1/community.routes.js
// Community Events Routes
// ============================================

const express = require("express");
const router = express.Router();
const communityController = require("../../controllers/community.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { validate } = require("../../middlewares/validation.middleware");
const {
  rateLimitMiddleware,
} = require("../../middlewares/rateLimit.middleware");

// Validation schemas
const {
  registerForEventSchema,
  cancelEventRegistrationSchema,
  submitEventFeedbackSchema,
  joinWaitlistSchema,
} = require("../../utils/validation.util");

// Public routes (optional auth for personalized data)
router.get("/events", authMiddleware.optionalAuth, communityController.getEvents);
router.get("/events/:event_id", authMiddleware.optionalAuth, communityController.getEvent);

// Protected routes (require authentication)
router.use(authMiddleware.authenticate);

// Event registrations
router.post(
  "/events/:event_id/register",
  rateLimitMiddleware(10, 60),
  validate(registerForEventSchema),
  communityController.registerForEvent
);

router.post(
  "/events/:event_id/waitlist",
  rateLimitMiddleware(10, 60),
  validate(joinWaitlistSchema),
  communityController.joinWaitlist
);

router.post(
  "/registrations/:registration_id/cancel",
  rateLimitMiddleware(20, 60),
  validate(cancelEventRegistrationSchema),
  communityController.cancelEventRegistration
);

router.post(
  "/registrations/:registration_id/feedback",
  rateLimitMiddleware(20, 60),
  validate(submitEventFeedbackSchema),
  communityController.submitEventFeedback
);

// User's registrations
router.get("/my-registrations", communityController.getMyRegistrations);

module.exports = router;