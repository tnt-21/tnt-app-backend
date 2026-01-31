// ============================================
// FILE: services/referral.service.js
// Referral Tracking & Rewards Service
// ============================================

const { pool } = require('../config/database');
const { AppError } = require('../utils/response.util');

class ReferralService {
  /**
   * Get referral info for a specific user
   */
  async getUserReferralInfo(userId) {
    const query = `
      SELECT 
        u.referral_code,
        (SELECT COUNT(*) FROM referrals WHERE referrer_id = $1) as total_referrals,
        (SELECT COUNT(*) FROM referrals WHERE referrer_id = $1 AND status = 'completed') as successful_referrals,
        (SELECT COALESCE(SUM(reward_value), 0) FROM referral_rewards WHERE user_id = $1 AND status = 'processed') as total_rewards_earned
      FROM users u
      WHERE u.user_id = $1
    `;

    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return result.rows[0];
  }

  /**
   * Track a new referral (when user signs up with a code)
   */
  async trackNewReferral(referredUserId, referralCode) {
    // 1. Find referrer by code
    const referrerQuery = 'SELECT user_id FROM users WHERE referral_code = $1';
    const referrerResult = await pool.query(referrerQuery, [referralCode.toUpperCase()]);

    if (referrerResult.rows.length === 0) {
      // If code is invalid, we don't throw error but just don't track anything
      return null;
    }

    const referrerId = referrerResult.rows[0].user_id;

    // Users cannot refer themselves
    if (referrerId === referredUserId) {
      return null;
    }

    // 2. Create referral record
    const insertQuery = `
      INSERT INTO referrals (referrer_id, referred_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (referred_id) DO NOTHING
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [referrerId, referredUserId]);
    return result.rows[0] || null;
  }

  /**
   * Complete a referral (e.g., after first booking or subscription)
   */
  async completeReferral(referredUserId) {
    const query = `
      UPDATE referrals
      SET status = 'completed', completed_at = NOW()
      WHERE referred_id = $1 AND status = 'pending'
      RETURNING *
    `;

    const result = await pool.query(query, [referredUserId]);
    
    if (result.rows.length > 0) {
      const referral = result.rows[0];
      // Trigger reward logic here
      await this.issueReferralReward(referral.referrer_id, referral.referral_id);
      return referral;
    }

    return null;
  }

  /**
   * Issue reward to referrer
   * For Phase 13, we'll create a pending reward record
   */
  async issueReferralReward(referrerId, referralId) {
    const query = `
      INSERT INTO referral_rewards (referral_id, user_id, reward_type, reward_value, status)
      VALUES ($1, $2, 'referral_bonus', 50.00, 'pending')
      RETURNING *
    `;

    const result = await pool.query(query, [referralId, referrerId]);
    return result.rows[0];
  }

  /**
   * Admin: Get global referral statistics
   */
  async getGlobalReferralStats() {
    const query = `
      SELECT 
        COUNT(*) as total_referrals,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_referrals,
        COUNT(DISTINCT referrer_id) as active_referrers,
        (SELECT COALESCE(SUM(reward_value), 0) FROM referral_rewards WHERE status = 'processed') as total_rewards_issued
      FROM referrals
    `;

    const result = await pool.query(query);
    return result.rows[0];
  }

  /**
   * Admin: List all referrals with pagination and filters
   */
  async getAllReferrals(filters = {}) {
    const { status, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      whereClause += ` AND r.status = $${params.length}`;
    }

    const query = `
      SELECT 
        r.*,
        u_ref.full_name as referrer_name,
        u_ref.phone as referrer_phone,
        u_new.full_name as referred_name,
        u_new.phone as referred_phone
      FROM referrals r
      JOIN users u_ref ON r.referrer_id = u_ref.user_id
      JOIN users u_new ON r.referred_id = u_new.user_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);
    const result = await pool.query(query, params);

    const countQuery = `SELECT COUNT(*) FROM referrals r ${whereClause}`;
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    return {
      referrals: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page,
        limit
      }
    };
  }
}

module.exports = new ReferralService();
