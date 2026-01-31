const { pool } = require('../config/database');

class SubscriptionTiersService {
  /**
   * Get all subscription tiers
   */
  async getAll() {
    const query = `
      SELECT * FROM subscription_tiers_ref
      ORDER BY display_order ASC, tier_id ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get tier by ID
   */
  async getById(id) {
    const result = await pool.query(
      'SELECT * FROM subscription_tiers_ref WHERE tier_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Subscription tier not found');
    }
    
    return result.rows[0];
  }

  /**
   * Create new tier
   */
  async create(data) {
    const { 
      tier_code, 
      tier_name, 
      tier_description, 
      marketing_tagline, 
      base_price, 
      display_order, 
      icon_url, 
      color_hex, 
      is_active = true 
    } = data;

    // Check if code already exists
    const existing = await pool.query(
      'SELECT tier_id FROM subscription_tiers_ref WHERE tier_code = $1',
      [tier_code]
    );

    if (existing.rows.length > 0) {
      throw new Error('Tier code already exists');
    }

    const result = await pool.query(
      `INSERT INTO subscription_tiers_ref 
       (tier_code, tier_name, tier_description, marketing_tagline, base_price, display_order, icon_url, color_hex, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        tier_code, 
        tier_name, 
        tier_description || null, 
        marketing_tagline || null, 
        base_price || 0, 
        display_order || 0, 
        icon_url || null, 
        color_hex || '#000000', 
        is_active
      ]
    );

    return result.rows[0];
  }

  /**
   * Update tier
   */
  async update(id, data) {
    const { 
      tier_code, 
      tier_name, 
      tier_description, 
      marketing_tagline, 
      base_price, 
      display_order, 
      icon_url, 
      color_hex, 
      is_active 
    } = data;

    // Check if exists
    await this.getById(id);

    // Check code conflict
    if (tier_code) {
      const existing = await pool.query(
        'SELECT tier_id FROM subscription_tiers_ref WHERE tier_code = $1 AND tier_id != $2',
        [tier_code, id]
      );

      if (existing.rows.length > 0) {
        throw new Error('Tier code already exists');
      }
    }

    const result = await pool.query(
      `UPDATE subscription_tiers_ref 
       SET tier_code = COALESCE($1, tier_code),
           tier_name = COALESCE($2, tier_name),
           tier_description = COALESCE($3, tier_description),
           marketing_tagline = COALESCE($4, marketing_tagline),
           base_price = COALESCE($5, base_price),
           display_order = COALESCE($6, display_order),
           icon_url = $7,
           color_hex = COALESCE($8, color_hex),
           is_active = COALESCE($9, is_active),
           updated_at = NOW()
       WHERE tier_id = $10
       RETURNING *`,
      [
        tier_code, 
        tier_name, 
        tier_description, 
        marketing_tagline, 
        base_price, 
        display_order, 
        icon_url, 
        color_hex, 
        is_active, 
        id
      ]
    );

    return result.rows[0];
  }

  /**
   * Delete tier
   */
  async delete(id) {
    await this.getById(id);

    // Check if in use (subscriptions table)
    const subscriptions = await pool.query(
      'SELECT COUNT(*) FROM subscriptions WHERE tier_id = $1',
      [id]
    );

    if (parseInt(subscriptions.rows[0].count) > 0) {
      throw new Error('Cannot delete tier as it is associated with active or past subscriptions');
    }

    await pool.query('DELETE FROM subscription_tiers_ref WHERE tier_id = $1', [id]);
    return { success: true, message: 'Subscription tier deleted successfully' };
  }

  /**
   * Toggle active status
   */
  async toggleActive(id, isActive) {
    const result = await pool.query(
      `UPDATE subscription_tiers_ref 
       SET is_active = $1, updated_at = NOW()
       WHERE tier_id = $2
       RETURNING *`,
      [isActive, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Subscription tier not found');
    }

    return result.rows[0];
  }
}

module.exports = new SubscriptionTiersService();
