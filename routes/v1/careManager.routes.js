// ============================================
// FILE: routes/v1/careManager.routes.js
// Care Manager Routes
// ============================================

const express = require('express');
const router = express.Router();
const careManagerController = require('../../controllers/careManager.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { rateLimitMiddleware } = require('../../middlewares/rateLimit.middleware');
const { uploadProfilePhoto } = require('../../middlewares/upload.middleware');

// Validation schemas
const {
  updateCareManagerProfileSchema,
  completeOnboardingSchema,
  updateCheckInFrequencySchema,
  logInteractionSchema,
  updateInteractionSchema,
  scheduleCheckInSchema,
} = require('../../utils/validation.util');

// All routes require authentication
router.use(authMiddleware.authenticate);

// ==================== PROFILE ====================
router.get('/me', careManagerController.getProfile);
router.put('/me', rateLimitMiddleware(10, 60), validate(updateCareManagerProfileSchema), careManagerController.updateProfile);
router.post('/me/upload-photo', rateLimitMiddleware(5, 60), uploadProfilePhoto, careManagerController.uploadProfilePhoto);

// ==================== ASSIGNMENTS ====================
router.get('/me/assignments', careManagerController.getAssignments);
router.get('/me/assignments/:assignment_id', careManagerController.getAssignmentDetails);
router.post('/me/assignments/:assignment_id/complete-onboarding', rateLimitMiddleware(20, 60), validate(completeOnboardingSchema), careManagerController.completeOnboarding);
router.put('/me/assignments/:assignment_id/check-in-frequency', rateLimitMiddleware(20, 60), validate(updateCheckInFrequencySchema), careManagerController.updateCheckInFrequency);
router.post('/me/assignments/:assignment_id/schedule-check-in', rateLimitMiddleware(30, 60), validate(scheduleCheckInSchema), careManagerController.scheduleCheckIn);

// ==================== INTERACTIONS ====================
router.get('/me/assignments/:assignment_id/interactions', careManagerController.getInteractions);
router.post('/me/assignments/:assignment_id/interactions', rateLimitMiddleware(30, 60), validate(logInteractionSchema), careManagerController.logInteraction);
router.put('/me/interactions/:interaction_id', rateLimitMiddleware(30, 60), validate(updateInteractionSchema), careManagerController.updateInteraction);
router.delete('/me/interactions/:interaction_id', rateLimitMiddleware(30, 60), careManagerController.deleteInteraction);

// ==================== DASHBOARD ====================
router.get('/me/dashboard', careManagerController.getDashboard);
router.get('/me/pets/:pet_id', careManagerController.getPetDetails);
router.get('/me/check-ins/upcoming', careManagerController.getUpcomingCheckIns);

module.exports = router;