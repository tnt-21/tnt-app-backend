// ============================================
// FILE: services/config.service.js
// Configuration Management Service
// ============================================

const { pool } = require('../config/database');
const { AppError } = require('../utils/response.util');

class ConfigService {
  // ==================== PRICING RULES ====================

  async getPricingRules(filters = {}) {
    const { service_id, tier_id, is_active, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let values = [];
    let paramCount = 1;

    if (service_id) {
      whereConditions.push(`service_id = $${paramCount}`);
      values.push(service_id);
      paramCount++;
    }

    if (tier_id) {
      whereConditions.push(`tier_id = $${paramCount}`);
      values.push(tier_id);
      paramCount++;
    }

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
        pr.*,
        sc.service_name,
        st.tier_name,
        sp.species_name,
        ls.life_stage_name,
        lt.type_name as location_type_name
      FROM pricing_rules pr
      LEFT JOIN service_catalog sc ON pr.service_id = sc.service_id
      LEFT JOIN subscription_tiers_ref st ON pr.tier_id = st.tier_id
      LEFT JOIN species_ref sp ON pr.species_id = sp.species_id
      LEFT JOIN life_stages_ref ls ON pr.life_stage_id = ls.life_stage_id
      LEFT JOIN location_types_ref lt ON pr.location_type_id = lt.location_type_id
      ${whereClause}
      ORDER BY priority DESC, created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM pricing_rules ${whereClause}`;
    const countResult = await pool.query(countQuery, values.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    return {
      rules: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getPricingRuleById(ruleId) {
    const query = `
      SELECT 
        pr.*,
        sc.service_name,
        st.tier_name,
        sp.species_name,
        ls.life_stage_name,
        lt.type_name as location_type_name
      FROM pricing_rules pr
      LEFT JOIN service_catalog sc ON pr.service_id = sc.service_id
      LEFT JOIN subscription_tiers_ref st ON pr.tier_id = st.tier_id
      LEFT JOIN species_ref sp ON pr.species_id = sp.species_id
      LEFT JOIN life_stages_ref ls ON pr.life_stage_id = ls.life_stage_id
      LEFT JOIN location_types_ref lt ON pr.location_type_id = lt.location_type_id
      WHERE pr.rule_id = $1
    `;

    const result = await pool.query(query, [ruleId]);

    if (result.rows.length === 0) {
      throw new AppError('Pricing rule not found', 404, 'RULE_NOT_FOUND');
    }

    return result.rows[0];
  }

  async createPricingRule(ruleData) {
    const {
      rule_name, service_id, tier_id, species_id, life_stage_id,
      location_type_id, price_modifier, modifier_type, day_of_week,
      time_start, time_end, min_booking_value, max_booking_value,
      priority, valid_from, valid_until, description
    } = ruleData;

    const query = `
      INSERT INTO pricing_rules (
        rule_name, service_id, tier_id, species_id, life_stage_id,
        location_type_id, price_modifier, modifier_type, day_of_week,
        time_start, time_end, min_booking_value, max_booking_value,
        priority, valid_from, valid_until, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const values = [
      rule_name, service_id || null, tier_id || null, species_id || null,
      life_stage_id || null, location_type_id || null, price_modifier || null,
      modifier_type || null, day_of_week || null, time_start || null,
      time_end || null, min_booking_value || null, max_booking_value || null,
      priority || 0, valid_from || null, valid_until || null, description || null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updatePricingRule(ruleId, updateData) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = [
      'rule_name', 'service_id', 'tier_id', 'species_id', 'life_stage_id',
      'location_type_id', 'price_modifier', 'modifier_type', 'day_of_week',
      'time_start', 'time_end', 'min_booking_value', 'max_booking_value',
      'is_active', 'priority', 'valid_from', 'valid_until', 'description'
    ];

    fields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new AppError('No fields to update', 400, 'NO_UPDATES');
    }

    updates.push(`updated_at = NOW()`);
    values.push(ruleId);

    const query = `
      UPDATE pricing_rules
      SET ${updates.join(', ')}
      WHERE rule_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError('Pricing rule not found', 404, 'RULE_NOT_FOUND');
    }

    return result.rows[0];
  }

  async deletePricingRule(ruleId) {
    const query = `
      DELETE FROM pricing_rules WHERE rule_id = $1 RETURNING rule_id
    `;

    const result = await pool.query(query, [ruleId]);

    if (result.rows.length === 0) {
      throw new AppError('Pricing rule not found', 404, 'RULE_NOT_FOUND');
    }

    return true;
  }

  // ==================== FAIR USAGE POLICIES ====================

  async getFairUsagePolicies(filters = {}) {
    const { tier_id, category_id, is_active } = filters;

    let whereConditions = [];
    let values = [];
    let paramCount = 1;

    if (tier_id) {
      whereConditions.push(`fup.tier_id = $${paramCount}`);
      values.push(tier_id);
      paramCount++;
    }

    if (category_id) {
      whereConditions.push(`fup.category_id = $${paramCount}`);
      values.push(category_id);
      paramCount++;
    }

    if (is_active !== undefined) {
      whereConditions.push(`fup.is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT 
        fup.*,
        st.tier_name,
        sc.category_name
      FROM fair_usage_policies fup
      JOIN subscription_tiers_ref st ON fup.tier_id = st.tier_id
      JOIN service_categories_ref sc ON fup.category_id = sc.category_id
      ${whereClause}
      ORDER BY fup.tier_id, fup.category_id
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  async createFairUsagePolicy(policyData) {
    const {
      tier_id, category_id, max_usage_per_month, max_usage_per_week,
      max_usage_per_day, cooldown_period_days, cooldown_period_hours,
      abuse_threshold, abuse_action, description
    } = policyData;

    // Check if policy already exists
    const existingCheck = await pool.query(
      'SELECT policy_id FROM fair_usage_policies WHERE tier_id = $1 AND category_id = $2',
      [tier_id, category_id]
    );

    if (existingCheck.rows.length > 0) {
      throw new AppError('Policy already exists for this tier and category', 409, 'POLICY_EXISTS');
    }

    const query = `
      INSERT INTO fair_usage_policies (
        tier_id, category_id, max_usage_per_month, max_usage_per_week,
        max_usage_per_day, cooldown_period_days, cooldown_period_hours,
        abuse_threshold, abuse_action, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      tier_id, category_id, max_usage_per_month || null, max_usage_per_week || null,
      max_usage_per_day || null, cooldown_period_days || null, cooldown_period_hours || null,
      abuse_threshold || null, abuse_action || null, description || null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateFairUsagePolicy(policyId, updateData) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = [
      'max_usage_per_month', 'max_usage_per_week', 'max_usage_per_day',
      'cooldown_period_days', 'cooldown_period_hours', 'abuse_threshold',
      'abuse_action', 'description', 'is_active'
    ];

    fields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new AppError('No fields to update', 400, 'NO_UPDATES');
    }

    updates.push(`updated_at = NOW()`);
    values.push(policyId);

    const query = `
      UPDATE fair_usage_policies
      SET ${updates.join(', ')}
      WHERE policy_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError('Policy not found', 404, 'POLICY_NOT_FOUND');
    }

    return result.rows[0];
  }

  // ==================== APP SETTINGS ====================

  async getSettings(filters = {}) {
    const { category, is_public } = filters;

    let whereConditions = [];
    let values = [];
    let paramCount = 1;

    if (category) {
      whereConditions.push(`category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (is_public !== undefined) {
      whereConditions.push(`is_public = $${paramCount}`);
      values.push(is_public);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT * FROM app_settings ${whereClause}
      ORDER BY category, setting_key
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  async getSettingByKey(key) {
    const query = 'SELECT * FROM app_settings WHERE setting_key = $1';
    const result = await pool.query(query, [key]);

    if (result.rows.length === 0) {
      throw new AppError('Setting not found', 404, 'SETTING_NOT_FOUND');
    }

    return result.rows[0];
  }

  async upsertSetting(settingData, adminId) {
    const {
      setting_key, setting_value, setting_type, category, description, is_public
    } = settingData;

    const query = `
      INSERT INTO app_settings (
        setting_key, setting_value, setting_type, category, description, is_public, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (setting_key) DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        setting_type = EXCLUDED.setting_type,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        is_public = EXCLUDED.is_public,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      setting_key, setting_value, setting_type || 'string',
      category || 'general', description || null, is_public || false, adminId
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async deleteSetting(key) {
    const query = 'DELETE FROM app_settings WHERE setting_key = $1 RETURNING setting_id';
    const result = await pool.query(query, [key]);

    if (result.rows.length === 0) {
      throw new AppError('Setting not found', 404, 'SETTING_NOT_FOUND');
    }

    return true;
  }

  // ==================== SYSTEM ALERTS ====================

  async getActiveAlerts(targetAudience = 'all') {
    const query = `
      SELECT * FROM system_alerts
      WHERE is_active = true
        AND start_time <= NOW()
        AND (end_time IS NULL OR end_time >= NOW())
        AND (target_audience = $1 OR target_audience = 'all')
      ORDER BY severity DESC, start_time DESC
    `;

    const result = await pool.query(query, [targetAudience]);
    return result.rows;
  }

  async createAlert(alertData, adminId) {
    const {
      alert_type, title, message, severity, display_location,
      target_audience, start_time, end_time
    } = alertData;

    const query = `
      INSERT INTO system_alerts (
        alert_type, title, message, severity, display_location,
        target_audience, start_time, end_time, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      alert_type, title, message, severity || 'info',
      display_location || 'banner', target_audience || 'all',
      start_time, end_time || null, adminId
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async deactivateAlert(alertId) {
    const query = `
      UPDATE system_alerts
      SET is_active = false
      WHERE alert_id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [alertId]);

    if (result.rows.length === 0) {
      throw new AppError('Alert not found', 404, 'ALERT_NOT_FOUND');
    }

    return result.rows[0];
  }
}

module.exports = new ConfigService();