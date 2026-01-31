const subscriptionTiersService = require('../services/subscription-tiers.service');
const ResponseUtil = require('../utils/response.util');

class SubscriptionTiersController {
  async getAll(req, res) {
    try {
      const tiers = await subscriptionTiersService.getAll();
      return ResponseUtil.success(res, tiers);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async getById(req, res) {
    try {
      const tier = await subscriptionTiersService.getById(req.params.id);
      return ResponseUtil.success(res, tier);
    } catch (error) {
      return ResponseUtil.error(res, error.message, error.message === 'Subscription tier not found' ? 404 : 500);
    }
  }

  async create(req, res) {
    try {
      const tier = await subscriptionTiersService.create(req.body);
      return ResponseUtil.success(res, tier, 'Subscription tier created successfully', 201);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async update(req, res) {
    try {
      const tier = await subscriptionTiersService.update(req.params.id, req.body);
      return ResponseUtil.success(res, tier, 'Subscription tier updated successfully');
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async delete(req, res) {
    try {
      const result = await subscriptionTiersService.delete(req.params.id);
      return ResponseUtil.success(res, null, result.message);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async toggleActive(req, res) {
    try {
      const { is_active } = req.body;
      const tier = await subscriptionTiersService.toggleActive(req.params.id, is_active);
      return ResponseUtil.success(res, tier, `Subscription tier ${is_active ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }
}

module.exports = new SubscriptionTiersController();
