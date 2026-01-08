
const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

// Protect all admin routes
router.use(authenticate, authorize('admin', 'super_admin'));

// Tier Management
router.patch('/tiers/:tierId', adminController.updateTier);
router.post('/tiers/:tierId/config', adminController.updateTierConfig);

// Caregiver Management
router.post('/caregivers', adminController.createCaregiver);
router.get('/caregivers', adminController.getAllCaregivers);
router.get('/caregivers/:id', adminController.getCaregiverById);
router.put('/caregivers/:id', adminController.updateCaregiver);
router.delete('/caregivers/:id', adminController.deleteCaregiver);
router.post('/caregivers/:userId/promote', adminController.promoteUserToCaregiver);

// Care Manager Management
router.post('/care-managers', adminController.createCareManager);
router.get('/care-managers', adminController.getAllCareManagers);
router.get('/care-managers/:id', adminController.getCareManagerById);
router.put('/care-managers/:id', adminController.updateCareManager);
router.delete('/care-managers/:id', adminController.deleteCareManager);
router.post('/care-managers/:userId/promote', adminController.promoteUserToCareManager);

module.exports = router;
