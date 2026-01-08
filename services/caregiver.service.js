// ============================================
// FILE: services/caregiver.service.js
// Caregiver Service Layer
// ============================================

const { pool } = require("../config/database");
const { AppError } = require("../utils/response.util");

class CaregiverService {
  // ==================== CAREGIVER PROFILE ====================

  async getCaregiverById(caregiverId) {
    const query = `
      SELECT
        c.*,
        u.phone as user_phone,
        u.email as user_email,
        u.role_id,
        r.role_name
      FROM caregivers c
      LEFT JOIN users u ON c.user_id = u.user_id
      LEFT JOIN user_roles_ref r ON u.role_id = r.role_id
      WHERE c.caregiver_id = $1 AND c.status != 'terminated'
    `;

    const result = await pool.query(query, [caregiverId]);

    if (result.rows.length === 0) {
      throw new AppError("Caregiver not found", 404, "CAREGIVER_NOT_FOUND");
    }

    return result.rows[0];
  }

  async updateProfile(caregiverId, updateData) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      "full_name",
      "email",
      "address",
      "city",
      "state",
      "pincode",
      "emergency_contact_name",
      "emergency_contact_phone",
      "experience_years",
      "education",
      "certifications",
      "languages_spoken",
      "specializations",
      "service_area_pincodes",
      "bank_account_number",
      "ifsc_code",
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(
          typeof updateData[field] === "object"
            ? JSON.stringify(updateData[field])
            : updateData[field]
        );
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new AppError("No fields to update", 400, "NO_UPDATE_FIELDS");
    }

    updates.push(`updated_at = NOW()`);
    values.push(caregiverId);

    const query = `
      UPDATE caregivers
      SET ${updates.join(", ")}
      WHERE caregiver_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateProfilePhoto(caregiverId, photoUrl) {
    const query = `
      UPDATE caregivers
      SET photo_url = $1, updated_at = NOW()
      WHERE caregiver_id = $2
      RETURNING photo_url
    `;

    const result = await pool.query(query, [photoUrl, caregiverId]);
    return result.rows[0];
  }

  // ==================== SPECIALIZATIONS ====================

  async getSpecializations(caregiverId) {
    const query = `
      SELECT
        cs.*,
        sc.category_name,
        sc.category_code
      FROM caregiver_specializations cs
      LEFT JOIN service_categories_ref sc ON cs.category_id = sc.category_id
      WHERE cs.caregiver_id = $1
      ORDER BY cs.created_at DESC
    `;

    const result = await pool.query(query, [caregiverId]);
    return result.rows;
  }

  async addSpecialization(caregiverId, specializationData) {
    const { category_id, proficiency_level, certification_name, certification_url, years_experience } =
      specializationData;

    // Check if already exists
    const existing = await pool.query(
      "SELECT specialization_id FROM caregiver_specializations WHERE caregiver_id = $1 AND category_id = $2",
      [caregiverId, category_id]
    );

    if (existing.rows.length > 0) {
      throw new AppError("Specialization already exists", 409, "SPECIALIZATION_EXISTS");
    }

    const query = `
      INSERT INTO caregiver_specializations (
        caregiver_id, category_id, proficiency_level,
        certification_name, certification_url, years_experience
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [
      caregiverId,
      category_id,
      proficiency_level || null,
      certification_name || null,
      certification_url || null,
      years_experience || null,
    ]);

    return result.rows[0];
  }

  async deleteSpecialization(specializationId, caregiverId) {
    const result = await pool.query(
      "DELETE FROM caregiver_specializations WHERE specialization_id = $1 AND caregiver_id = $2 RETURNING specialization_id",
      [specializationId, caregiverId]
    );

    if (result.rows.length === 0) {
      throw new AppError("Specialization not found", 404, "SPECIALIZATION_NOT_FOUND");
    }

    return true;
  }

  // ==================== ASSIGNMENTS ====================

  async getAssignments(caregiverId, filters) {
    const { status, date, page, limit } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        a.*,
        b.booking_number,
        b.booking_date,
        b.booking_time,
        b.status_id as booking_status_id,
        bs.status_name as booking_status,
        s.service_name,
        p.name as pet_name,
        p.species_id,
        sp.species_name,
        u.full_name as customer_name,
        u.phone as customer_phone,
        ua.address_line1,
        ua.city,
        ua.pincode,
        ua.latitude,
        ua.longitude
      FROM assignments a
      JOIN bookings b ON a.booking_id = b.booking_id
      JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
      JOIN service_catalog s ON b.service_id = s.service_id
      JOIN pets p ON b.pet_id = p.pet_id
      JOIN species_ref sp ON p.species_id = sp.species_id
      JOIN users u ON b.user_id = u.user_id
      LEFT JOIN user_addresses ua ON b.address_id = ua.address_id
      WHERE a.caregiver_id = $1
    `;

    const values = [caregiverId];
    let paramCount = 2;

    if (status) {
      query += ` AND a.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (date) {
      query += ` AND b.booking_date = $${paramCount}`;
      values.push(date);
      paramCount++;
    }

    query += ` ORDER BY b.booking_date DESC, b.booking_time DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM assignments a
      JOIN bookings b ON a.booking_id = b.booking_id
      WHERE a.caregiver_id = $1
    `;

    const countValues = [caregiverId];
    let countParamCount = 2;

    if (status) {
      countQuery += ` AND a.status = $${countParamCount}`;
      countValues.push(status);
      countParamCount++;
    }

    if (date) {
      countQuery += ` AND b.booking_date = $${countParamCount}`;
      countValues.push(date);
    }

    const countResult = await pool.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].total);

    return {
      assignments: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAssignmentDetails(assignmentId, caregiverId) {
    const query = `
      SELECT
        a.*,
        b.*,
        bs.status_name as booking_status,
        s.service_name,
        s.description as service_description,
        s.duration_minutes,
        p.name as pet_name,
        p.species_id,
        p.breed,
        p.gender_id,
        p.weight,
        p.medical_conditions,
        p.behavioral_notes,
        sp.species_name,
        u.full_name as customer_name,
        u.phone as customer_phone,
        u.email as customer_email,
        ua.address_line1,
        ua.address_line2,
        ua.landmark,
        ua.city,
        ua.state,
        ua.pincode,
        ua.latitude,
        ua.longitude,
        sl.service_notes,
        sl.before_photos,
        sl.after_photos,
        sl.health_observations
      FROM assignments a
      JOIN bookings b ON a.booking_id = b.booking_id
      JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
      JOIN service_catalog s ON b.service_id = s.service_id
      JOIN pets p ON b.pet_id = p.pet_id
      JOIN species_ref sp ON p.species_id = sp.species_id
      JOIN users u ON b.user_id = u.user_id
      LEFT JOIN user_addresses ua ON b.address_id = ua.address_id
      LEFT JOIN service_logs sl ON a.assignment_id = sl.assignment_id
      WHERE a.assignment_id = $1 AND a.caregiver_id = $2
    `;

    const result = await pool.query(query, [assignmentId, caregiverId]);

    if (result.rows.length === 0) {
      throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
    }

    return result.rows[0];
  }

  async acceptAssignment(assignmentId, caregiverId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verify assignment belongs to caregiver and is in assigned status
      const check = await client.query(
        "SELECT status FROM assignments WHERE assignment_id = $1 AND caregiver_id = $2",
        [assignmentId, caregiverId]
      );

      if (check.rows.length === 0) {
        throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
      }

      if (check.rows[0].status !== "assigned") {
        throw new AppError(
          "Assignment cannot be accepted in current status",
          400,
          "INVALID_STATUS"
        );
      }

      // Update assignment
      const result = await client.query(
        `UPDATE assignments
        SET status = 'accepted', accepted_at = NOW()
        WHERE assignment_id = $1
        RETURNING *`,
        [assignmentId]
      );

      // Update booking status
      await client.query(
        `UPDATE bookings
        SET status_id = (SELECT status_id FROM booking_statuses_ref WHERE status_code = 'confirmed')
        WHERE booking_id = (SELECT booking_id FROM assignments WHERE assignment_id = $1)`,
        [assignmentId]
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async rejectAssignment(assignmentId, caregiverId, rejectionReason) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verify assignment
      const check = await client.query(
        "SELECT status FROM assignments WHERE assignment_id = $1 AND caregiver_id = $2",
        [assignmentId, caregiverId]
      );

      if (check.rows.length === 0) {
        throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
      }

      if (check.rows[0].status !== "assigned") {
        throw new AppError("Assignment cannot be rejected in current status", 400, "INVALID_STATUS");
      }

      // Update assignment
      const result = await client.query(
        `UPDATE assignments
        SET status = 'rejected', rejection_reason = $2
        WHERE assignment_id = $1
        RETURNING *`,
        [assignmentId, rejectionReason]
      );

      // TODO: Trigger re-assignment logic here

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async startService(assignmentId, caregiverId, latitude, longitude) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const check = await client.query(
        "SELECT status FROM assignments WHERE assignment_id = $1 AND caregiver_id = $2",
        [assignmentId, caregiverId]
      );

      if (check.rows.length === 0) {
        throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
      }

      if (check.rows[0].status !== "accepted") {
        throw new AppError("Service can only be started from accepted status", 400, "INVALID_STATUS");
      }

      // Update assignment
      const result = await client.query(
        `UPDATE assignments
        SET status = 'in_progress',
            actual_start_time = NOW(),
            started_at = NOW()
        WHERE assignment_id = $1
        RETURNING *`,
        [assignmentId]
      );

      // Update booking status
      await client.query(
        `UPDATE bookings
        SET status_id = (SELECT status_id FROM booking_statuses_ref WHERE status_code = 'in_progress'),
            actual_start_time = NOW()
        WHERE booking_id = (SELECT booking_id FROM assignments WHERE assignment_id = $1)`,
        [assignmentId]
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async completeService(assignmentId, caregiverId, serviceLogData) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const check = await client.query(
        "SELECT status, actual_start_time FROM assignments WHERE assignment_id = $1 AND caregiver_id = $2",
        [assignmentId, caregiverId]
      );

      if (check.rows.length === 0) {
        throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
      }

      if (check.rows[0].status !== "in_progress") {
        throw new AppError("Service must be in progress to complete", 400, "INVALID_STATUS");
      }

      // Calculate service time
      const startTime = new Date(check.rows[0].actual_start_time);
      const endTime = new Date();
      const serviceTimeMinutes = Math.round((endTime - startTime) / 60000);

      // Update assignment
      const assignmentResult = await client.query(
        `UPDATE assignments
        SET status = 'completed',
            actual_end_time = NOW(),
            completed_at = NOW(),
            service_time_minutes = $2
        WHERE assignment_id = $1
        RETURNING *`,
        [assignmentId, serviceTimeMinutes]
      );

      // Create service log
      const logResult = await client.query(
        `INSERT INTO service_logs (
          assignment_id, pre_service_checklist, post_service_checklist,
          before_photos, after_photos, service_notes,
          pet_behavior_observed, health_observations,
          concerns_flagged, products_used,
          additional_services_recommended, next_visit_suggestions,
          completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING *`,
        [
          assignmentId,
          JSON.stringify(serviceLogData.pre_service_checklist || {}),
          JSON.stringify(serviceLogData.post_service_checklist || {}),
          JSON.stringify(serviceLogData.before_photos || []),
          JSON.stringify(serviceLogData.after_photos || []),
          serviceLogData.service_notes || null,
          serviceLogData.pet_behavior_observed || null,
          serviceLogData.health_observations || null,
          serviceLogData.concerns_flagged || null,
          JSON.stringify(serviceLogData.products_used || []),
          serviceLogData.additional_services_recommended || null,
          serviceLogData.next_visit_suggestions || null,
        ]
      );

      // Update booking status
      await client.query(
        `UPDATE bookings
        SET status_id = (SELECT status_id FROM booking_statuses_ref WHERE status_code = 'completed'),
            actual_end_time = NOW()
        WHERE booking_id = (SELECT booking_id FROM assignments WHERE assignment_id = $1)`,
        [assignmentId]
      );

      // Update caregiver stats
      await client.query(
        `UPDATE caregivers
        SET total_services_completed = total_services_completed + 1
        WHERE caregiver_id = $1`,
        [caregiverId]
      );

      await client.query("COMMIT");

      return {
        assignment: assignmentResult.rows[0],
        service_log: logResult.rows[0],
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== AVAILABILITY ====================

  async getAvailability(caregiverId, startDate, endDate) {
    const query = `
      SELECT * FROM caregiver_availability
      WHERE caregiver_id = $1
      AND date >= $2
      AND date <= $3
      ORDER BY date, start_time
    `;

    const result = await pool.query(query, [caregiverId, startDate, endDate]);
    return result.rows;
  }

  async setAvailability(caregiverId, availabilityData) {
    const { date, start_time, end_time, is_available, unavailability_reason, max_bookings, notes } =
      availabilityData;

    // Check if already exists
    const existing = await pool.query(
      "SELECT availability_id FROM caregiver_availability WHERE caregiver_id = $1 AND date = $2",
      [caregiverId, date]
    );

    if (existing.rows.length > 0) {
      throw new AppError("Availability already set for this date", 409, "AVAILABILITY_EXISTS");
    }

    const query = `
      INSERT INTO caregiver_availability (
        caregiver_id, date, start_time, end_time,
        is_available, unavailability_reason, max_bookings, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await pool.query(query, [
      caregiverId,
      date,
      start_time,
      end_time,
      is_available !== false,
      unavailability_reason || null,
      max_bookings || 8,
      notes || null,
    ]);

    return result.rows[0];
  }

  async updateAvailability(availabilityId, caregiverId, updateData) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      "start_time",
      "end_time",
      "is_available",
      "unavailability_reason",
      "max_bookings",
      "notes",
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new AppError("No fields to update", 400, "NO_UPDATE_FIELDS");
    }

    updates.push(`updated_at = NOW()`);
    values.push(availabilityId, caregiverId);

    const query = `
      UPDATE caregiver_availability
      SET ${updates.join(", ")}
      WHERE availability_id = $${paramCount} AND caregiver_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError("Availability not found", 404, "AVAILABILITY_NOT_FOUND");
    }

    return result.rows[0];
  }

  async deleteAvailability(availabilityId, caregiverId) {
    const result = await pool.query(
      "DELETE FROM caregiver_availability WHERE availability_id = $1 AND caregiver_id = $2 RETURNING availability_id",
      [availabilityId, caregiverId]
    );

    if (result.rows.length === 0) {
      throw new AppError("Availability not found", 404, "AVAILABILITY_NOT_FOUND");
    }

    return true;
  }

  // ==================== EARNINGS ====================

  async getEarnings(caregiverId, filters) {
    const { start_date, end_date, payout_status, page, limit } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT * FROM caregiver_earnings
      WHERE caregiver_id = $1
    `;

    const values = [caregiverId];
    let paramCount = 2;

    if (start_date) {
      query += ` AND earning_date >= $${paramCount}`;
      values.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND earning_date <= $${paramCount}`;
      values.push(end_date);
      paramCount++;
    }

    if (payout_status) {
      query += ` AND payout_status = $${paramCount}`;
      values.push(payout_status);
      paramCount++;
    }

    query += ` ORDER BY earning_date DESC, created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM caregiver_earnings WHERE caregiver_id = $1`;
    const countValues = [caregiverId];
    let countParamCount = 2;

    if (start_date) {
      countQuery += ` AND earning_date >= $${countParamCount}`;
      countValues.push(start_date);
      countParamCount++;
    }

    if (end_date) {
      countQuery += ` AND earning_date <= $${countParamCount}`;
      countValues.push(end_date);
      countParamCount++;
    }

    if (payout_status) {
      countQuery += ` AND payout_status = $${countParamCount}`;
      countValues.push(payout_status);
    }

    const countResult = await pool.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].total);

    return {
      earnings: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEarningsSummary(caregiverId, period) {
    let dateCondition = "";

    if (period === "week") {
      dateCondition = "AND earning_date >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateCondition = "AND earning_date >= DATE_TRUNC('month', CURRENT_DATE)";
    } else if (period === "year") {
      dateCondition = "AND earning_date >= DATE_TRUNC('year', CURRENT_DATE)";
    }

    const query = `
      SELECT
        COUNT(*) as total_earnings,
        SUM(amount) as total_amount,
        SUM(CASE WHEN payout_status = 'pending' THEN amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN payout_status = 'approved' THEN amount ELSE 0 END) as approved_amount,
        SUM(CASE WHEN payout_status = 'paid' THEN amount ELSE 0 END) as paid_amount
      FROM caregiver_earnings
      WHERE caregiver_id = $1 ${dateCondition}
    `;

    const result = await pool.query(query, [caregiverId]);
    return result.rows[0];
  }

  // ==================== RATINGS ====================

  async getRatings(caregiverId, { page, limit }) {
    const offset = (page - 1) * limit;

    const query = `
      SELECT
        cr.*,
        u.full_name as customer_name,
        p.name as pet_name,
        s.service_name,
        b.booking_date
      FROM caregiver_ratings cr
      JOIN users u ON cr.user_id = u.user_id
      JOIN bookings b ON cr.booking_id = b.booking_id
      JOIN pets p ON b.pet_id = p.pet_id
      JOIN service_catalog s ON b.service_id = s.service_id
      WHERE cr.caregiver_id = $1 AND cr.is_visible = true
      ORDER BY cr.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [caregiverId, limit, offset]);

    const countResult = await pool.query(
      "SELECT COUNT(*) as total FROM caregiver_ratings WHERE caregiver_id = $1 AND is_visible = true",
      [caregiverId]
    );

    const total = parseInt(countResult.rows[0].total);

    return {
      ratings: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRatingSummary(caregiverId) {
    const query = `
      SELECT
        AVG(rating_score) as average_rating,
        COUNT(*) as total_ratings,
        AVG(punctuality_rating) as avg_punctuality,
        AVG(quality_rating) as avg_quality,
        AVG(friendliness_rating) as avg_friendliness,
        AVG(professionalism_rating) as avg_professionalism,
        COUNT(CASE WHEN rating_score = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating_score = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating_score = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating_score = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN rating_score = 1 THEN 1 END) as one_star
      FROM caregiver_ratings
      WHERE caregiver_id = $1 AND is_visible = true
    `;

    const result = await pool.query(query, [caregiverId]);
    return result.rows[0];
  }

  // ==================== DASHBOARD ====================

  async getDashboard(caregiverId) {
    // Get today's assignments
    const todayQuery = `
      SELECT
        a.*,
        b.booking_number,
        b.booking_time,
        s.service_name,
        p.name as pet_name,
        u.full_name as customer_name,
        ua.city
      FROM assignments a
      JOIN bookings b ON a.booking_id = b.booking_id
      JOIN service_catalog s ON b.service_id = s.service_id
      JOIN pets p ON b.pet_id = p.pet_id
      JOIN users u ON b.user_id = u.user_id
      LEFT JOIN user_addresses ua ON b.address_id = ua.address_id
      WHERE a.caregiver_id = $1
      AND b.booking_date = CURRENT_DATE
      ORDER BY b.booking_time
    `;

    const todayResult = await pool.query(todayQuery, [caregiverId]);

    // Get stats
    const statsQuery = `
      SELECT
        c.average_rating,
        c.total_services_completed,
        c.total_ratings,
        (SELECT COUNT(*) FROM assignments WHERE caregiver_id = $1 AND status = 'assigned') as pending_assignments,
        (SELECT SUM(amount) FROM caregiver_earnings WHERE caregiver_id = $1 AND payout_status = 'pending') as pending_earnings,
        (SELECT SUM(amount) FROM caregiver_earnings WHERE caregiver_id = $1 AND earning_date >= DATE_TRUNC('month', CURRENT_DATE)) as month_earnings
      FROM caregivers c
      WHERE c.caregiver_id = $1
    `;

    const statsResult = await pool.query(statsQuery, [caregiverId]);

    return {
      today_assignments: todayResult.rows,
      stats: statsResult.rows[0],
    };
  }
}

module.exports = new CaregiverService();