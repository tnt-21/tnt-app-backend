// ============================================
// FILE: controllers/referral.controller.js
// Referral Management Controller
// ============================================

const referralService = require('../services/referral.service');
const ResponseUtil = require('../utils/response.util');

class ReferralController {
  /**
   * Get current user's referral code and stats
   */
  async getMyReferralInfo(req, res, next) {
    try {
      const userId = req.user.user_id;
      const result = await referralService.getUserReferralInfo(userId);
      return ResponseUtil.success(res, result, 'Referral info retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Get dashboard metrics for referrals
   */
  async getAdminStats(req, res, next) {
    try {
      const stats = await referralService.getGlobalReferralStats();
      return ResponseUtil.success(res, stats, 'Referral stats retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: List all referrals
   */
  async getAllReferrals(req, res, next) {
    try {
      const filters = {
        status: req.query.status,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };
      
      const result = await referralService.getAllReferrals(filters);
      return ResponseUtil.success(res, result, 'Referrals retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReferralController();
