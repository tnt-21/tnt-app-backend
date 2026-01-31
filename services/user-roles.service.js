const { pool } = require('../config/database');

class UserRolesService {
  /**
   * Get all user roles
   */
  async getAll() {
    const query = `
      SELECT * FROM user_roles_ref
      ORDER BY role_id ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get role by ID
   */
  async getById(id) {
    const result = await pool.query(
      'SELECT * FROM user_roles_ref WHERE role_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User role not found');
    }
    
    return result.rows[0];
  }

  /**
   * Create new role
   */
  async create(data) {
    const { 
      role_code, 
      role_name, 
      permissions = {}, 
      is_active = true 
    } = data;

    // Check if code already exists
    const existing = await pool.query(
      'SELECT role_id FROM user_roles_ref WHERE role_code = $1',
      [role_code]
    );

    if (existing.rows.length > 0) {
      throw new Error('Role code already exists');
    }

    const result = await pool.query(
      `INSERT INTO user_roles_ref 
       (role_code, role_name, permissions, is_active, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [
        role_code, 
        role_name, 
        JSON.stringify(permissions), 
        is_active
      ]
    );

    return result.rows[0];
  }

  /**
   * Update role
   */
  async update(id, data) {
    const { 
      role_code, 
      role_name, 
      permissions, 
      is_active 
    } = data;

    // Check if exists
    await this.getById(id);

    // Check code conflict
    if (role_code) {
      const existing = await pool.query(
        'SELECT role_id FROM user_roles_ref WHERE role_code = $1 AND role_id != $2',
        [role_code, id]
      );

      if (existing.rows.length > 0) {
        throw new Error('Role code already exists');
      }
    }

    const result = await pool.query(
      `UPDATE user_roles_ref 
       SET role_code = COALESCE($1, role_code),
           role_name = COALESCE($2, role_name),
           permissions = COALESCE($3, permissions::json),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE role_id = $5
       RETURNING *`,
      [
        role_code, 
        role_name, 
        permissions ? JSON.stringify(permissions) : null, 
        is_active, 
        id
      ]
    );

    return result.rows[0];
  }

  /**
   * Delete role
   */
  async delete(id) {
    const role = await this.getById(id);

    // Check if being used by any users
    const users = await pool.query(
      'SELECT COUNT(*) FROM users WHERE role = $1',
      [role.role_code]
    );

    if (parseInt(users.rows[0].count) > 0) {
      throw new Error('Cannot delete role as it is assigned to one or more users');
    }

    await pool.query('DELETE FROM user_roles_ref WHERE role_id = $1', [id]);
    return { success: true, message: 'User role deleted successfully' };
  }

  /**
   * Toggle active status
   */
  async toggleActive(id, isActive) {
    const result = await pool.query(
      `UPDATE user_roles_ref 
       SET is_active = $1, updated_at = NOW()
       WHERE role_id = $2
       RETURNING *`,
      [isActive, id]
    );

    if (result.rows.length === 0) {
      throw new Error('User role not found');
    }

    return result.rows[0];
  }
}

module.exports = new UserRolesService();
