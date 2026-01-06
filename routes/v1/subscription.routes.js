const express = require('express');
const router = express.Router();
const subscriptionController = require('../../controllers/subscription.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { rateLimitMiddleware } = require('../../middlewares/rateLimit.middleware');

// Validation schemas
const {
  createSubscriptionSchema,
  upgradeSubscriptionSchema,
  downgradeSubscriptionSchema,
  pauseSubscriptionSchema,
  cancelSubscriptionSchema,
  toggleAutoRenewalSchema,
  validatePromoCodeSchema,
  calculatePriceSchema
} = require('../../utils/validation.util');

// ==================== PUBLIC ROUTES ====================

// Browse subscription tiers (no auth required)
router.get('/tiers', subscriptionController.getTiers);
router.get('/tiers/:tier_id', subscriptionController.getTierDetails);

// ==================== AUTHENTICATED ROUTES ====================

router.use(authMiddleware.authenticate);

// My subscriptions
router.get('/me/subscriptions', subscriptionController.getMySubscriptions);
router.get('/me/subscriptions/:subscription_id', subscriptionController.getSubscription);
router.get('/me/subscriptions/:subscription_id/entitlements', subscriptionController.getSubscriptionEntitlements);
router.get('/me/subscriptions/:subscription_id/history', subscriptionController.getSubscriptionHistory);

// Create subscription
router.post(
  '/me/subscriptions',
  rateLimitMiddleware(10, 60),
  validate(createSubscriptionSchema),
  subscriptionController.createSubscription
);

// Upgrade subscription
router.post(
  '/me/subscriptions/:subscription_id/upgrade',
  rateLimitMiddleware(10, 60),
  validate(upgradeSubscriptionSchema),
  subscriptionController.upgradeSubscription
);

// Downgrade subscription
router.post(
  '/me/subscriptions/:subscription_id/downgrade',
  rateLimitMiddleware(10, 60),
  validate(downgradeSubscriptionSchema),
  subscriptionController.downgradeSubscription
);

// Pause subscription
router.post(
  '/me/subscriptions/:subscription_id/pause',
  rateLimitMiddleware(5, 60),
  validate(pauseSubscriptionSchema),
  subscriptionController.pauseSubscription
);

// Resume subscription
router.post(
  '/me/subscriptions/:subscription_id/resume',
  rateLimitMiddleware(10, 60),
  subscriptionController.resumeSubscription
);

// Cancel subscription
router.post(
  '/me/subscriptions/:subscription_id/cancel',
  rateLimitMiddleware(5, 60),
  validate(cancelSubscriptionSchema),
  subscriptionController.cancelSubscription
);

// Toggle auto-renewal
router.put(
  '/me/subscriptions/:subscription_id/auto-renew',
  rateLimitMiddleware(10, 60),
  validate(toggleAutoRenewalSchema),
  subscriptionController.toggleAutoRenewal
);

// Renewal preview
router.get(
  '/me/subscriptions/:subscription_id/renewal-preview',
  subscriptionController.previewRenewal
);

// Promo code validation
router.post(
  '/validate-promo',
  rateLimitMiddleware(20, 60),
  validate(validatePromoCodeSchema),
  subscriptionController.validatePromoCode
);

// Price calculation
router.post(
  '/calculate-price',
  rateLimitMiddleware(30, 60),
  validate(calculatePriceSchema),
  subscriptionController.calculatePrice
);

module.exports = router;