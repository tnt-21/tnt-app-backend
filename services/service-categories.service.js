const { pool } = require('../config/database');

class ServiceCategoriesService {
  /**
   * Get all service categories
   */
  async getAll() {
    const query = `
      SELECT * FROM service_categories_ref
      ORDER BY display_order ASC, category_id ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get category by ID
   */
  async getById(id) {
    const result = await pool.query(
      'SELECT * FROM service_categories_ref WHERE category_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Service category not found');
    }
    
    return result.rows[0];
  }

  /**
   * Create new category
   */
  async create(data) {
    const { 
      category_code, 
      category_name, 
      description, 
      icon_url, 
      display_order, 
      is_active = true 
    } = data;

    // Check if code already exists
    const existing = await pool.query(
      'SELECT category_id FROM service_categories_ref WHERE category_code = $1',
      [category_code]
    );

    if (existing.rows.length > 0) {
      throw new Error('Category code already exists');
    }

    const result = await pool.query(
      `INSERT INTO service_categories_ref 
       (category_code, category_name, description, icon_url, display_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        category_code, 
        category_name, 
        description || null, 
        icon_url || null, 
        display_order || 0, 
        is_active
      ]
    );

    return result.rows[0];
  }

  /**
   * Update category
   */
  async update(id, data) {
    const { 
      category_code, 
      category_name, 
      description, 
      icon_url, 
      display_order, 
      is_active 
    } = data;

    // Check if exists
    await this.getById(id);

    // Check code conflict
    if (category_code) {
      const existing = await pool.query(
        'SELECT category_id FROM service_categories_ref WHERE category_code = $1 AND category_id != $2',
        [category_code, id]
      );

      if (existing.rows.length > 0) {
        throw new Error('Category code already exists');
      }
    }

    const result = await pool.query(
      `UPDATE service_categories_ref 
       SET category_code = COALESCE($1, category_code),
           category_name = COALESCE($2, category_name),
           description = COALESCE($3, description),
           icon_url = $4,
           display_order = COALESCE($5, display_order),
           is_active = COALESCE($6, is_active),
           updated_at = NOW()
       WHERE category_id = $7
       RETURNING *`,
      [
        category_code, 
        category_name, 
        description, 
        icon_url, 
        display_order, 
        is_active, 
        id
      ]
    );

    return result.rows[0];
  }

  /**
   * Delete category
   */
  async delete(id) {
    await this.getById(id);

    // Check if in use (services table)
    const services = await pool.query(
      'SELECT COUNT(*) FROM services WHERE category_id = $1',
      [id]
    );

    if (parseInt(services.rows[0].count) > 0) {
      throw new Error('Cannot delete category as it is associated with one or more services');
    }

    await pool.query('DELETE FROM service_categories_ref WHERE category_id = $1', [id]);
    return { success: true, message: 'Service category deleted successfully' };
  }

  /**
   * Toggle active status
   */
  async toggleActive(id, isActive) {
    const result = await pool.query(
      `UPDATE service_categories_ref 
       SET is_active = $1, updated_at = NOW()
       WHERE category_id = $2
       RETURNING *`,
      [isActive, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Service category not found');
    }

    return result.rows[0];
  }
}

module.exports = new ServiceCategoriesService();
