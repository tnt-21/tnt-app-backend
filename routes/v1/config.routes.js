// ============================================
// FILE: routes/v1/config.routes.js
// Configuration Management Routes (Admin only)
// ============================================

const express = require('express');
const router = express.Router();
const configController = require('../../controllers/config.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { rateLimitMiddleware } = require('../../middlewares/rateLimit.middleware');

const {
  createPricingRuleSchema,
  updatePricingRuleSchema,
  createFairUsagePolicySchema,
  updateFairUsagePolicySchema,
  createPromoCodeSchema,
  updatePromoCodeSchema,
  validatePromoCodeSchemaForUser,
  upsertSettingSchema,
  createAlertSchema
} = require('../../utils/validation.util');

// All routes require authentication
router.use(authMiddleware.authenticate);

// ==================== PRICING RULES (Admin) ====================
router.get('/pricing-rules', rateLimitMiddleware(60, 60), configController.getPricingRules);
router.get('/pricing-rules/:rule_id', rateLimitMiddleware(60, 60), configController.getPricingRuleById);
router.post('/pricing-rules', rateLimitMiddleware(20, 60), validate(createPricingRuleSchema), configController.createPricingRule);
router.put('/pricing-rules/:rule_id', rateLimitMiddleware(20, 60), validate(updatePricingRuleSchema), configController.updatePricingRule);
router.delete('/pricing-rules/:rule_id', rateLimitMiddleware(10, 60), configController.deletePricingRule);

// ==================== FAIR USAGE POLICIES (Admin) ====================
router.get('/fair-usage', rateLimitMiddleware(60, 60), configController.getFairUsagePolicies);
router.post('/fair-usage', rateLimitMiddleware(20, 60), validate(createFairUsagePolicySchema), configController.createFairUsagePolicy);
router.put('/fair-usage/:policy_id', rateLimitMiddleware(20, 60), validate(updateFairUsagePolicySchema), configController.updateFairUsagePolicy);

// ==================== PROMO CODES ====================
// Admin routes
router.get('/promo-codes', rateLimitMiddleware(60, 60), configController.getPromoCodes);
router.get('/promo-codes/:promo_id', rateLimitMiddleware(60, 60), configController.getPromoCodeById);
router.post('/promo-codes', rateLimitMiddleware(20, 60), validate(createPromoCodeSchema), configController.createPromoCode);
router.put('/promo-codes/:promo_id', rateLimitMiddleware(20, 60), validate(updatePromoCodeSchema), configController.updatePromoCode);
router.delete('/promo-codes/:promo_id', rateLimitMiddleware(10, 60), configController.deletePromoCode);

// User-facing validation endpoint
router.post('/promo-codes/validate', rateLimitMiddleware(30, 60), validate(validatePromoCodeSchemaForUser), configController.validatePromoCode);

// ==================== APP SETTINGS ====================
router.get('/settings', rateLimitMiddleware(60, 60), configController.getSettings);
router.get('/settings/public', rateLimitMiddleware(100, 60), configController.getPublicSettings);
router.post('/settings', rateLimitMiddleware(20, 60), validate(upsertSettingSchema), configController.upsertSetting);
router.delete('/settings/:key', rateLimitMiddleware(10, 60), configController.deleteSetting);

// ==================== SYSTEM ALERTS ====================
router.get('/alerts', rateLimitMiddleware(100, 60), configController.getActiveAlerts);
router.post('/alerts', rateLimitMiddleware(20, 60), validate(createAlertSchema), configController.createAlert);
router.put('/alerts/:alert_id/deactivate', rateLimitMiddleware(20, 60), configController.deactivateAlert);

module.exports = router;