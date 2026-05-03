// ============================================
// FILE: routes/van.routes.js
// Van zone-based scheduling routes
// ============================================

const express = require('express');
const router = express.Router();
const vanController = require('../../controllers/van.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

// ============================================
// ZONE CAPACITY (Admin / Public)
// ============================================

// Get upcoming slot availability per zone
router.get('/zone-capacity', authenticate, vanController.getZoneCapacity);

// ============================================
// CANCELLATION WORKFLOW (Admin)
// ============================================

// List all pending cancellation requests
router.get('/pending-cancellations', authenticate, vanController.getPendingCancellations);

// Admin: approve a user's cancellation request
router.post('/bookings/:booking_id/approve-cancellation', authenticate, vanController.approveCancellation);

// Admin: reject a user's cancellation request (booking restored)
router.post('/bookings/:booking_id/reject-cancellation', authenticate, vanController.rejectCancellation);

// ============================================
// VAN MANAGEMENT
// ============================================

router.post('/', authenticate, vanController.createVan);
router.get('/', authenticate, vanController.getVans);
router.post('/schedules', authenticate, vanController.createSchedule);
router.get('/schedules/:schedule_id/assignments', authenticate, vanController.getScheduleAssignments);

module.exports = router;
