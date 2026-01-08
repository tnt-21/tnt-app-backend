// ============================================
// FILE: services/careManager.service.js
// Care Manager Service Layer
// ============================================

const { pool } = require("../config/database");
const { AppError } = require("../utils/response.util");

class CareManagerService {
  // ==================== PROFILE ====================

  async getProfileById(careManagerId) {
    const query = `
      SELECT
        cm.*,
        u.phone as user_phone,
        u.email as user_email,
        u.role_id,
        r.role_name
      FROM care_managers cm
      LEFT JOIN users u ON cm.user_id = u.user_id
      LEFT JOIN user_roles_ref r ON u.role_id = r.role_id
      WHERE cm.care_manager_id = $1 AND cm.status = 'active'
    `;

    const result = await pool.query(query, [careManagerId]);

    if (result.rows.length === 0) {
      throw new AppError("Care manager not found", 404, "CARE_MANAGER_NOT_FOUND");
    }

    return result.rows[0];
  }

  async updateProfile(careManagerId, updateData) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      "full_name",
      "email",
      "specialization",
      "qualifications",
      "experience_years",
      "languages_spoken",
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
    values.push(careManagerId);

    const query = `
      UPDATE care_managers
      SET ${updates.join(", ")}
      WHERE care_manager_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateProfilePhoto(careManagerId, photoUrl) {
    const query = `
      UPDATE care_managers
      SET photo_url = $1, updated_at = NOW()
      WHERE care_manager_id = $2
      RETURNING photo_url
    `;

    const result = await pool.query(query, [photoUrl, careManagerId]);
    return result.rows[0];
  }

  // ==================== ASSIGNMENTS ====================

  async getAssignments(careManagerId, filters) {
    const { is_active, page, limit } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        cma.*,
        p.name as pet_name,
        p.species_id,
        p.breed,
        p.date_of_birth,
        sp.species_name,
        ls.life_stage_name,
        u.full_name as owner_name,
        u.phone as owner_phone,
        u.email as owner_email,
        s.subscription_id,
        st.tier_name,
        s.current_period_end,
        s.status as subscription_status
      FROM care_manager_assignments cma
      JOIN pets p ON cma.pet_id = p.pet_id
      JOIN species_ref sp ON p.species_id = sp.species_id
      LEFT JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
      JOIN users u ON cma.user_id = u.user_id
      JOIN subscriptions s ON cma.subscription_id = s.subscription_id
      JOIN subscription_tiers_ref st ON s.tier_id = st.tier_id
      WHERE cma.care_manager_id = $1
    `;

    const values = [careManagerId];
    let paramCount = 2;

    if (is_active !== undefined) {
      query += ` AND cma.is_active = $${paramCount}`;
      values.push(is_active);
      paramCount++;
    }

    query += ` ORDER BY cma.assignment_date DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM care_manager_assignments
      WHERE care_manager_id = $1
    `;

    const countValues = [careManagerId];
    let countParamCount = 2;

