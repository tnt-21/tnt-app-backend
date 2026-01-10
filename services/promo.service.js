// ============================================
// FILE: services/promo.service.js
// Promo Code Management Service
// ============================================

const { pool } = require('../config/database');
const { AppError } = require('../utils/response.util');

class PromoService {
  async getPromoCodes(filters = {}) {
    const { is_active, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let values = [];
    let paramCount = 1;

    if (is_active !== undefined) {
      whereConditions.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT 
        pc.*,
        au.full_name as created_by_name,
        (pc.max_uses_total - pc.current_uses) as remaining_uses
      FROM promo_codes pc
      LEFT JOIN admin_users au ON pc.created_by = au.admin_id
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);

    const countQuery = `SELECT COUNT(*) as total FROM promo_codes ${whereClause}`;
    const countResult = await pool.query(countQuery, values.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    return {
      promo_codes: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getPromoCodeById(promoId) {
    const query = `
      SELECT 
        pc.*,
        au.full_name as created_by_name,
        (pc.max_uses_total - pc.current_uses) as remaining_uses
      FROM promo_codes pc
      LEFT JOIN admin_users au ON pc.created_by = au.admin_id
      WHERE pc.promo_id = $1
    `;

    const result = await pool.query(query, [promoId]);

    if (result.rows.length === 0) {
      throw new AppError('Promo code not found', 404, 'PROMO_NOT_FOUND');
    }

    return result.rows[0];
  }

  async validatePromoCode(code, userId, context = {}) {
    const { tier_id, service_id, amount } = context;

    const query = `
      SELECT * FROM promo_codes
      WHERE promo_code = $1
        AND is_active = true
        AND valid_from <= CURRENT_DATE
        AND valid_until >= CURRENT_DATE
        AND (max_uses_total IS NULL OR current_uses < max_uses_total)
    `;

    const result = await pool.query(query, [code.toUpperCase()]);

    if (result.rows.length === 0) {
      throw new AppError('Invalid or expired promo code', 400, 'INVALID_PROMO');
    }

    const promo = result.rows[0];

    // Check per-user usage limit
    if (promo.max_uses_per_user) {
      const usageCheck = await pool.query(
        'SELECT COUNT(*) as count FROM promo_code_usage WHERE promo_id = $1 AND user_id = $2',
        [promo.promo_id, userId]
      );

      const userUsageCount = parseInt(usageCheck.rows[0].count);

      if (userUsageCount >= promo.max_uses_per_user) {
        throw new AppError('Promo code usage limit exceeded', 400, 'PROMO_LIMIT_EXCEEDED');
      }
    }

    // Check applicable_to
    if (promo.applicable_to && promo.applicable_to !== 'all') {
      if (promo.applicable_to === 'subscription' && !tier_id) {
        throw new AppError('Promo code only valid for subscriptions', 400, 'PROMO_NOT_APPLICABLE');
      }
      if (promo.applicable_to === 'service' && !service_id) {
        throw new AppError('Promo code only valid for services', 400, 'PROMO_NOT_APPLICABLE');
      }
    }

    // Check tier_ids if specified
    if (promo.tier_ids && tier_id) {
      const tierIds = promo.tier_ids;
      if (!tierIds.includes(tier_id)) {
        throw new AppError('Promo code not valid for this tier', 400, 'PROMO_NOT_APPLICABLE');
      }
    }

    // Check service_ids if specified
    if (promo.service_ids && service_id) {
      const serviceIds = promo.service_ids;
      if (!serviceIds.includes(service_id)) {
        throw new AppError('Promo code not valid for this service', 400, 'PROMO_NOT_APPLICABLE');
      }
    }

    // Check minimum purchase amount
    if (promo.min_purchase_amount && amount < promo.min_purchase_amount) {
      throw new AppError(
        `Minimum purchase amount of ₹${promo.min_purchase_amount} required`,
        400,
        'MIN_AMOUNT_NOT_MET'
      );
    }

    // Calculate discount
    let discount = 0;
    if (promo.discount_type === 'percentage') {
      discount = (amount * promo.discount_value) / 100;
      if (promo.max_discount_amount && discount > promo.max_discount_amount) {
        discount = promo.max_discount_amount;
      }
    } else {
      discount = promo.discount_value;
    }

    return {
      promo_id: promo.promo_id,
      promo_code: promo.promo_code,
      promo_name: promo.promo_name,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      discount_applied: discount,
      valid: true
    };
  }

  async createPromoCode(promoData, adminId) {
    const {
      promo_code, promo_name, description, discount_type, discount_value,
      max_discount_amount, min_purchase_amount, applicable_to, tier_ids,
      service_ids, max_uses_total, max_uses_per_user, valid_from, valid_until
    } = promoData;

    // Check if code already exists
    const existingCheck = await pool.query(
      'SELECT promo_id FROM promo_codes WHERE promo_code = $1',
      [promo_code.toUpperCase()]
    );

    if (existingCheck.rows.length > 0) {
      throw new AppError('Promo code already exists', 409, 'PROMO_EXISTS');
    }

    const query = `
      INSERT INTO promo_codes (
        promo_code, promo_name, description, discount_type, discount_value,
        max_discount_amount, min_purchase_amount, applicable_to, tier_ids,
        service_ids, max_uses_total, max_uses_per_user, valid_from, valid_until, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const values = [
      promo_code.toUpperCase(), promo_name, description || null, discount_type,
      discount_value, max_discount_amount || null, min_purchase_amount || null,
      applicable_to || 'all', tier_ids ? JSON.stringify(tier_ids) : null,
      service_ids ? JSON.stringify(service_ids) : null, max_uses_total || null,
      max_uses_per_user || 1, valid_from, valid_until, adminId
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updatePromoCode(promoId, updateData) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = [
      'promo_name', 'description', 'discount_type', 'discount_value',
      'max_discount_amount', 'min_purchase_amount', 'applicable_to',
      'tier_ids', 'service_ids', 'max_uses_total', 'max_uses_per_user',
      'is_active', 'valid_from', 'valid_until'
    ];

    fields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'tier_ids' || field === 'service_ids') {
          updates.push(`${field} = $${paramCount}`);
          values.push(JSON.stringify(updateData[field]));
        } else {
          updates.push(`${field} = $${paramCount}`);
          values.push(updateData[field]);
        }
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new AppError('No fields to update', 400, 'NO_UPDATES');
    }

    updates.push(`updated_at = NOW()`);
    values.push(promoId);

    const query = `
      UPDATE promo_codes
      SET ${updates.join(', ')}
      WHERE promo_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError('Promo code not found', 404, 'PROMO_NOT_FOUND');
    }

    return result.rows[0];
  }

  async deletePromoCode(promoId) {
    // Check if promo code has been used
    const usageCheck = await pool.query(
      'SELECT COUNT(*) as count FROM promo_code_usage WHERE promo_id = $1',
      [promoId]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      // Don't delete, just deactivate
      const result = await pool.query(
        'UPDATE promo_codes SET is_active = false WHERE promo_id = $1 RETURNING *',
        [promoId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Promo code not found', 404, 'PROMO_NOT_FOUND');
      }

      return { deactivated: true, promo_code: result.rows[0] };
    }

    const query = 'DELETE FROM promo_codes WHERE promo_id = $1 RETURNING promo_id';
    const result = await pool.query(query, [promoId]);

    if (result.rows.length === 0) {
      throw new AppError('Promo code not found', 404, 'PROMO_NOT_FOUND');
    }

    return { deleted: true };
  }

  async recordPromoUsage(promoId, userId, context = {}) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Increment usage count
      await client.query(
        'UPDATE promo_codes SET current_uses = current_uses + 1 WHERE promo_id = $1',
        [promoId]
      );

      // Record usage
      const query = `
        INSERT INTO promo_code_usage (
          promo_id, user_id, subscription_id, booking_id, invoice_id, discount_applied
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const values = [
        promoId, userId, context.subscription_id || null,
        context.booking_id || null, context.invoice_id || null,
        context.discount_applied
      ];

      const result = await client.query(query, values);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getPromoUsageStats(promoId) {
    const query = `
      SELECT 
        COUNT(*) as total_uses,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(discount_applied) as total_discount_given,
        MIN(used_at) as first_use,
        MAX(used_at) as last_use
      FROM promo_code_usage
      WHERE promo_id = $1
    `;

    const result = await pool.query(query, [promoId]);
    return result.rows[0];
  }
}

module.exports = new PromoService();