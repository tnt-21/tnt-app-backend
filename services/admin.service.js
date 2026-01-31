// ============================================
// FILE: services/admin.service.js
// Admin Service Layer
// ============================================

const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../utils/response.util');
const attachmentService = require('./attachment.service');

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

      if (profile_photo_url) {
        await attachmentService.markPermanent(profile_photo_url);
      }

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

      if (data.profile_photo_url) {
        await attachmentService.markPermanent(data.profile_photo_url);
      }

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

      if (profile_photo_url) {
        await attachmentService.markPermanent(profile_photo_url);
      }

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

      if (user.profile_photo_url) {
        await attachmentService.markPermanent(user.profile_photo_url);
      }

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

  // ==================== CARE MANAGER ASSIGNMENTS ====================

  /**
   * Assign a pet to a care manager
   */
  async assignPetToCareManager(managerId, subscriptionId, petId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Check if manager exists and has capacity
      const managerResult = await client.query(
        'SELECT current_pets_count, max_pets FROM care_managers WHERE care_manager_id = $1 AND status = $2',
        [managerId, 'active']
      );

      if (managerResult.rows.length === 0) {
        throw new AppError('Active Care Manager not found', 404, 'MANAGER_NOT_FOUND');
      }

      const manager = managerResult.rows[0];
      if (manager.current_pets_count >= manager.max_pets) {
        throw new AppError('Care Manager is at maximum capacity', 400, 'MAX_CAPACITY_REACHED');
      }

      // 2. Check if assignment already exists for this subscription
      const existingAssignment = await client.query(
        'SELECT assignment_id FROM care_manager_assignments WHERE subscription_id = $1 AND is_active = true',
        [subscriptionId]
      );

      if (existingAssignment.rows.length > 0) {
        throw new AppError('This subscription already has an active care manager', 400, 'ALREADY_ASSIGNED');
      }

      // 3. Create assignment
      const assignmentId = uuidv4();
      const assignmentResult = await client.query(
        `INSERT INTO care_manager_assignments (
          assignment_id, care_manager_id, subscription_id, pet_id, user_id, 
          assignment_date, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, true, NOW())
        RETURNING *`,
        [assignmentId, managerId, subscriptionId, petId, userId]
      );

      // 4. Update manager's count
      await client.query(
        'UPDATE care_managers SET current_pets_count = current_pets_count + 1 WHERE care_manager_id = $1',
        [managerId]
      );

      await client.query('COMMIT');
      return assignmentResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Unassign a pet from a care manager
   */
  async unassignPet(assignmentId, reason) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get assignment details
      const assignmentResult = await client.query(
        'SELECT care_manager_id, is_active FROM care_manager_assignments WHERE assignment_id = $1',
        [assignmentId]
      );

      if (assignmentResult.rows.length === 0) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      if (!assignmentResult.rows[0].is_active) {
        throw new AppError('Assignment is already inactive', 400, 'ALREADY_INACTIVE');
      }

      const managerId = assignmentResult.rows[0].care_manager_id;

      // 2. Mark assignment as inactive
      const updatedAssignment = await client.query(
        `UPDATE care_manager_assignments 
         SET is_active = false, unassigned_date = CURRENT_DATE, unassignment_reason = $1 
         WHERE assignment_id = $2 
         RETURNING *`,
        [reason, assignmentId]
      );

      // 3. Decrement manager's count
      await client.query(
        'UPDATE care_managers SET current_pets_count = GREATEST(0, current_pets_count - 1) WHERE care_manager_id = $1',
        [managerId]
      );

      await client.query('COMMIT');
      return updatedAssignment.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get assignments for a care manager
   */
  async getCareManagerAssignments(managerId) {
    const query = `
      SELECT 
        a.*, 
        p.name as pet_name, p.photo_url as pet_photo,
        u.full_name as owner_name, u.email as owner_email, u.phone as owner_phone,
        s.tier_id
      FROM care_manager_assignments a
      JOIN pets p ON a.pet_id = p.pet_id
      JOIN users u ON a.user_id = u.user_id
      JOIN subscriptions s ON a.subscription_id = s.subscription_id
      WHERE a.care_manager_id = $1 AND a.is_active = true
      ORDER BY a.assignment_date DESC
    `;
    const result = await pool.query(query, [managerId]);
    return result.rows;
  }

  // ==================== CARE MANAGER INTERACTIONS ====================

  /**
   * Add an interaction log
   */
  async addInteraction(assignmentId, userId, data) {
    const { interaction_type, duration_minutes, summary, action_items, next_follow_up_date } = data;
    
    const query = `
      INSERT INTO care_manager_interactions (
        interaction_id, assignment_id, interaction_type, interaction_date, 
        duration_minutes, summary, action_items, next_follow_up_date, created_by
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    // Update last_check_in_date in assignment
    await pool.query(
      'UPDATE care_manager_assignments SET last_check_in_date = CURRENT_DATE WHERE assignment_id = $1',
      [assignmentId]
    );

    const result = await pool.query(query, [
      uuidv4(), assignmentId, interaction_type, duration_minutes, 
      summary, JSON.stringify(action_items || []), next_follow_up_date || null, userId
    ]);
    
    return result.rows[0];
  }

  /**
   * Get interaction history for an assignment
   */
  async getInteractionHistory(assignmentId) {
    const query = `
      SELECT i.*, u.full_name as created_by_name
      FROM care_manager_interactions i
      JOIN users u ON i.created_by = u.user_id
      WHERE i.assignment_id = $1
      ORDER BY i.interaction_date DESC
    `;
    const result = await pool.query(query, [assignmentId]);
    return result.rows;
  }

  // ==================== CUSTOMER MANAGEMENT ====================

  /**
   * Get all customers with pagination and filtering
   */
  async getAllCustomers(filters) {
    const { page = 1, limit = 20, status, search } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        u.*, 
        (SELECT COUNT(*) FROM pets p WHERE p.owner_id = u.user_id AND p.is_active = true) as pet_count,
        (SELECT s.status FROM subscriptions s WHERE s.user_id = u.user_id AND s.status = 'active' LIMIT 1) as subscription_status
      FROM users u
      JOIN user_roles_ref r ON u.role_id = r.role_id
      WHERE r.role_code = 'customer' AND u.status != 'deleted'
    `;

    const values = [];
    let paramCount = 1;

    if (status) {
      query += ` AND u.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (search) {
      query += ` AND (u.full_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.phone ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Count
    let countWhere = "WHERE r.role_code = 'customer' AND u.status != 'deleted'";
    let countVals = [];
    let cParam = 1;

    if (status) { countWhere += ` AND u.status = $${cParam}`; countVals.push(status); cParam++; }
    if (search) { countWhere += ` AND (u.full_name ILIKE $${cParam} OR u.email ILIKE $${cParam} OR u.phone ILIKE $${cParam})`; countVals.push(`%${search}%`); cParam++; }

    const countQuery = `SELECT COUNT(*) as total FROM users u JOIN user_roles_ref r ON u.role_id = r.role_id ${countWhere}`;
    const countResult = await pool.query(countQuery, countVals);

    return {
      customers: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    };
  }

  /**
   * Get customer details by ID
   */
  async getCustomerById(customerId) {
    const query = `
      SELECT 
        u.*, 
        r.role_name,
        (SELECT COUNT(*) FROM pets p WHERE p.owner_id = u.user_id AND p.is_active = true) as pet_count
      FROM users u
      JOIN user_roles_ref r ON u.role_id = r.role_id
      WHERE u.user_id = $1 AND u.status != 'deleted'
    `;
    
    const result = await pool.query(query, [customerId]);

    if (result.rows.length === 0) {
      throw new AppError('Customer not found', 404, 'NOT_FOUND');
    }

    const customer = result.rows[0];

    // Get pets
    const petsQuery = `
      SELECT p.*, s.species_name, ls.life_stage_name
      FROM pets p
      LEFT JOIN species_ref s ON p.species_id = s.species_id
      LEFT JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
      WHERE p.owner_id = $1 AND p.is_active = true
    `;
    const petsResult = await pool.query(petsQuery, [customerId]);
    customer.pets = petsResult.rows;

    // Get active subscriptions
    const subsQuery = `
      SELECT s.*, t.tier_name
      FROM subscriptions s
      JOIN subscription_tiers t ON s.tier_id = t.tier_id
      WHERE s.user_id = $1 ORDER BY s.created_at DESC
    `;
    const subsResult = await pool.query(subsQuery, [customerId]);
    customer.subscriptions = subsResult.rows;

    return customer;
  }

  // ==================== PET MANAGEMENT (GLOBAL) ====================

  /**
   * Get all pets system-wide
   */
  async getAllPetsGlobal(filters) {
    const { page = 1, limit = 20, species_id, search } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        p.*, 
        u.full_name as owner_name, u.phone as owner_phone,
        s.species_name, 
        ls.life_stage_name
      FROM pets p
      JOIN users u ON p.owner_id = u.user_id
      LEFT JOIN species_ref s ON p.species_id = s.species_id
      LEFT JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
      WHERE p.is_active = true
    `;

    const values = [];
    let paramCount = 1;

    if (species_id) {
      query += ` AND p.species_id = $${paramCount}`;
      values.push(species_id);
      paramCount++;
    }

    if (search) {
      query += ` AND (p.name ILIKE $${paramCount} OR p.microchip_id ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Count
    let countWhere = "WHERE p.is_active = true";
    let countVals = [];
    let cParam = 1;

    if (species_id) { countWhere += ` AND p.species_id = $${cParam}`; countVals.push(species_id); cParam++; }
    if (search) { countWhere += ` AND (p.name ILIKE $${cParam} OR p.microchip_id ILIKE $${cParam} OR u.full_name ILIKE $${cParam})`; countVals.push(`%${search}%`); cParam++; }

    const countQuery = `SELECT COUNT(*) as total FROM pets p JOIN users u ON p.owner_id = u.user_id ${countWhere}`;
    const countResult = await pool.query(countQuery, countVals);

    return {
      pets: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    };
  }

  /**
   * Get pet details system-wide
   */
  async getPetByIdGlobal(petId) {
    const query = `
      SELECT 
        p.*, 
        u.full_name as owner_name, u.phone as owner_phone, u.email as owner_email,
        s.species_name, 
        ls.life_stage_name
      FROM pets p
      JOIN users u ON p.owner_id = u.user_id
      LEFT JOIN species_ref s ON p.species_id = s.species_id
      LEFT JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
      WHERE p.pet_id = $1
    `;
    
    const result = await pool.query(query, [petId]);

    if (result.rows.length === 0) {
      throw new AppError('Pet not found', 404, 'NOT_FOUND');
    }

    const pet = result.rows[0];

    // Health records count
    const healthResult = await pool.query('SELECT COUNT(*) as count FROM health_records WHERE pet_id = $1', [petId]);
    pet.health_records_count = parseInt(healthResult.rows[0].count);

    return pet;
  }

  /**
   * Get all Eternal subscriptions that don't have an active care manager assignment
   */
  async getUnassignedEternalSubscriptions() {
    const query = `
      SELECT 
        s.subscription_id, s.user_id, s.pet_id,
        u.full_name as owner_name, u.phone as owner_phone,
        p.name as pet_name, p.species_id, p.breed,
        tr.tier_name
      FROM subscriptions s
      JOIN users u ON s.user_id = u.user_id
      JOIN pets p ON s.pet_id = p.pet_id
      JOIN subscription_tiers_ref tr ON s.tier_id = tr.tier_id
      LEFT JOIN care_manager_assignments cma ON s.subscription_id = cma.subscription_id AND cma.is_active = true
      WHERE tr.tier_name = 'Eternal' 
      AND s.status = 'active'
      AND cma.assignment_id IS NULL
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get all bookings across the platform with pagination and filtering
   */
  async getAllBookingsGlobal(filters) {
    const { page = 1, limit = 20, status, service_id, from_date, to_date, search, pet_id, user_id } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        b.*,
        sc.service_name,
        scr.category_name,
        p.name as pet_name,
        u.full_name as owner_name, u.phone as owner_phone,
        bs.status_name, bs.status_code, bs.display_color as status_color,
        c.full_name as caregiver_name
      FROM bookings b
      JOIN service_catalog sc ON b.service_id = sc.service_id
      JOIN service_categories_ref scr ON sc.category_id = scr.category_id
      JOIN pets p ON b.pet_id = p.pet_id
      JOIN users u ON b.user_id = u.user_id
      JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
      LEFT JOIN assignments a ON b.booking_id = a.booking_id
      LEFT JOIN caregivers c ON a.caregiver_id = c.caregiver_id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (status) {
      query += ` AND (bs.status_code = $${paramCount} OR bs.status_id::text = $${paramCount})`;
      values.push(status);
      paramCount++;
    }

    if (service_id) {
      query += ` AND b.service_id = $${paramCount}`;
      values.push(service_id);
      paramCount++;
    }

    if (pet_id) {
      query += ` AND b.pet_id = $${paramCount}`;
      values.push(pet_id);
      paramCount++;
    }

    if (user_id) {
      query += ` AND b.user_id = $${paramCount}`;
      values.push(user_id);
      paramCount++;
    }

    if (from_date) {
      query += ` AND b.booking_date >= $${paramCount}`;
      values.push(from_date);
      paramCount++;
    }

    if (to_date) {
      query += ` AND b.booking_date <= $${paramCount}`;
      values.push(to_date);
      paramCount++;
    }

    if (search) {
      query += ` AND (b.booking_number ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount} OR p.name ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY b.booking_date DESC, b.booking_time DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Count query
    let countWhere = 'WHERE 1=1';
    let countVals = [];
    let cParam = 1;

    if (status) { countWhere += ` AND (bs.status_code = $${cParam} OR bs.status_id::text = $${cParam})`; countVals.push(status); cParam++; }
    if (service_id) { countWhere += ` AND b.service_id = $${cParam}`; countVals.push(service_id); cParam++; }
    if (pet_id) { countWhere += ` AND b.pet_id = $${cParam}`; countVals.push(pet_id); cParam++; }
    if (user_id) { countWhere += ` AND b.user_id = $${cParam}`; countVals.push(user_id); cParam++; }
    if (from_date) { countWhere += ` AND b.booking_date >= $${cParam}`; countVals.push(from_date); cParam++; }
    if (to_date) { countWhere += ` AND b.booking_date <= $${cParam}`; countVals.push(to_date); cParam++; }
    if (search) { countWhere += ` AND (b.booking_number ILIKE $${cParam} OR u.full_name ILIKE $${cParam} OR p.name ILIKE $${cParam})`; countVals.push(`%${search}%`); cParam++; }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM bookings b 
      JOIN users u ON b.user_id = u.user_id 
      JOIN pets p ON b.pet_id = p.pet_id
      JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
      ${countWhere}
    `;
    const countResult = await pool.query(countQuery, countVals);

    return {
      bookings: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    };
  }

  /**
   * Get detailed booking info for admin
   */
  async getBookingByIdGlobal(bookingId) {
    const query = `
      SELECT 
        b.*,
        sc.service_name, sc.description as service_description,
        scr.category_name,
        p.name as pet_name, p.photo_url as pet_photo,
        u.full_name as owner_name, u.email as owner_email, u.phone as owner_phone,
        bs.status_name, bs.status_code, bs.display_color as status_color,
        lt.type_name as location_type_name,
        ua.address_line1, ua.address_line2, ua.city, ua.state, ua.pincode,
        c.full_name as caregiver_name, c.phone as caregiver_phone
      FROM bookings b
      JOIN service_catalog sc ON b.service_id = sc.service_id
      JOIN service_categories_ref scr ON sc.category_id = scr.category_id
      JOIN pets p ON b.pet_id = p.pet_id
      JOIN users u ON b.user_id = u.user_id
      JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
      LEFT JOIN location_types_ref lt ON b.location_type_id = lt.location_type_id
      LEFT JOIN user_addresses ua ON b.address_id = ua.address_id
      LEFT JOIN assignments a ON b.booking_id = a.booking_id
      LEFT JOIN caregivers c ON a.caregiver_id = c.caregiver_id
      WHERE b.booking_id = $1
    `;
    
    const result = await pool.query(query, [bookingId]);

    if (result.rows.length === 0) {
      throw new AppError('Booking not found', 404, 'NOT_FOUND');
    }

    const booking = result.rows[0];

    // Get status history
    const historyQuery = `
      SELECT h.*, u.full_name as changed_by_name
      FROM booking_status_history h
      JOIN users u ON h.changed_by = u.user_id
      WHERE h.booking_id = $1
      ORDER BY h.created_at DESC
    `;
    const historyResult = await pool.query(historyQuery, [bookingId]);
    booking.status_history = historyResult.rows;

    // Get addons
    const addonsQuery = `SELECT * FROM booking_addons WHERE booking_id = $1`;
    const addonsResult = await pool.query(addonsQuery, [bookingId]);
    booking.addons = addonsResult.rows;

    return booking;
  }

  /**
   * Update booking status as admin
   */
  async updateBookingStatus(bookingId, statusId, adminId, reason) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get current booking
      const current = await client.query('SELECT status_id FROM bookings WHERE booking_id = $1', [bookingId]);
      if (current.rows.length === 0) throw new AppError('Booking not found', 404, 'NOT_FOUND');
      
      const oldStatusId = current.rows[0].status_id;

      // 2. Update status
      await client.query(
        'UPDATE bookings SET status_id = $1, updated_at = NOW() WHERE booking_id = $2',
        [statusId, bookingId]
      );

      // 3. Add to history
      await client.query(
        `INSERT INTO booking_status_history (
          booking_id, old_status_id, new_status_id, changed_by, changed_by_role, reason, created_at
        ) VALUES ($1, $2, $3, $4, 'admin', $5, NOW())`,
        [bookingId, oldStatusId, statusId, adminId, reason]
      );

      await client.query('COMMIT');
      return { message: 'Booking status updated successfully' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Manually assign caregiver to a booking
   */
  async assignCaregiver(bookingId, caregiverId, adminId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verify caregiver exists
      const caregiver = await client.query('SELECT full_name FROM caregivers WHERE caregiver_id = $1', [caregiverId]);
      if (caregiver.rows.length === 0) throw new AppError('Caregiver not found', 404, 'NOT_FOUND');

      // 2. Update/Create assignment
      await client.query(
        `INSERT INTO assignments (booking_id, caregiver_id, assigned_by, status, assigned_at)
         VALUES ($1, $2, $3, 'pending', NOW())
         ON CONFLICT (booking_id) DO UPDATE SET 
           caregiver_id = EXCLUDED.caregiver_id,
           assigned_by = EXCLUDED.assigned_by,
           assigned_at = NOW(),
           status = 'pending'`,
        [bookingId, caregiverId, adminId]
      );

      // Update updated_at on booking
      await client.query('UPDATE bookings SET updated_at = NOW() WHERE booking_id = $1', [bookingId]);

      // 3. Optional: Auto-update status to 'confirmed' if currently 'pending'?
      // Let's just log the change for now.
      
      await client.query(
        `INSERT INTO booking_status_history (
          booking_id, changed_by, changed_by_role, notes, created_at
        ) VALUES ($1, $2, 'admin', $3, NOW())`,
        [bookingId, adminId, `Assigned caregiver: ${caregiver.rows[0].full_name}`]
      );

      await client.query('COMMIT');
      return { message: 'Caregiver assigned successfully' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== PAYMENTS & FINANCIALS ====================

  /**
   * Get all invoices across the platform
   */
  async getAllInvoicesGlobal(filters) {
    const { page = 1, limit = 20, status, invoice_type, from_date, to_date, search } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        i.*,
        u.full_name as owner_name, u.email as owner_email
      FROM invoices i
      JOIN users u ON i.user_id = u.user_id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (status) {
      query += ` AND i.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (invoice_type) {
      query += ` AND i.invoice_type = $${paramCount}`;
      values.push(invoice_type);
      paramCount++;
    }

    if (from_date) {
      query += ` AND i.created_at >= $${paramCount}`;
      values.push(from_date);
      paramCount++;
    }

    if (to_date) {
      query += ` AND i.created_at <= $${paramCount}`;
      values.push(to_date);
      paramCount++;
    }

    if (search) {
      query += ` AND (i.invoice_number ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Count query
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM invoices i 
      JOIN users u ON i.user_id = u.user_id 
      WHERE 1=1
    `;
    const countVals = [];
    let cParam = 1;

    if (status) { countQuery += ` AND i.status = $${cParam}`; countVals.push(status); cParam++; }
    if (invoice_type) { countQuery += ` AND i.invoice_type = $${cParam}`; countVals.push(invoice_type); cParam++; }
    if (from_date) { countQuery += ` AND i.created_at >= $${cParam}`; countVals.push(from_date); cParam++; }
    if (to_date) { countQuery += ` AND i.created_at <= $${cParam}`; countVals.push(to_date); cParam++; }
    if (search) { countQuery += ` AND (i.invoice_number ILIKE $${cParam} OR u.full_name ILIKE $${cParam})`; countVals.push(`%${search}%`); cParam++; }

    const countResult = await pool.query(countQuery, countVals);

    return {
      invoices: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    };
  }

  /**
   * Get detailed invoice info
   */
  async getInvoiceByIdGlobal(invoiceId) {
    const query = `
      SELECT 
        i.*,
        u.full_name as owner_name, u.email as owner_email, u.phone as owner_phone
      FROM invoices i
      JOIN users u ON i.user_id = u.user_id
      WHERE i.invoice_id = $1
    `;
    const result = await pool.query(query, [invoiceId]);

    if (result.rows.length === 0) throw new AppError('Invoice not found', 404, 'NOT_FOUND');

    const invoice = result.rows[0];

    // Get line items
    const itemsResult = await pool.query(
      'SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY created_at ASC',
      [invoiceId]
    );
    invoice.line_items = itemsResult.rows;

    // Get payments
    const paymentsResult = await pool.query(
      'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC',
      [invoiceId]
    );
    invoice.payments = paymentsResult.rows;

    return invoice;
  }

  /**
   * Get all payment transactions across the platform
   */
  async getAllPaymentsGlobal(filters) {
    const { page = 1, limit = 20, status, from_date, to_date, search } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        p.*,
        i.invoice_number,
        u.full_name as owner_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.invoice_id
      JOIN users u ON p.user_id = u.user_id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (status) {
      query += ` AND p.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (from_date) {
      query += ` AND p.created_at >= $${paramCount}`;
      values.push(from_date);
      paramCount++;
    }

    if (to_date) {
      query += ` AND p.created_at <= $${paramCount}`;
      values.push(to_date);
      paramCount++;
    }

    if (search) {
      query += ` AND (p.transaction_id ILIKE $${paramCount} OR i.invoice_number ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Count query
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM payments p 
      JOIN invoices i ON p.invoice_id = i.invoice_id
      JOIN users u ON p.user_id = u.user_id
      WHERE 1=1
    `;
    const countVals = [];
    let cParam = 1;

    if (status) { countQuery += ` AND p.status = $${cParam}`; countVals.push(status); cParam++; }
    if (from_date) { countQuery += ` AND p.created_at >= $${cParam}`; countVals.push(from_date); cParam++; }
    if (to_date) { countQuery += ` AND p.created_at <= $${cParam}`; countVals.push(to_date); cParam++; }
    if (search) { countQuery += ` AND (p.transaction_id ILIKE $${cParam} OR i.invoice_number ILIKE $${cParam} OR u.full_name ILIKE $${cParam})`; countVals.push(`%${search}%`); cParam++; }

    const countResult = await pool.query(countQuery, countVals);

    return {
      payments: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    };
  }

  /**
   * Get all refund requests
   */
  async getAllRefundsGlobal(filters) {
    const { page = 1, limit = 20, status, from_date, to_date } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        r.*,
        i.invoice_number,
        u.full_name as owner_name,
        p.amount as original_amount, p.transaction_id as original_transaction_id
      FROM refunds r
      JOIN invoices i ON r.invoice_id = i.invoice_id
      JOIN users u ON r.requested_by = u.user_id
      JOIN payments p ON r.payment_id = p.payment_id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (status) {
      query += ` AND r.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (from_date) {
      query += ` AND r.created_at >= $${paramCount}`;
      values.push(from_date);
      paramCount++;
    }

    if (to_date) {
      query += ` AND r.created_at <= $${paramCount}`;
      values.push(to_date);
      paramCount++;
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM refunds r WHERE 1=1 ${status ? 'AND status = $1' : ''}`;
    const countResult = await pool.query(countQuery, status ? [status] : []);

    return {
      refunds: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    };
  }

  /**
   * Get global financial metrics
   */
  async getFinancialMetricsGlobal() {
    const query = `
      SELECT 
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) as total_revenue,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'pending' OR status = 'overdue'), 0) as outstanding_amount,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COUNT(*) FILTER (WHERE status = 'pending' OR status = 'overdue') as pending_count
      FROM invoices;
    `;
    const result = await pool.query(query);
    return result.rows[0];
  }

  // ==================== COMMUNITY MANAGEMENT ====================

  /**
   * Get all community events with participant metrics
   */
  async getAllEventsGlobal(filters) {
    const { page = 1, limit = 20, status, event_type, search } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        ce.*,
        s.species_name,
        u.full_name as created_by_name,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = ce.event_id AND status != 'cancelled') as actual_participants
      FROM community_events ce
      LEFT JOIN species_ref s ON ce.species_id = s.species_id
      LEFT JOIN users u ON ce.created_by = u.user_id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (status) {
      query += ` AND ce.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (event_type) {
      query += ` AND ce.event_type = $${paramCount}`;
      values.push(event_type);
      paramCount++;
    }

    if (search) {
      query += ` AND (ce.title ILIKE $${paramCount} OR ce.location_name ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY ce.event_date DESC, ce.event_time DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Count query
    let countWhere = 'WHERE 1=1';
    let countVals = [];
    let cParam = 1;
    if (status) { countWhere += ` AND status = $${cParam}`; countVals.push(status); cParam++; }
    if (event_type) { countWhere += ` AND event_type = $${cParam}`; countVals.push(event_type); cParam++; }
    if (search) { countWhere += ` AND (title ILIKE $${cParam} OR location_name ILIKE $${cParam})`; countVals.push(`%${search}%`); cParam++; }

    const countQuery = `SELECT COUNT(*) as total FROM community_events ce ${countWhere}`;
    const countResult = await pool.query(countQuery, countVals);

    return {
      events: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    };
  }

  /**
   * Create a new community event
   */
  async createEvent(eventData, createdBy) {
    const eventId = uuidv4();
    const {
      title, description, detailed_description, event_type,
      species_id, life_stages_allowed, event_date, event_time,
      end_time, duration_minutes, location_name, location_address,
      max_participants, min_participants, is_free, price,
      subscription_tiers_allowed, requirements, what_to_bring,
      banner_image_url, organizer_name, organizer_contact,
      registration_deadline, waitlist_enabled, tags
    } = eventData;

    const query = `
      INSERT INTO community_events (
        event_id, title, description, detailed_description, event_type,
        species_id, life_stages_allowed, event_date, event_time,
        end_time, duration_minutes, location_name, location_address,
        max_participants, min_participants, is_free, price,
        subscription_tiers_allowed, requirements, what_to_bring,
        banner_image_url, organizer_name, organizer_contact,
        status, registration_deadline, waitlist_enabled, tags,
        created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, 'upcoming', $24, $25, $26,
        $27, NOW(), NOW()
      ) RETURNING *
    `;

    const values = [
      eventId, title, description || null, detailed_description || null, event_type || 'socialization',
      species_id || null, life_stages_allowed ? JSON.stringify(life_stages_allowed) : null, event_date, event_time,
      end_time || null, duration_minutes || null, location_name || null, location_address || null,
      max_participants || 20, min_participants || 1, is_free !== undefined ? is_free : true, price || 0,
      subscription_tiers_allowed ? JSON.stringify(subscription_tiers_allowed) : null, requirements || null, what_to_bring || null,
      banner_image_url || null, organizer_name || null, organizer_contact || null,
      registration_deadline || null, waitlist_enabled || false, tags ? JSON.stringify(tags) : null,
      createdBy
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Update an existing community event
   */
  async updateEvent(eventId, eventData) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'title', 'description', 'detailed_description', 'event_type',
      'species_id', 'life_stages_allowed', 'event_date', 'event_time',
      'end_time', 'duration_minutes', 'location_name', 'location_address',
      'max_participants', 'min_participants', 'is_free', 'price',
      'subscription_tiers_allowed', 'requirements', 'what_to_bring',
      'banner_image_url', 'organizer_name', 'organizer_contact',
      'status', 'registration_deadline', 'waitlist_enabled', 'tags'
    ];

    allowedFields.forEach(field => {
      if (eventData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(
          (field === 'life_stages_allowed' || field === 'subscription_tiers_allowed' || field === 'tags') && eventData[field] !== null
            ? JSON.stringify(eventData[field])
            : eventData[field]
        );
        paramCount++;
      }
    });

    if (updates.length === 0) return null;

    updates.push(`updated_at = NOW()`);
    values.push(eventId);

    const query = `
      UPDATE community_events 
      SET ${updates.join(', ')} 
      WHERE event_id = $${paramCount} 
      RETURNING *
    `;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }
    return result.rows[0];
  }

  /**
   * Cancel an event
   */
  async cancelEvent(eventId, reason) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE community_events 
         SET status = 'cancelled', cancellation_reason = $1, updated_at = NOW() 
         WHERE event_id = $2 AND status != 'cancelled'
         RETURNING *`,
        [reason, eventId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Event not found or already cancelled', 404, 'NOT_FOUND');
      }

      // Mark all confirmed registrations as cancelled/refund needed?
      // For now, just mark registrations as cancelled
      await client.query(
        `UPDATE event_registrations 
         SET status = 'cancelled', cancellation_reason = $1, cancelled_at = NOW() 
         WHERE event_id = $2 AND status NOT IN ('cancelled', 'attended')`,
        [reason, eventId]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all registrations for a specific event
   */
  async getEventRegistrationsGlobal(eventId) {
    const query = `
      SELECT 
        er.*,
        u.full_name as user_name, u.email as user_email, u.phone as user_phone,
        p.name as pet_name, p.photo_url as pet_photo
      FROM event_registrations er
      JOIN users u ON er.user_id = u.user_id
      JOIN pets p ON er.pet_id = p.pet_id
      WHERE er.event_id = $1
      ORDER BY er.registered_at ASC
    `;
    const result = await pool.query(query, [eventId]);
    return result.rows;
  }

  /**
   * Update registration status (e.g. check-in)
   */
  async updateRegistrationStatusGlobal(registrationId, status) {
    const query = `
      UPDATE event_registrations 
      SET status = $1, updated_at = NOW() 
      WHERE registration_id = $2 
      RETURNING *
    `;
    const result = await pool.query(query, [status, registrationId]);
    if (result.rows.length === 0) {
      throw new AppError('Registration not found', 404, 'NOT_FOUND');
    }
    return result.rows[0];
  }

  /**
   * Get community management metrics
   */
  async getCommunityMetricsGlobal() {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'upcoming' AND event_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')) as upcoming_count,
        (SELECT COUNT(*) FROM event_registrations WHERE status NOT IN ('cancelled', 'attended', 'noshow')) as total_participants,
        COALESCE(SUM(waitlist_count), 0) as total_waitlist,
        CASE 
          WHEN SUM(max_participants) > 0 THEN 
            ROUND((SUM(current_participants)::NUMERIC / SUM(max_participants)::NUMERIC) * 100, 1)
          ELSE 0 
        END as avg_fill_rate,
        COUNT(*) FILTER (WHERE waitlist_count > 0 AND status = 'upcoming') as events_with_waitlist
      FROM community_events
      WHERE status != 'cancelled';
    `;
    const result = await pool.query(query);
    return result.rows[0];
  }

  // ==================== ADMIN USER MANAGEMENT ====================

  /**
   * Get all admin users with filtering
   */
  async getAllAdminUsers(filters = {}) {
    const { search, role, is_active, page = 1, limit = 20 } = filters;
    
    let whereConditions = ['1=1'];
    let values = [];
    let paramCount = 1;

    if (search) {
      whereConditions.push(`(a.full_name ILIKE $${paramCount} OR a.email ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (role) {
      whereConditions.push(`a.role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }

    if (is_active !== undefined) {
      whereConditions.push(`a.is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        a.admin_id,
        a.user_id,
        a.full_name,
        a.email,
        a.phone,
        a.photo_url,
        a.role,
        a.department,
        a.permissions,
        a.can_access_finance,
        a.can_manage_users,
        a.can_manage_caregivers,
        a.can_manage_content,
        a.is_active,
        a.joined_date,
        a.created_at,
        u.status as user_status
      FROM admin_users a
      LEFT JOIN users u ON a.user_id = u.user_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY a.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    values.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM admin_users a
      WHERE ${whereConditions.join(' AND ')}
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, -2))
    ]);

    return {
      admin_users: dataResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(countResult.rows[0].total / limit)
      }
    };
  }

  /**
   * Get admin user by ID
   */
  async getAdminUserById(adminId) {
    const query = `
      SELECT 
        a.*,
        u.status as user_status,
        u.created_at as user_created_at
      FROM admin_users a
      LEFT JOIN users u ON a.user_id = u.user_id
      WHERE a.admin_id = $1
    `;

    const result = await pool.query(query, [adminId]);
    
    if (result.rows.length === 0) {
      throw new AppError('Admin user not found', 404, 'NOT_FOUND');
    }

    return result.rows[0];
  }

  /**
   * Create a new admin user
   */
  async createAdminUser(data, creatorUserId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        phone, email, full_name, password, // User data
        role, department, permissions, photo_url,
        can_access_finance, can_manage_users, 
        can_manage_caregivers, can_manage_content
      } = data;

      // 1. Check if user already exists
      const userCheck = await client.query(
        'SELECT user_id FROM users WHERE phone = $1 OR email = $2',
        [phone, email]
      );

      if (userCheck.rows.length > 0) {
        throw new AppError('User with this phone or email already exists', 409, 'USER_EXISTS');
      }

      // 2. Get Admin Role ID
      const roleResult = await client.query(
        "SELECT role_id FROM user_roles_ref WHERE role_code IN ('admin', 'super_admin', 'support_agent') LIMIT 1"
      );
      
      if (roleResult.rows.length === 0) {
        throw new AppError('Admin role not defined in system', 500, 'ROLE_NOT_FOUND');
      }
      
      const roleId = roleResult.rows[0].role_id;

      // 3. Hash password if provided
      let passwordHash = null;
      if (password) {
        const EncryptionUtil = require('../utils/encryption.util');
        passwordHash = await EncryptionUtil.hash(password);
      }

      // 4. Create User
      const userId = uuidv4();
      await client.query(
        `INSERT INTO users (
          user_id, phone, email, full_name, role_id, 
          password_hash, profile_photo_url, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())`,
        [userId, phone, email, full_name, roleId, passwordHash, photo_url]
      );

      // 5. Create Admin Profile
      const adminId = uuidv4();
      await client.query(
        `INSERT INTO admin_users (
          admin_id, user_id, full_name, email, phone, photo_url,
          role, department, permissions,
          can_access_finance, can_manage_users, 
          can_manage_caregivers, can_manage_content,
          is_active, joined_date, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, CURRENT_DATE, NOW())`,
        [
          adminId, userId, full_name, email, phone, photo_url || null,
          role || 'admin', department || null, 
          permissions ? JSON.stringify(permissions) : null,
          can_access_finance || false, can_manage_users || false,
          can_manage_caregivers || false, can_manage_content || false
        ]
      );

      await client.query('COMMIT');

      if (photo_url) {
        await attachmentService.markPermanent(photo_url);
      }

      return {
        admin_id: adminId,
        user_id: userId,
        full_name,
        email,
        phone,
        role: role || 'admin',
        is_active: true
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update admin user
   */
  async updateAdminUser(adminId, updates) {
    const allowedFields = [
      'full_name', 'email', 'phone', 'photo_url', 'role', 'department',
      'permissions', 'can_access_finance', 'can_manage_users',
      'can_manage_caregivers', 'can_manage_content'
    ];

    const setFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        setFields.push(`${key} = $${paramCount}`);
        values.push(key === 'permissions' ? JSON.stringify(updates[key]) : updates[key]);
        paramCount++;
      }
    });

    if (setFields.length === 0) {
      throw new AppError('No valid fields to update', 400, 'INVALID_UPDATE');
    }

    setFields.push(`updated_at = NOW()`);
    values.push(adminId);

    const query = `
      UPDATE admin_users 
      SET ${setFields.join(', ')}
      WHERE admin_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError('Admin user not found', 404, 'NOT_FOUND');
    }

    return result.rows[0];
  }

  /**
   * Toggle admin user active status
   */
  async toggleAdminUserStatus(adminId, isActive) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update admin_users table
      const adminResult = await client.query(
        `UPDATE admin_users 
         SET is_active = $1, updated_at = NOW() 
         WHERE admin_id = $2 
         RETURNING user_id`,
        [isActive, adminId]
      );

      if (adminResult.rows.length === 0) {
        throw new AppError('Admin user not found', 404, 'NOT_FOUND');
      }

      const userId = adminResult.rows[0].user_id;

      // Update users table status
      await client.query(
        `UPDATE users 
         SET status = $1, updated_at = NOW() 
         WHERE user_id = $2`,
        [isActive ? 'active' : 'inactive', userId]
      );

      await client.query('COMMIT');

      return { admin_id: adminId, is_active: isActive };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new AdminService();
