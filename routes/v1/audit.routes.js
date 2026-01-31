// ============================================
// FILE: routes/v1/audit.routes.js
// Audit Log Routes
// ============================================

const express = require('express');
const router = express.Router();
const auditController = require('../../controllers/audit.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { rateLimitMiddleware } = require('../../middlewares/rateLimit.middleware');

// All routes require authentication and admin role
router.use(authMiddleware.authenticate, authMiddleware.authorize('admin', 'super_admin'));

// Get audit logs with filtering
router.get('/logs', rateLimitMiddleware(60, 60), auditController.getAuditLogs);

// Get audit statistics
router.get('/stats', rateLimitMiddleware(60, 60), auditController.getAuditStats);

module.exports = router;
