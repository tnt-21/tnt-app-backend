const { pool } = require('../config/database');

class LocationTypesService {
  /**
   * Get all location types
   */
  async getAll() {
    const query = `
      SELECT * FROM location_types_ref
      ORDER BY location_type_id ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get type by ID
   */
  async getById(id) {
    const result = await pool.query(
      'SELECT * FROM location_types_ref WHERE location_type_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Location type not found');
    }
    
    return result.rows[0];
  }

  /**
   * Create new location type
   */
  async create(data) {
    const { 
      type_code, 
      type_name, 
      description, 
      is_active = true 
    } = data;

    // Check if code already exists
    const existing = await pool.query(
      'SELECT location_type_id FROM location_types_ref WHERE type_code = $1',
      [type_code]
    );

    if (existing.rows.length > 0) {
      throw new Error('Type code already exists');
    }

    const result = await pool.query(
      `INSERT INTO location_types_ref 
       (type_code, type_name, description, is_active, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [
        type_code, 
        type_name, 
        description || null, 
        is_active
      ]
    );

    return result.rows[0];
  }

  /**
   * Update location type
   */
  async update(id, data) {
    const { 
      type_code, 
      type_name, 
      description, 
      is_active 
    } = data;

    // Check if exists
    await this.getById(id);

    // Check code conflict
    if (type_code) {
      const existing = await pool.query(
        'SELECT location_type_id FROM location_types_ref WHERE type_code = $1 AND location_type_id != $2',
        [type_code, id]
      );

      if (existing.rows.length > 0) {
        throw new Error('Type code already exists');
      }
    }

    const result = await pool.query(
      `UPDATE location_types_ref 
       SET type_code = COALESCE($1, type_code),
           type_name = COALESCE($2, type_name),
           description = COALESCE($3, description),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE location_type_id = $5
       RETURNING *`,
      [
        type_code, 
        type_name, 
        description, 
        is_active, 
        id
      ]
    );

    return result.rows[0];
  }

  /**
   * Delete location type
   */
  async delete(id) {
    await this.getById(id);

    // Check if in use (bookings table or addresses table)
    // Bookings table uses location_type column (usually string but sometimes ID depending on schema version, let's assume it checks)
    const bookings = await pool.query(
      'SELECT COUNT(*) FROM bookings WHERE location_type = (SELECT type_code FROM location_types_ref WHERE location_type_id = $1)',
      [id]
    );

    if (parseInt(bookings.rows[0].count) > 0) {
      throw new Error('Cannot delete location type as it is associated with one or more bookings');
    }

    await pool.query('DELETE FROM location_types_ref WHERE location_type_id = $1', [id]);
    return { success: true, message: 'Location type deleted successfully' };
  }

  /**
   * Toggle active status
   */
  async toggleActive(id, isActive) {
    const result = await pool.query(
      `UPDATE location_types_ref 
       SET is_active = $1, updated_at = NOW()
       WHERE location_type_id = $2
       RETURNING *`,
      [isActive, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Location type not found');
    }

    return result.rows[0];
  }
}

module.exports = new LocationTypesService();
