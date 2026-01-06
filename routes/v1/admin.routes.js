
const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

// Protect all admin routes
router.use(authenticate, authorize('admin', 'super_admin'));

// Tier Management
router.patch('/tiers/:tierId', adminController.updateTier);
router.post('/tiers/:tierId/config', adminController.updateTierConfig);

module.exports = router;
