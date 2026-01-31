const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class SpeciesService {
  /**
   * Get all species
   */
  async getAll() {
    const result = await pool.query(
      `SELECT * FROM species_ref 
       ORDER BY species_name ASC`
    );
    return result.rows;
  }

  /**
   * Get species by ID
   */
  async getById(speciesId) {
    const result = await pool.query(
      'SELECT * FROM species_ref WHERE species_id = $1',
      [speciesId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Species not found');
    }
    
    return result.rows[0];
  }

  /**
   * Create new species
   */
  async create(data) {
    const { species_code, species_name, icon_url, is_active = true } = data;

    // Check if species code already exists
    const existing = await pool.query(
      'SELECT species_id FROM species_ref WHERE species_code = $1',
      [species_code]
    );

    if (existing.rows.length > 0) {
      throw new Error('Species code already exists');
    }

    const result = await pool.query(
      `INSERT INTO species_ref 
       (species_code, species_name, icon_url, is_active, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [species_code, species_name, icon_url || null, is_active]
    );

    return result.rows[0];
  }

  /**
   * Update species
   */
  async update(speciesId, data) {
    const { species_code, species_name, icon_url, is_active } = data;

    // Check if species exists
    await this.getById(speciesId);

    // Check if new species code conflicts with existing
    if (species_code) {
      const existing = await pool.query(
        'SELECT species_id FROM species_ref WHERE species_code = $1 AND species_id != $2',
        [species_code, speciesId]
      );

      if (existing.rows.length > 0) {
        throw new Error('Species code already exists');
      }
    }

    const result = await pool.query(
      `UPDATE species_ref 
       SET species_code = COALESCE($1, species_code),
           species_name = COALESCE($2, species_name),
           icon_url = COALESCE($3, icon_url),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE species_id = $5
       RETURNING *`,
      [species_code, species_name, icon_url, is_active, speciesId]
    );

    return result.rows[0];
  }

  /**
   * Delete species
   */
  async delete(speciesId) {
    // Check if species exists
    await this.getById(speciesId);

    // Check if species is being used
    const lifeStages = await pool.query(
      'SELECT COUNT(*) FROM life_stages_ref WHERE species_id = $1',
      [speciesId]
    );

    if (parseInt(lifeStages.rows[0].count) > 0) {
      throw new Error('Cannot delete species with associated life stages');
    }

    await pool.query(
      'DELETE FROM species_ref WHERE species_id = $1',
      [speciesId]
    );

    return { success: true, message: 'Species deleted successfully' };
  }

  /**
   * Toggle active status
   */
  async toggleActive(speciesId, isActive) {
    const result = await pool.query(
      `UPDATE species_ref 
       SET is_active = $1, updated_at = NOW()
       WHERE species_id = $2
       RETURNING *`,
      [isActive, speciesId]
    );

    if (result.rows.length === 0) {
      throw new Error('Species not found');
    }

    return result.rows[0];
  }
}

module.exports = new SpeciesService();
