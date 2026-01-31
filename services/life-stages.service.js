const { pool } = require('../config/database');

class LifeStagesService {
  /**
   * Get all life stages, optionally filtered by species
   */
  async getAll(speciesId = null) {
    let query = `
      SELECT ls.*, s.species_name 
      FROM life_stages_ref ls
      JOIN species_ref s ON ls.species_id = s.species_id
    `;
    const params = [];

    if (speciesId) {
      query += ` WHERE ls.species_id = $1`;
      params.push(speciesId);
    }

    query += ` ORDER BY s.species_name ASC, ls.min_age_months ASC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get life stage by ID
   */
  async getById(id) {
    const result = await pool.query(
      `SELECT ls.*, s.species_name 
       FROM life_stages_ref ls
       JOIN species_ref s ON ls.species_id = s.species_id
       WHERE ls.life_stage_id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Life stage not found');
    }
    
    return result.rows[0];
  }

  /**
   * Create new life stage
   */
  async create(data) {
    const { species_id, life_stage_code, life_stage_name, min_age_months, max_age_months, description, is_active = true } = data;

    // Check if code already exists
    const existing = await pool.query(
      'SELECT life_stage_id FROM life_stages_ref WHERE life_stage_code = $1',
      [life_stage_code]
    );

    if (existing.rows.length > 0) {
      throw new Error('Life stage code already exists');
    }

    const result = await pool.query(
      `INSERT INTO life_stages_ref 
       (species_id, life_stage_code, life_stage_name, min_age_months, max_age_months, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [species_id, life_stage_code, life_stage_name, min_age_months || null, max_age_months || null, description || null, is_active]
    );

    return result.rows[0];
  }

  /**
   * Update life stage
   */
  async update(id, data) {
    const { species_id, life_stage_code, life_stage_name, min_age_months, max_age_months, description, is_active } = data;

    // Check if exists
    await this.getById(id);

    // Check code conflict
    if (life_stage_code) {
      const existing = await pool.query(
        'SELECT life_stage_id FROM life_stages_ref WHERE life_stage_code = $1 AND life_stage_id != $2',
        [life_stage_code, id]
      );

      if (existing.rows.length > 0) {
        throw new Error('Life stage code already exists');
      }
    }

    const result = await pool.query(
      `UPDATE life_stages_ref 
       SET species_id = COALESCE($1, species_id),
           life_stage_code = COALESCE($2, life_stage_code),
           life_stage_name = COALESCE($3, life_stage_name),
           min_age_months = $4,
           max_age_months = $5,
           description = COALESCE($6, description),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE life_stage_id = $8
       RETURNING *`,
      [species_id, life_stage_code, life_stage_name, min_age_months, max_age_months, description, is_active, id]
    );

    return result.rows[0];
  }

  /**
   * Delete life stage
   */
  async delete(id) {
    await this.getById(id);

    // Check if in use (pets table)
    const pets = await pool.query(
      'SELECT COUNT(*) FROM pets WHERE life_stage_id = $1',
      [id]
    );

    if (parseInt(pets.rows[0].count) > 0) {
      throw new Error('Cannot delete life stage as it is assigned to one or more pets');
    }

    await pool.query('DELETE FROM life_stages_ref WHERE life_stage_id = $1', [id]);
    return { success: true, message: 'Life stage deleted successfully' };
  }

  /**
   * Toggle active status
   */
  async toggleActive(id, isActive) {
    const result = await pool.query(
      `UPDATE life_stages_ref 
       SET is_active = $1, updated_at = NOW()
       WHERE life_stage_id = $2
       RETURNING *`,
      [isActive, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Life stage not found');
    }

    return result.rows[0];
  }
}

module.exports = new LifeStagesService();
