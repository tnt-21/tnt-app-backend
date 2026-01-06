const subscriptionService = require("../services/subscription.service");
const auditUtil = require("../utils/audit.util");
const ResponseUtil = require("../utils/response.util");

class SubscriptionController {
  // ==================== BROWSE TIERS ====================

  async getTiers(req, res, next) {
    try {
      const { species_id, life_stage_id } = req.query;
      const tiers = await subscriptionService.getTiers(species_id, life_stage_id);

      return ResponseUtil.success(res, { tiers }, "Subscription tiers retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getTierDetails(req, res, next) {
    try {
      const { tier_id } = req.params;
      const { species_id, life_stage_id } = req.query;
      
      const tierDetails = await subscriptionService.getTierDetails(
        tier_id, 
        species_id, 
        life_stage_id
      );

      return ResponseUtil.success(res, tierDetails, "Tier details retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== USER SUBSCRIPTIONS ====================

  async getMySubscriptions(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { status } = req.query;

      const subscriptions = await subscriptionService.getUserSubscriptions(userId, status);

      return ResponseUtil.success(
        res, 
        { subscriptions }, 
        "Subscriptions retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async getSubscription(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { subscription_id } = req.params;

      const subscription = await subscriptionService.getSubscriptionById(
        subscription_id, 
        userId
      );

      return ResponseUtil.success(
        res, 
        subscription, 
        "Subscription retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async getSubscriptionEntitlements(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { subscription_id } = req.params;

      const entitlements = await subscriptionService.getEntitlements(
        subscription_id, 
        userId
      );

      return ResponseUtil.success(
        res, 
        { entitlements }, 
        "Entitlements retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== CREATE SUBSCRIPTION ====================

  async createSubscription(req, res, next) {
    try {
      const userId = req.user.user_id;
      const subscriptionData = req.body;

      const subscription = await subscriptionService.createSubscription(
        userId, 
        subscriptionData
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "create",
        entity_type: "subscription",
        entity_id: subscription.subscription_id,
        new_value: subscription,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res, 
        subscription, 
        "Subscription created successfully", 
        201
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== UPGRADE SUBSCRIPTION ====================

  async upgradeSubscription(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { subscription_id } = req.params;
      const { new_tier_id, new_billing_cycle_id } = req.body;

      const result = await subscriptionService.upgradeSubscription(
        subscription_id,
        userId,
        new_tier_id,
        new_billing_cycle_id
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "upgrade",
        entity_type: "subscription",
        entity_id: subscription_id,
        changes_summary: `Upgraded subscription to tier ${new_tier_id}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res, 
        result, 
        "Subscription upgraded successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== DOWNGRADE SUBSCRIPTION ====================

  async downgradeSubscription(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { subscription_id } = req.params;
      const { new_tier_id, new_billing_cycle_id } = req.body;

      const result = await subscriptionService.downgradeSubscription(
        subscription_id,
        userId,
        new_tier_id,
        new_billing_cycle_id
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "downgrade",
        entity_type: "subscription",
        entity_id: subscription_id,
        changes_summary: `Downgraded subscription to tier ${new_tier_id}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res, 
        result, 
        "Subscription downgrade scheduled for next billing cycle"
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== PAUSE SUBSCRIPTION ====================

  async pauseSubscription(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { subscription_id } = req.params;
      const { reason, resume_date } = req.body;

      const subscription = await subscriptionService.pauseSubscription(
        subscription_id,
        userId,
        reason,
        resume_date
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "pause",
        entity_type: "subscription",
        entity_id: subscription_id,
        changes_summary: `Subscription paused until ${resume_date}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res, 
        subscription, 
        "Subscription paused successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== RESUME SUBSCRIPTION ====================

  async resumeSubscription(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { subscription_id } = req.params;

      const subscription = await subscriptionService.resumeSubscription(
        subscription_id,
        userId
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "resume",
        entity_type: "subscription",
        entity_id: subscription_id,
        changes_summary: "Subscription resumed",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res, 
        subscription, 
        "Subscription resumed successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== CANCEL SUBSCRIPTION ====================

  async cancelSubscription(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { subscription_id } = req.params;
      const { reason, immediate } = req.body;

      const result = await subscriptionService.cancelSubscription(
        subscription_id,
        userId,
        reason,
        immediate
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "cancel",
        entity_type: "subscription",
        entity_id: subscription_id,
        changes_summary: `Subscription cancelled - ${immediate ? 'immediate' : 'end of period'}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res, 
        result, 
        result.message
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== AUTO-RENEWAL ====================

  async toggleAutoRenewal(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { subscription_id } = req.params;
      const { auto_renew } = req.body;

      const subscription = await subscriptionService.toggleAutoRenewal(
        subscription_id,
        userId,
        auto_renew
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "subscription",
        entity_id: subscription_id,
        changes_summary: `Auto-renewal ${auto_renew ? 'enabled' : 'disabled'}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res, 
        subscription, 
        `Auto-renewal ${auto_renew ? 'enabled' : 'disabled'} successfully`
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== SUBSCRIPTION HISTORY ====================

  async getSubscriptionHistory(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { subscription_id } = req.params;

      const history = await subscriptionService.getSubscriptionHistory(
        subscription_id,
        userId
      );

      return ResponseUtil.success(
        res, 
        { history }, 
        "Subscription history retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== PROMO CODE ====================

  async validatePromoCode(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { promo_code, tier_id, billing_cycle_id } = req.body;

      const validation = await subscriptionService.validatePromoCode(
        promo_code,
        userId,
        tier_id,
        billing_cycle_id
      );

      return ResponseUtil.success(
        res, 
        validation, 
        "Promo code validated successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== PRICING CALCULATION ====================

  async calculatePrice(req, res, next) {
    try {
      const { tier_id, billing_cycle_id, promo_code } = req.body;
      const userId = req.user.user_id;

      const pricing = await subscriptionService.calculatePrice(
        tier_id,
        billing_cycle_id,
        promo_code,
        userId
      );

      return ResponseUtil.success(
        res, 
        pricing, 
        "Price calculated successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== RENEWAL PREVIEW ====================

  async previewRenewal(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { subscription_id } = req.params;

      const preview = await subscriptionService.previewRenewal(
        subscription_id,
        userId
      );

      return ResponseUtil.success(
        res, 
        preview, 
        "Renewal preview retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SubscriptionController();