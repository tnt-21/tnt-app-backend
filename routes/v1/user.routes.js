const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { rateLimitMiddleware } = require('../../middlewares/rateLimit.middleware');
const { uploadProfilePhoto } = require('../../middlewares/upload.middleware');

// Validation schemas
const {
  updateProfileSchema,
  createAddressSchema,
  updateAddressSchema,
  updatePreferencesSchema,
  updateNotificationPreferencesSchema,
  updatePhoneSchema,
  updateEmailSchema
} = require('../../utils/validation.util');

// All routes require authentication
router.use(authMiddleware.authenticate);

// ==================== USER PROFILE ====================
router.get('/me', userController.getProfile);
router.put('/me', rateLimitMiddleware(10, 60), validate(updateProfileSchema), userController.updateProfile);
router.post('/me/upload-photo', rateLimitMiddleware(5, 60), uploadProfilePhoto, userController.uploadProfilePhoto);
router.delete('/me', rateLimitMiddleware(2, 60), userController.deleteAccount);

// ==================== ADDRESSES ====================
router.get('/me/addresses', userController.getAddresses);
router.get('/me/addresses/:address_id', userController.getAddress);
router.post('/me/addresses', rateLimitMiddleware(20, 60), validate(createAddressSchema), userController.createAddress);
router.put('/me/addresses/:address_id', rateLimitMiddleware(20, 60), validate(updateAddressSchema), userController.updateAddress);
router.put('/me/addresses/:address_id/set-default', rateLimitMiddleware(20, 60), userController.setDefaultAddress);
router.delete('/me/addresses/:address_id', rateLimitMiddleware(20, 60), userController.deleteAddress);

// ==================== PREFERENCES ====================
router.get('/me/preferences', userController.getPreferences);
router.put('/me/preferences', rateLimitMiddleware(10, 60), validate(updatePreferencesSchema), userController.updatePreferences);

// ==================== NOTIFICATION PREFERENCES ====================
router.get('/me/notification-preferences', userController.getNotificationPreferences);
router.put('/me/notification-preferences', rateLimitMiddleware(10, 60), validate(updateNotificationPreferencesSchema), userController.updateNotificationPreferences);

// ==================== SESSIONS ====================
router.get('/me/sessions', userController.getSessions);
router.delete('/me/sessions/:session_id', rateLimitMiddleware(30, 60), userController.revokeSession);
router.delete('/me/sessions', rateLimitMiddleware(10, 60), userController.revokeAllOtherSessions);
router.post('/logout', rateLimitMiddleware(10, 60), userController.logout);

// ==================== PHONE & EMAIL UPDATE ====================
router.post('/me/phone/request-update', rateLimitMiddleware(3, 60), userController.requestPhoneUpdate);
router.put('/me/phone', rateLimitMiddleware(3, 60), validate(updatePhoneSchema), userController.updatePhone);
router.post('/me/email/request-update', rateLimitMiddleware(3, 60), userController.requestEmailUpdate);
router.put('/me/email', rateLimitMiddleware(3, 60), validate(updateEmailSchema), userController.updateEmail);

// ==================== REFERRALS ====================
const referralController = require('../../controllers/referral.controller');
router.get('/me/referral', referralController.getMyReferralInfo);

module.exports = router;