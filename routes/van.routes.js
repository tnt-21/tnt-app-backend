// ============================================
// FILE: routes/van.routes.js
// Van routing and scheduling routes
// ============================================

const express = require('express');
const router = express.Router();
const vanController = require('../controllers/van.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// ============================================
// SERVICE REQUEST ROUTES
// ============================================

// Create service request (customer submits without date)
router.post('/service-requests', authenticate, vanController.createServiceRequest);

// Get pending requests (admin view)
router.get('/service-requests/pending', authenticate, vanController.getPendingRequests);

// Customer responds to assigned time slot
router.post('/service-requests/:request_id/respond', authenticate, vanController.respondToTimeSlot);

// ============================================
// ROUTE OPTIMIZATION ROUTES
// ============================================

// Generate weekly routes for all vans
router.post('/generate-weekly-routes', authenticate, vanController.generateWeeklyRoutes);

// Build route for specific van and date
router.post('/build-route', authenticate, vanController.buildRouteForVan);

// ============================================
// VAN MANAGEMENT ROUTES
// ============================================

// Create new van
router.post('/', authenticate, vanController.createVan);

// Get all vans (optionally filtered by date)
router.get('/', authenticate, vanController.getVans);

// Create/update van schedule
router.post('/schedules', authenticate, vanController.createSchedule);

// Get assignments for a schedule
router.get('/schedules/:schedule_id/assignments', authenticate, vanController.getScheduleAssignments);

// Finalize route and notify customers
router.post('/schedules/:schedule_id/finalize', authenticate, vanController.finalizeRoute);

module.exports = router;
