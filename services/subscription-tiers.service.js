const { pool } = require('../config/database');
const attachmentService = require('./attachment.service');

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
      annual_price,
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
       (tier_code, tier_name, tier_description, marketing_tagline, base_price, annual_price, display_order, icon_url, color_hex, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        tier_code, 
        tier_name, 
        tier_description || null, 
        marketing_tagline || null, 
        base_price || 0, 
        annual_price || 0,
        display_order || 0, 
        icon_url || null, 
        color_hex || '#000000', 
        is_active
      ]
    );

    if (icon_url) {
      await attachmentService.markPermanent(icon_url);
    }

    return result.rows[0];
  }

  /**
   * Update tier
   */
  async update(id, data) {
    // Check if exists
    const currentTier = await this.getById(id);

    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'tier_code', 'tier_name', 'tier_description', 'marketing_tagline',
      'base_price', 'annual_price', 'display_order', 'icon_url', 'color_hex', 'is_active'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(data[field]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      return currentTier;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE subscription_tiers_ref 
      SET ${updates.join(', ')}
      WHERE tier_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    // Handle icon updates
    if (data.icon_url && data.icon_url !== currentTier.icon_url) {
      await attachmentService.markPermanent(data.icon_url);
      if (currentTier.icon_url) {
        attachmentService.unmarkPermanent(currentTier.icon_url).catch(err =>
          console.error("Failed to unmark old tier icon:", err)
        );
      }
    }

    return result.rows[0];
  }

  /**
   * Delete tier
   */
  async delete(id) {
    const tier = await this.getById(id);

    // Check if in use (subscriptions table)
    const subscriptions = await pool.query(
      'SELECT COUNT(*) FROM subscriptions WHERE tier_id = $1',
      [id]
    );

    if (parseInt(subscriptions.rows[0].count) > 0) {
      throw new Error('Cannot delete tier as it is associated with active or past subscriptions');
    }

    await pool.query('DELETE FROM subscription_tiers_ref WHERE tier_id = $1', [id]);
    
    if (tier.icon_url) {
      attachmentService.unmarkPermanent(tier.icon_url).catch(err =>
        console.error("Failed to unmark distinct tier icon:", err)
      );
    }
    
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