    if (is_active !== undefined) {
      countQuery += ` AND is_active = $${countParamCount}`;
      countValues.push(is_active);
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

  async getAssignmentDetails(assignmentId, careManagerId) {
    const query = `
      SELECT
        cma.*,
        p.*,
        sp.species_name,
        ls.life_stage_name,
        u.full_name as owner_name,
        u.phone as owner_phone,
        u.email as owner_email,
        u.profile_photo_url as owner_photo,
        s.subscription_id,
        s.tier_id,
        st.tier_name,
        st.tier_code,
        s.start_date as subscription_start,
        s.current_period_end,
        s.next_billing_date,
        s.status as subscription_status
      FROM care_manager_assignments cma
      JOIN pets p ON cma.pet_id = p.pet_id
      JOIN species_ref sp ON p.species_id = sp.species_id
      LEFT JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
      JOIN users u ON cma.user_id = u.user_id
      JOIN subscriptions s ON cma.subscription_id = s.subscription_id
      JOIN subscription_tiers_ref st ON s.tier_id = st.tier_id
      WHERE cma.assignment_id = $1 AND cma.care_manager_id = $2
    `;

    const result = await pool.query(query, [assignmentId, careManagerId]);

    if (result.rows.length === 0) {
      throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
    }

    return result.rows[0];
  }

  async completeOnboarding(assignmentId, careManagerId, notes, carePlanUrl) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verify assignment
      const check = await client.query(
        "SELECT onboarding_call_completed FROM care_manager_assignments WHERE assignment_id = $1 AND care_manager_id = $2",
        [assignmentId, careManagerId]
      );

      if (check.rows.length === 0) {
        throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
      }

      if (check.rows[0].onboarding_call_completed) {
        throw new AppError("Onboarding already completed", 400, "ONBOARDING_COMPLETED");
      }

      // Update assignment
      const result = await client.query(
        `UPDATE care_manager_assignments
        SET onboarding_call_completed = true,
            onboarding_call_date = NOW(),
            care_plan_created = $2::boolean,
            care_plan_url = $3,
            notes = $4,
            last_check_in_date = CURRENT_DATE,
            next_check_in_date = CURRENT_DATE + INTERVAL '7 days'
        WHERE assignment_id = $1
        RETURNING *`,
        [assignmentId, carePlanUrl ? true : false, carePlanUrl || null, notes || null]
      );

      // Log interaction
      await client.query(
        `INSERT INTO care_manager_interactions (
          assignment_id, interaction_type, interaction_date,
          summary, created_by
        ) VALUES ($1, 'onboarding', NOW(), $2, $3)`,
        [assignmentId, notes || "Onboarding call completed", careManagerId]
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

  async updateCheckInFrequency(assignmentId, careManagerId, checkInFrequency) {
    const validFrequencies = ["daily", "weekly", "biweekly", "monthly"];

    if (!validFrequencies.includes(checkInFrequency)) {
      throw new AppError("Invalid check-in frequency", 400, "INVALID_FREQUENCY");
    }

    const result = await pool.query(
      `UPDATE care_manager_assignments
      SET check_in_frequency = $1
      WHERE assignment_id = $2 AND care_manager_id = $3
      RETURNING *`,
      [checkInFrequency, assignmentId, careManagerId]
    );

    if (result.rows.length === 0) {
      throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
    }

    return result.rows[0];
  }

  // ==================== INTERACTIONS ====================

  async getInteractions(assignmentId, careManagerId, { page, limit }) {
    const offset = (page - 1) * limit;

    // Verify assignment belongs to care manager
    const check = await pool.query(
      "SELECT assignment_id FROM care_manager_assignments WHERE assignment_id = $1 AND care_manager_id = $2",
      [assignmentId, careManagerId]
    );

    if (check.rows.length === 0) {
      throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
    }

    const query = `
      SELECT
        cmi.*,
        u.full_name as created_by_name
      FROM care_manager_interactions cmi
      LEFT JOIN users u ON cmi.created_by = u.user_id
      WHERE cmi.assignment_id = $1
      ORDER BY cmi.interaction_date DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [assignmentId, limit, offset]);

    const countResult = await pool.query(
      "SELECT COUNT(*) as total FROM care_manager_interactions WHERE assignment_id = $1",
      [assignmentId]
    );

    const total = parseInt(countResult.rows[0].total);

    return {
      interactions: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async logInteraction(assignmentId, careManagerId, userId, interactionData) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verify assignment
      const check = await client.query(
        "SELECT assignment_id FROM care_manager_assignments WHERE assignment_id = $1 AND care_manager_id = $2",
        [assignmentId, careManagerId]
      );

      if (check.rows.length === 0) {
        throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
      }

      // Insert interaction
      const result = await client.query(
        `INSERT INTO care_manager_interactions (
          assignment_id, interaction_type, interaction_date,
          duration_minutes, summary, action_items,
          next_follow_up_date, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          assignmentId,
          interactionData.interaction_type,
          interactionData.interaction_date || new Date(),
          interactionData.duration_minutes || null,
          interactionData.summary,
          JSON.stringify(interactionData.action_items || []),
          interactionData.next_follow_up_date || null,
          userId,
        ]
      );

      // Update last check-in date and next check-in date
      await client.query(
        `UPDATE care_manager_assignments
        SET last_check_in_date = CURRENT_DATE,
            next_check_in_date = $2
        WHERE assignment_id = $1`,
        [assignmentId, interactionData.next_follow_up_date || null]
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

  async updateInteraction(interactionId, careManagerId, updateData) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      "interaction_type",
      "interaction_date",
      "duration_minutes",
      "summary",
      "action_items",
      "next_follow_up_date",
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(
          field === "action_items" ? JSON.stringify(updateData[field]) : updateData[field]
        );
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new AppError("No fields to update", 400, "NO_UPDATE_FIELDS");
    }

    values.push(interactionId);

    // Verify interaction belongs to care manager's assignment
    const checkQuery = `
      SELECT cmi.interaction_id
      FROM care_manager_interactions cmi
      JOIN care_manager_assignments cma ON cmi.assignment_id = cma.assignment_id
      WHERE cmi.interaction_id = $${paramCount} AND cma.care_manager_id = $${paramCount + 1}
    `;
    values.push(careManagerId);

    const check = await pool.query(checkQuery, values.slice(-2));

    if (check.rows.length === 0) {
      throw new AppError("Interaction not found", 404, "INTERACTION_NOT_FOUND");
    }

    const query = `
      UPDATE care_manager_interactions
      SET ${updates.join(", ")}
      WHERE interaction_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values.slice(0, -1));
    return result.rows[0];
  }

  async deleteInteraction(interactionId, careManagerId) {
    // Verify interaction belongs to care manager's assignment
    const check = await pool.query(
      `SELECT cmi.interaction_id
      FROM care_manager_interactions cmi
      JOIN care_manager_assignments cma ON cmi.assignment_id = cma.assignment_id
      WHERE cmi.interaction_id = $1 AND cma.care_manager_id = $2`,
      [interactionId, careManagerId]
    );

    if (check.rows.length === 0) {
      throw new AppError("Interaction not found", 404, "INTERACTION_NOT_FOUND");
    }

    await pool.query("DELETE FROM care_manager_interactions WHERE interaction_id = $1", [
      interactionId,
    ]);

    return true;
  }

  // ==================== DASHBOARD ====================

  async getDashboard(careManagerId) {
    // Get stats
    const statsQuery = `
      SELECT
        cm.current_pets_count,
        cm.max_pets,
        cm.average_satisfaction_score,
        (SELECT COUNT(*) FROM care_manager_assignments WHERE care_manager_id = $1 AND is_active = true) as active_assignments,
        (SELECT COUNT(*) FROM care_manager_assignments cma
         WHERE cma.care_manager_id = $1
         AND cma.is_active = true
         AND NOT cma.onboarding_call_completed) as pending_onboardings,
        (SELECT COUNT(*) FROM care_manager_assignments cma
         WHERE cma.care_manager_id = $1
         AND cma.is_active = true
         AND cma.next_check_in_date <= CURRENT_DATE + INTERVAL '7 days') as upcoming_check_ins
      FROM care_managers cm
      WHERE cm.care_manager_id = $1
    `;

    const statsResult = await pool.query(statsQuery, [careManagerId]);

    // Get recent interactions
    const interactionsQuery = `
      SELECT
        cmi.*,
        p.name as pet_name,
        u.full_name as owner_name
      FROM care_manager_interactions cmi
      JOIN care_manager_assignments cma ON cmi.assignment_id = cma.assignment_id
      JOIN pets p ON cma.pet_id = p.pet_id
      JOIN users u ON cma.user_id = u.user_id
      WHERE cma.care_manager_id = $1
      ORDER BY cmi.interaction_date DESC
      LIMIT 10
    `;

    const interactionsResult = await pool.query(interactionsQuery, [careManagerId]);

    // Get pets needing attention
    const attentionQuery = `
      SELECT
        cma.assignment_id,
        p.pet_id,
        p.name as pet_name,
        p.species_id,
        sp.species_name,
        u.full_name as owner_name,
        u.phone as owner_phone,
        cma.last_check_in_date,
        cma.next_check_in_date,
        cma.onboarding_call_completed
      FROM care_manager_assignments cma
      JOIN pets p ON cma.pet_id = p.pet_id
      JOIN species_ref sp ON p.species_id = sp.species_id
      JOIN users u ON cma.user_id = u.user_id
      WHERE cma.care_manager_id = $1
      AND cma.is_active = true
      AND (NOT cma.onboarding_call_completed OR cma.next_check_in_date <= CURRENT_DATE)
      ORDER BY cma.next_check_in_date ASC NULLS FIRST
      LIMIT 10
    `;

    const attentionResult = await pool.query(attentionQuery, [careManagerId]);

    return {
      stats: statsResult.rows[0],
      recent_interactions: interactionsResult.rows,
      pets_needing_attention: attentionResult.rows,
    };
  }

  async getPetDetails(petId, careManagerId) {
    const query = `
      SELECT
        p.*,
        sp.species_name,
        ls.life_stage_name,
        u.full_name as owner_name,
        u.phone as owner_phone,
        u.email as owner_email,
        cma.assignment_id,
        cma.onboarding_call_completed,
        cma.care_plan_url,
        cma.check_in_frequency,
        cma.last_check_in_date,
        cma.next_check_in_date,
        s.tier_id,
        st.tier_name,
        s.current_period_end
      FROM pets p
      JOIN species_ref sp ON p.species_id = sp.species_id
      LEFT JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
      JOIN care_manager_assignments cma ON p.pet_id = cma.pet_id
      JOIN users u ON p.owner_id = u.user_id
      JOIN subscriptions s ON cma.subscription_id = s.subscription_id
      JOIN subscription_tiers_ref st ON s.tier_id = st.tier_id
      WHERE p.pet_id = $1 AND cma.care_manager_id = $2 AND cma.is_active = true
    `;

    const result = await pool.query(query, [petId, careManagerId]);

    if (result.rows.length === 0) {
      throw new AppError("Pet not found in your assignments", 404, "PET_NOT_FOUND");
    }

    // Get recent health records
    const healthQuery = `
      SELECT * FROM health_records
      WHERE pet_id = $1
      ORDER BY record_date DESC
      LIMIT 5
    `;

    const healthResult = await pool.query(healthQuery, [petId]);

    // Get recent interactions
    const interactionsQuery = `
      SELECT * FROM care_manager_interactions
      WHERE assignment_id = (
        SELECT assignment_id FROM care_manager_assignments
        WHERE pet_id = $1 AND care_manager_id = $2
      )
      ORDER BY interaction_date DESC
      LIMIT 10
    `;

    const interactionsResult = await pool.query(interactionsQuery, [petId, careManagerId]);

    return {
      pet: result.rows[0],
      recent_health_records: healthResult.rows,
      recent_interactions: interactionsResult.rows,
    };
  }

  async getUpcomingCheckIns(careManagerId) {
    const query = `
      SELECT
        cma.assignment_id,
        cma.next_check_in_date,
        cma.check_in_frequency,
        cma.last_check_in_date,
        p.pet_id,
        p.name as pet_name,
        sp.species_name,
        u.full_name as owner_name,
        u.phone as owner_phone
      FROM care_manager_assignments cma
      JOIN pets p ON cma.pet_id = p.pet_id
      JOIN species_ref sp ON p.species_id = sp.species_id
      JOIN users u ON cma.user_id = u.user_id
      WHERE cma.care_manager_id = $1
      AND cma.is_active = true
      AND cma.next_check_in_date IS NOT NULL
      AND cma.next_check_in_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY cma.next_check_in_date ASC
    `;

    const result = await pool.query(query, [careManagerId]);
    return result.rows;
  }

  async scheduleCheckIn(assignmentId, careManagerId, nextCheckInDate) {
    const result = await pool.query(
      `UPDATE care_manager_assignments
      SET next_check_in_date = $1
      WHERE assignment_id = $2 AND care_manager_id = $3
      RETURNING *`,
      [nextCheckInDate, assignmentId, careManagerId]
    );

    if (result.rows.length === 0) {
      throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
    }

    return result.rows[0];
  }
}

module.exports = new CareManagerService();