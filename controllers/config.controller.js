// ============================================
// FILE: controllers/config.controller.js
// Configuration Management Controller
// ============================================

const configService = require('../services/config.service');
const promoService = require('../services/promo.service');
const auditUtil = require('../utils/audit.util');
const ResponseUtil = require('../utils/response.util');

class ConfigController {
  // ==================== PRICING RULES ====================

  async getPricingRules(req, res, next) {
    try {
      const filters = {
        service_id: req.query.service_id,
        tier_id: req.query.tier_id,
        is_active: req.query.is_active === 'true',
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50
      };

      const result = await configService.getPricingRules(filters);
      return ResponseUtil.success(res, result, 'Pricing rules retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPricingRuleById(req, res, next) {
    try {
      const { rule_id } = req.params;
      const rule = await configService.getPricingRuleById(rule_id);
      return ResponseUtil.success(res, rule, 'Pricing rule retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createPricingRule(req, res, next) {
    try {
      const rule = await configService.createPricingRule(req.body);

      await auditUtil.log({
        admin_id: req.user.user_id,
        action: 'create',
        entity_type: 'pricing_rule',
        entity_id: rule.rule_id,
        new_value: rule,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, rule, 'Pricing rule created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updatePricingRule(req, res, next) {
    try {
      const { rule_id } = req.params;
      const oldRule = await configService.getPricingRuleById(rule_id);
      const rule = await configService.updatePricingRule(rule_id, req.body);

      await auditUtil.log({
        admin_id: req.user.user_id,
        action: 'update',
        entity_type: 'pricing_rule',
        entity_id: rule_id,
        old_value: oldRule,
        new_value: rule,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, rule, 'Pricing rule updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deletePricingRule(req, res, next) {
    try {
      const { rule_id } = req.params;
      await configService.deletePricingRule(rule_id);

      await auditUtil.log({
        admin_id: req.user.user_id,
        action: 'delete',
        entity_type: 'pricing_rule',
        entity_id: rule_id,
        changes_summary: 'Pricing rule deleted',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, null, 'Pricing rule deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== FAIR USAGE POLICIES ====================

  async getFairUsagePolicies(req, res, next) {
    try {
      const filters = {
        tier_id: req.query.tier_id,
        category_id: req.query.category_id,
        is_active: req.query.is_active === 'true'
      };

      const policies = await configService.getFairUsagePolicies(filters);
      return ResponseUtil.success(res, { policies }, 'Fair usage policies retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createFairUsagePolicy(req, res, next) {
    try {
      const policy = await configService.createFairUsagePolicy(req.body);

      await auditUtil.log({
        admin_id: req.user.user_id,
        action: 'create',
        entity_type: 'fair_usage_policy',
        entity_id: policy.policy_id,
        new_value: policy,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, policy, 'Fair usage policy created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateFairUsagePolicy(req, res, next) {
    try {
      const { policy_id } = req.params;
      const policy = await configService.updateFairUsagePolicy(policy_id, req.body);

      await auditUtil.log({
        admin_id: req.user.user_id,
        action: 'update',
        entity_type: 'fair_usage_policy',
        entity_id: policy_id,
        new_value: policy,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, policy, 'Fair usage policy updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== PROMO CODES ====================

  async getPromoCodes(req, res, next) {
    try {
      const filters = {
        is_active: req.query.is_active === 'true',
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50
      };

      const result = await promoService.getPromoCodes(filters);
      return ResponseUtil.success(res, result, 'Promo codes retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPromoCodeById(req, res, next) {
    try {
      const { promo_id } = req.params;
      const promo = await promoService.getPromoCodeById(promo_id);
      const stats = await promoService.getPromoUsageStats(promo_id);

      return ResponseUtil.success(res, { ...promo, usage_stats: stats }, 'Promo code retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async validatePromoCode(req, res, next) {
    try {
      const { promo_code, tier_id, service_id, amount } = req.body;
      const userId = req.user.user_id;

      const validation = await promoService.validatePromoCode(promo_code, userId, {
        tier_id, service_id, amount
      });

      return ResponseUtil.success(res, validation, 'Promo code validated successfully');
    } catch (error) {
      next(error);
    }
  }

  async createPromoCode(req, res, next) {
    try {
      const adminId = req.user.user_id;
      const promo = await promoService.createPromoCode(req.body, adminId);

      await auditUtil.log({
        admin_id: adminId,
        action: 'create',
        entity_type: 'promo_code',
        entity_id: promo.promo_id,
        new_value: promo,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, promo, 'Promo code created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updatePromoCode(req, res, next) {
    try {
      const { promo_id } = req.params;
      const promo = await promoService.updatePromoCode(promo_id, req.body);

      await auditUtil.log({
        admin_id: req.user.user_id,
        action: 'update',
        entity_type: 'promo_code',
        entity_id: promo_id,
        new_value: promo,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, promo, 'Promo code updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deletePromoCode(req, res, next) {
    try {
      const { promo_id } = req.params;
      const result = await promoService.deletePromoCode(promo_id);

      await auditUtil.log({
        admin_id: req.user.user_id,
        action: 'delete',
        entity_type: 'promo_code',
        entity_id: promo_id,
        changes_summary: result.deleted ? 'Promo code deleted' : 'Promo code deactivated',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, result, 'Promo code removed successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== APP SETTINGS ====================

  async getSettings(req, res, next) {
    try {
      const filters = {
        category: req.query.category,
        is_public: req.query.is_public === 'true'
      };

      const settings = await configService.getSettings(filters);
      return ResponseUtil.success(res, { settings }, 'Settings retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPublicSettings(req, res, next) {
    try {
      const settings = await configService.getSettings({ is_public: true });
      return ResponseUtil.success(res, { settings }, 'Public settings retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async upsertSetting(req, res, next) {
    try {
      const adminId = req.user.user_id;
      const setting = await configService.upsertSetting(req.body, adminId);

      await auditUtil.log({
        admin_id: adminId,
        action: 'upsert',
        entity_type: 'app_setting',
        entity_id: setting.setting_id,
        new_value: setting,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, setting, 'Setting saved successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteSetting(req, res, next) {
    try {
      const { key } = req.params;
      await configService.deleteSetting(key);

      await auditUtil.log({
        admin_id: req.user.user_id,
        action: 'delete',
        entity_type: 'app_setting',
        changes_summary: `Setting ${key} deleted`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, null, 'Setting deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== SYSTEM ALERTS ====================

  async getActiveAlerts(req, res, next) {
    try {
      const targetAudience = req.query.audience || 'all';
      const alerts = await configService.getActiveAlerts(targetAudience);
      return ResponseUtil.success(res, { alerts }, 'Active alerts retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createAlert(req, res, next) {
    try {
      const adminId = req.user.user_id;
      const alert = await configService.createAlert(req.body, adminId);

      await auditUtil.log({
        admin_id: adminId,
        action: 'create',
        entity_type: 'system_alert',
        entity_id: alert.alert_id,
        new_value: alert,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, alert, 'Alert created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async deactivateAlert(req, res, next) {
    try {
      const { alert_id } = req.params;
      const alert = await configService.deactivateAlert(alert_id);

      await auditUtil.log({
        admin_id: req.user.user_id,
        action: 'update',
        entity_type: 'system_alert',
        entity_id: alert_id,
        changes_summary: 'Alert deactivated',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, alert, 'Alert deactivated successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ConfigController();