
const subscriptionService = require('../services/subscription.service');
const ResponseUtil = require('../utils/response.util');

class AdminController {
  
  async updateTier(req, res, next) {
    try {
      const { tierId } = req.params;
      const updates = req.body;

      // Basic validation
      if (!updates.base_price && !updates.tier_name) {
        // Allow partial updates, but ensure at least something is there
      }

      const updatedTier = await subscriptionService.updateTier(tierId, updates);

      return ResponseUtil.success(
        res,
        updatedTier,
        'Tier updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async updateTierConfig(req, res, next) {
    try {
      const { tierId } = req.params;
      const { species_id, life_stage_id, category_id, quota_monthly, quota_annual, is_included } = req.body;

      if (!species_id || !life_stage_id || !category_id) {
        return ResponseUtil.error(res, 'Missing required fields', 400);
      }

      const config = {
        quota_monthly,
        quota_annual,
        is_included: is_included !== undefined ? is_included : true
      };

      const updatedConfig = await subscriptionService.updateTierConfig(
        tierId,
        species_id,
        life_stage_id,
        category_id,
        config
      );

      return ResponseUtil.success(
        res,
        updatedConfig,
        'Tier configuration updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();
