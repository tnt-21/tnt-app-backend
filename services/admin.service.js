// ============================================
// FILE: services/admin.service.js
// Admin Service Layer
// ============================================

const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../utils/response.util');

class AdminService {
  
  // ==================== CAREGIVER MANAGEMENT ====================

  /**
   * Create a new user with caregiver role and profile
   */
  async createCaregiver(data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        phone, email, full_name, date_of_birth, profile_photo_url, // User data
        ...caregiverData // Caregiver profile data
      } = data;

      // 1. Check if user already exists
      const userCheck = await client.query(
        'SELECT user_id FROM users WHERE phone = $1 OR email = $2',
        [phone, email]
      );

      if (userCheck.rows.length > 0) {
        throw new AppError('User with this phone or email already exists', 409, 'USER_EXISTS');
      }

      // 2. Get Caregiver Role ID
      const roleResult = await client.query(
        "SELECT role_id FROM user_roles_ref WHERE role_code = 'caregiver'"
      );
      
      if (roleResult.rows.length === 0) {
        throw new AppError('Caregiver role not defined in system', 500, 'ROLE_NOT_FOUND');
      }
      
      const roleId = roleResult.rows[0].role_id;

      // 3. Create User
      const userId = uuidv4();
      await client.query(
        `INSERT INTO users (
          user_id, phone, email, full_name, role_id, 
          profile_photo_url, date_of_birth, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())`,
        [userId, phone, email, full_name, roleId, profile_photo_url, date_of_birth]
      );

      // 4. Create Caregiver Profile
      const caregiverId = uuidv4();
      const {
        address, city, state, pincode, 
        experience_years, 
        service_area_pincodes
      } = caregiverData;

      await client.query(
        `INSERT INTO caregivers (
          caregiver_id, user_id, full_name, phone, email, status,
          address, city, state, pincode,
          experience_years, service_area_pincodes,
          average_rating,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, 'onboarding', $6, $7, $8, $9, $10, $11, 5.0, NOW())`,
        [
          caregiverId, userId, full_name, phone, email,
          address || null, city || null, state || null, pincode || null,
          experience_years || 0, 
          service_area_pincodes ? JSON.stringify(service_area_pincodes) : '[]'
        ]
      );

      await client.query('COMMIT');

