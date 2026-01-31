// ============================================
// FILE: routes/v1/auth.routes.js
// Authentication Routes
// ============================================

const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth.controller');
const adminAuthController = require('../../controllers/admin-auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

// Public routes
router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/refresh-token', authController.refreshToken);

// Admin authentication routes
router.post('/admin/login', adminAuthController.adminLogin);
router.get('/admin/me', authenticate, adminAuthController.getCurrentAdmin);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;