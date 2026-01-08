// ============================================
// FILE: routes/v1/caregiver.routes.js
// Caregiver Routes
// ============================================

const express = require('express');
const router = express.Router();
const caregiverController = require('../../controllers/caregiver.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { rateLimitMiddleware } = require('../../middlewares/rateLimit.middleware');
const { uploadProfilePhoto } = require('../../middlewares/upload.middleware');

// Validation schemas
const {
  updateCaregiverProfileSchema,
  addSpecializationSchema,
  rejectAssignmentSchema,
  startServiceSchema,
  completeServiceSchema,
  setAvailabilitySchema,
  updateAvailabilitySchema,
} = require('../../utils/validation.util');

// All routes require authentication
router.use(authMiddleware.authenticate);

// ==================== PROFILE ====================
router.get('/me', caregiverController.getProfile);
router.put('/me', rateLimitMiddleware(10, 60), validate(updateCaregiverProfileSchema), caregiverController.updateProfile);
router.post('/me/upload-photo', rateLimitMiddleware(5, 60), uploadProfilePhoto, caregiverController.uploadProfilePhoto);

// ==================== SPECIALIZATIONS ====================
router.get('/me/specializations', caregiverController.getSpecializations);
router.post('/me/specializations', rateLimitMiddleware(20, 60), validate(addSpecializationSchema), caregiverController.addSpecialization);
router.delete('/me/specializations/:specialization_id', rateLimitMiddleware(20, 60), caregiverController.deleteSpecialization);

// ==================== ASSIGNMENTS ====================
router.get('/me/assignments', caregiverController.getAssignments);
router.get('/me/assignments/:assignment_id', caregiverController.getAssignmentDetails);
router.post('/me/assignments/:assignment_id/accept', rateLimitMiddleware(30, 60), caregiverController.acceptAssignment);
router.post('/me/assignments/:assignment_id/reject', rateLimitMiddleware(30, 60), validate(rejectAssignmentSchema), caregiverController.rejectAssignment);
router.post('/me/assignments/:assignment_id/start', rateLimitMiddleware(30, 60), validate(startServiceSchema), caregiverController.startService);
router.post('/me/assignments/:assignment_id/complete', rateLimitMiddleware(30, 60), validate(completeServiceSchema), caregiverController.completeService);

// ==================== AVAILABILITY ====================
router.get('/me/availability', caregiverController.getAvailability);
router.post('/me/availability', rateLimitMiddleware(30, 60), validate(setAvailabilitySchema), caregiverController.setAvailability);
router.put('/me/availability/:availability_id', rateLimitMiddleware(30, 60), validate(updateAvailabilitySchema), caregiverController.updateAvailability);
router.delete('/me/availability/:availability_id', rateLimitMiddleware(30, 60), caregiverController.deleteAvailability);

// ==================== EARNINGS ====================
router.get('/me/earnings', caregiverController.getEarnings);
router.get('/me/earnings/summary', caregiverController.getEarningsSummary);

// ==================== RATINGS ====================
router.get('/me/ratings', caregiverController.getRatings);
router.get('/me/ratings/summary', caregiverController.getRatingSummary);

// ==================== DASHBOARD ====================
router.get('/me/dashboard', caregiverController.getDashboard);

module.exports = router;