      return {
        user_id: userId,
        caregiver_id: caregiverId,
        full_name,
        email,
        phone,
        role: 'caregiver',
        status: 'active' // User status
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Promote an existing user to caregiver
   */
  async promoteToCaregiver(userId, data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Verify User Exists
      const userResult = await client.query(
        'SELECT * FROM users WHERE user_id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const user = userResult.rows[0];

      // 2. Get Caregiver Role ID
      const roleResult = await client.query(
        "SELECT role_id FROM user_roles_ref WHERE role_code = 'caregiver'"
      );
      const caregiverRoleId = roleResult.rows[0].role_id;

      // 3. Check if already a caregiver or has conflicting role?
      // For now, we allow overwriting role, but we should check if they already have a caregiver profile.
      const profileCheck = await client.query(
        'SELECT caregiver_id FROM caregivers WHERE user_id = $1',
        [userId]
      );

      if (profileCheck.rows.length > 0) {
        throw new AppError('User already has a caregiver profile', 409, 'PROFILE_EXISTS');
      }

      // 4. Update User Role
      await client.query(
        'UPDATE users SET role_id = $1, updated_at = NOW() WHERE user_id = $2',
        [caregiverRoleId, userId]
      );

      // 5. Create Caregiver Profile
      const caregiverId = uuidv4();
      const {
        address, city, state, pincode, 
        experience_years, 
        service_area_pincodes
      } = data;

      await client.query(
        `INSERT INTO caregivers (
          caregiver_id, user_id, full_name, phone, email, status,
          address, city, state, pincode,
          experience_years, service_area_pincodes,
          average_rating,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, 'onboarding', $6, $7, $8, $9, $10, $11, 5.0, NOW())`,
        [
          caregiverId, userId, user.full_name, user.phone, user.email,
          address || null, city || null, state || null, pincode || null,
          experience_years || 0, 
          service_area_pincodes ? JSON.stringify(service_area_pincodes) : '[]'
        ]
      );

      await client.query('COMMIT');

      return {
        user_id: userId,
        caregiver_id: caregiverId,
        message: 'User promoted to caregiver successfully'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all caregivers with pagination and filtering
   */
  async getAllCaregivers(filters) {
    const { page = 1, limit = 20, status, search, city, verified } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        c.*, 
        u.full_name, u.email, u.phone, u.profile_photo_url, u.status as user_status
      FROM caregivers c
      JOIN users u ON c.user_id = u.user_id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (status) {
      query += ` AND c.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (city) {
      query += ` AND c.city ILIKE $${paramCount}`;
      values.push(`%${city}%`);
      paramCount++;
    }

    if (search) {
      query += ` AND (u.full_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.phone ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Count
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM caregivers c
      JOIN users u ON c.user_id = u.user_id
      WHERE 1=1
    `;
    const countValues = values.slice(0, paramCount - 1); // remove limit/offset

    // Reconstruct count query filters (simplified)
    if (status) countQuery += ` AND c.status = $1`;
    if (verified !== undefined) countQuery += ` AND c.is_verified = $${status ? 2 : 1}`;
    // ... complete logic for count query construction would mirror main query ... 
    // For brevity/robustness in this snippet, let's just reuse the generic approach or do a separate count calc properly
    // Retrying clean count logic:
    
    let countWhere = 'WHERE 1=1';
    let countVals = [];
    let cParam = 1;

    if (status) { countWhere += ` AND c.status = $${cParam}`; countVals.push(status); cParam++; }
    if (city) { countWhere += ` AND c.city ILIKE $${cParam}`; countVals.push(`%${city}%`); cParam++; }
    if (search) { countWhere += ` AND (u.full_name ILIKE $${cParam} OR u.email ILIKE $${cParam} OR u.phone ILIKE $${cParam})`; countVals.push(`%${search}%`); cParam++; }

    const finalCountQuery = `SELECT COUNT(*) as total FROM caregivers c JOIN users u ON c.user_id = u.user_id ${countWhere}`;
    const countResult = await pool.query(finalCountQuery, countVals);

    return {
      caregivers: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    };
  }

  /**
   * Get caregiver details by ID
   */
  async getCaregiverById(caregiverId) {
    const query = `
      SELECT 
        c.*, 
        u.full_name, u.email, u.phone, u.profile_photo_url, u.status as user_status, u.date_of_birth
      FROM caregivers c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.caregiver_id = $1
    `;
    
    const result = await pool.query(query, [caregiverId]);

    if (result.rows.length === 0) {
      throw new AppError('Caregiver not found', 404, 'CAREGIVER_NOT_FOUND');
    }

    return result.rows[0];
  }

  /**
   * Update caregiver profile
   */
  async updateCaregiver(caregiverId, data) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'status', 'address', 'city', 'state', 'pincode',
      'experience_years', 'average_rating', 'service_area_pincodes',
      'bank_account_number', 'ifsc_code'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(typeof data[field] === 'object' ? JSON.stringify(data[field]) : data[field]);
        paramCount++;
      }
    });

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(caregiverId);

      const query = `
        UPDATE caregivers 
        SET ${updates.join(', ')} 
        WHERE caregiver_id = $${paramCount} 
        RETURNING *
      `;
      
      const result = await pool.query(query, values);
      return result.rows[0];
    }
    
    return null;
  }

  /**
   * Delete (Soft) Caregiver
   */
  async deleteCaregiver(caregiverId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get User ID
      const res = await client.query('SELECT user_id FROM caregivers WHERE caregiver_id = $1', [caregiverId]);
      if (res.rows.length === 0) throw new AppError('Caregiver not found', 404, 'NOT_FOUND');
      const userId = res.rows[0].user_id;

      // 2. Mark Caregiver as terminated
      await client.query(`UPDATE caregivers SET status = 'terminated' WHERE caregiver_id = $1`, [caregiverId]);

      // 3. Optional: Mark User as inactive or just remove role? 
      // Admin decision - usually we keep the user but maybe disable login if "Delete" is implied.
      // Let's set user status to suspended for safety or just leave it. 
      // User requested "delete", let's assume soft delete of the entity.
      
      await client.query('COMMIT');
      return { message: 'Caregiver marked as terminated' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== CARE MANAGER MANAGEMENT ====================

  /**
   * Create a new user with care manager role and profile
   */
  async createCareManager(data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        phone, email, full_name, date_of_birth, profile_photo_url, // User data
        ...managerData // Care Manager profile data
      } = data;

      // 1. Check if user already exists
      const userCheck = await client.query(
        'SELECT user_id FROM users WHERE phone = $1 OR email = $2',
        [phone, email]
      );

      if (userCheck.rows.length > 0) {
        throw new AppError('User with this phone or email already exists', 409, 'USER_EXISTS');
      }

      // 2. Get Care Manager Role ID
      const roleResult = await client.query(
        "SELECT role_id FROM user_roles_ref WHERE role_code = 'care_manager'"
      );
      
      if (roleResult.rows.length === 0) {
        throw new AppError('Care Manager role not defined in system', 500, 'ROLE_NOT_FOUND');
      }
      
      const roleId = roleResult.rows[0].role_id;

      // 3. Create User
      const userId = uuidv4();
      await client.query(
        `INSERT INTO users (
          user_id, phone, email, full_name, role_id, 
          profile_photo_url, date_of_birth, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())`,
        [userId, phone, email, full_name, roleId, profile_photo_url, date_of_birth]
      );

      // 4. Create Care Manager Profile
      const careManagerId = uuidv4();
      const {
        specialization, qualifications, experience_years, 
        max_pets, languages_spoken
      } = managerData;

      await client.query(
        `INSERT INTO care_managers (
          care_manager_id, user_id, full_name, phone, email, photo_url,
          specialization, qualifications, experience_years,
          max_pets, languages_spoken, status, joined_date, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', NOW(), NOW())`,
        [
          careManagerId, userId, 
          full_name, phone, email, profile_photo_url || null,
          specialization || null, 
          qualifications || null, 
          experience_years || 0,
          max_pets || 50,
          languages_spoken ? JSON.stringify(languages_spoken) : '[]'
        ]
      );

      await client.query('COMMIT');

      return {
        user_id: userId,
        care_manager_id: careManagerId,
        full_name,
        role: 'care_manager',
        status: 'active'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Promote an existing user to care manager
   */
  async promoteToCareManager(userId, data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Verify User Exists and get details
      const userResult = await client.query(
        'SELECT * FROM users WHERE user_id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const user = userResult.rows[0];

      // 2. Get Care Manager Role ID
      const roleResult = await client.query(
        "SELECT role_id FROM user_roles_ref WHERE role_code = 'care_manager'"
      );
      const managerRoleId = roleResult.rows[0].role_id;

      // 3. Check if already has profile
      const profileCheck = await client.query(
        'SELECT care_manager_id FROM care_managers WHERE user_id = $1',
        [userId]
      );

      if (profileCheck.rows.length > 0) {
        throw new AppError('User already has a care manager profile', 409, 'PROFILE_EXISTS');
      }

      // 4. Update User Role
      await client.query(
        'UPDATE users SET role_id = $1, updated_at = NOW() WHERE user_id = $2',
        [managerRoleId, userId]
      );

      // 5. Create Care Manager Profile
      const careManagerId = uuidv4();
      const {
        specialization, qualifications, experience_years, 
        max_pets, languages_spoken
      } = data;

      await client.query(
        `INSERT INTO care_managers (
          care_manager_id, user_id, full_name, phone, email, photo_url,
          specialization, qualifications, experience_years,
          max_pets, languages_spoken, status, joined_date, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', NOW(), NOW())`,
        [
          careManagerId, userId, 
          user.full_name, user.phone, user.email, user.profile_photo_url,
          specialization || null, 
          qualifications || null, 
          experience_years || 0,
          max_pets || 50,
          languages_spoken ? JSON.stringify(languages_spoken) : '[]'
        ]
      );

      await client.query('COMMIT');

      return {
        user_id: userId,
        care_manager_id: careManagerId,
        message: 'User promoted to care manager successfully'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all care managers with pagination and filtering
   */
  async getAllCareManagers(filters) {
    const { page = 1, limit = 20, status, search } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT * FROM care_managers
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (status) {
      query += ` AND status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (search) {
      query += ` AND (full_name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Count
    let countWhere = 'WHERE 1=1';
    let countVals = [];
    let cParam = 1;

    if (status) { countWhere += ` AND status = $${cParam}`; countVals.push(status); cParam++; }
    if (search) { countWhere += ` AND (full_name ILIKE $${cParam} OR email ILIKE $${cParam} OR phone ILIKE $${cParam})`; countVals.push(`%${search}%`); cParam++; }
    
    const countQuery = `SELECT COUNT(*) as total FROM care_managers ${countWhere}`;
    const countResult = await pool.query(countQuery, countVals);

    return {
      careManagers: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    };
  }

  /**
   * Get care manager details
   */
  async getCareManagerById(id) {
    const result = await pool.query('SELECT * FROM care_managers WHERE care_manager_id = $1', [id]);
    if (result.rows.length === 0) throw new AppError('Care Manager not found', 404, 'NOT_FOUND');
    return result.rows[0];
  }

  /**
   * Update care manager profile
   */
  async updateCareManager(id, data) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'full_name', 'email', 'phone', 'photo_url', 'specialization',
      'qualifications', 'experience_years', 'max_pets', 'languages_spoken', 'status'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(typeof data[field] === 'object' ? JSON.stringify(data[field]) : data[field]);
        paramCount++;
      }
    });

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(id);
      const query = `UPDATE care_managers SET ${updates.join(', ')} WHERE care_manager_id = $${paramCount} RETURNING *`;
      const result = await pool.query(query, values);
      return result.rows[0];
    }
    return null;
  }

  /**
   * Delete (Soft) Care Manager
   */
  async deleteCareManager(id) {
    await pool.query("UPDATE care_managers SET status = 'terminated' WHERE care_manager_id = $1", [id]);
    return { message: 'Care Manager marked as terminated' };
  }
}

module.exports = new AdminService();
