// ============================================
// FILE: services/community.service.js
// Community Events Service
// ============================================

const { pool } = require("../config/database");
const { AppError } = require("../utils/response.util");

class CommunityService {
  // ==================== EVENTS ====================

  async getEvents(filters, userId) {
    const conditions = ["ce.status != 'cancelled'"];
    const params = [];
    let paramCount = 1;

    if (filters.status) {
      conditions.push(`ce.status = $${paramCount}`);
      params.push(filters.status);
      paramCount++;
    }

    if (filters.event_type) {
      conditions.push(`ce.event_type = $${paramCount}`);
      params.push(filters.event_type);
      paramCount++;
    }

    if (filters.species_id) {
      conditions.push(
        `(ce.species_id = $${paramCount} OR ce.species_id IS NULL)`
      );
      params.push(filters.species_id);
      paramCount++;
    }

    if (filters.from_date) {
      conditions.push(`ce.event_date >= $${paramCount}`);
      params.push(filters.from_date);
      paramCount++;
    }

    if (filters.to_date) {
      conditions.push(`ce.event_date <= $${paramCount}`);
      params.push(filters.to_date);
      paramCount++;
    }

    if (filters.is_free !== undefined) {
      conditions.push(`ce.is_free = $${paramCount}`);
      params.push(filters.is_free === "true");
      paramCount++;
    }

    const offset = (filters.page - 1) * filters.limit;

    const query = `
      SELECT
        ce.*,
        s.species_name,
        CASE
          WHEN er.registration_id IS NOT NULL THEN true
          ELSE false
        END as is_registered,
        CASE
          WHEN ce.current_participants >= ce.max_participants THEN true
          ELSE false
        END as is_full
      FROM community_events ce
      LEFT JOIN species_ref s ON ce.species_id = s.species_id
      LEFT JOIN event_registrations er ON ce.event_id = er.event_id
        AND er.user_id = $${paramCount}
        AND er.status NOT IN ('cancelled')
      WHERE ${conditions.join(" AND ")}
      ORDER BY ce.event_date ASC, ce.event_time ASC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    params.push(userId || null, filters.limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM community_events ce
      WHERE ${conditions.join(" AND ")}
    `;
    const countResult = await pool.query(
      countQuery,
      params.slice(0, paramCount - 1)
    );

    return {
      events: result.rows,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / filters.limit),
      },
    };
  }

  async getEventById(eventId, userId) {
    const query = `
      SELECT
        ce.*,
        s.species_name,
        u.full_name as created_by_name,
        CASE
          WHEN er.registration_id IS NOT NULL THEN true
          ELSE false
        END as is_registered,
        er.registration_id,
        er.status as registration_status,
        CASE
          WHEN ce.current_participants >= ce.max_participants THEN true
          ELSE false
        END as is_full,
        (ce.max_participants - ce.current_participants) as spots_available
      FROM community_events ce
      LEFT JOIN species_ref s ON ce.species_id = s.species_id
      LEFT JOIN users u ON ce.created_by = u.user_id
      LEFT JOIN event_registrations er ON ce.event_id = er.event_id
        AND er.user_id = $2
        AND er.status NOT IN ('cancelled')
      WHERE ce.event_id = $1
    `;

    const result = await pool.query(query, [eventId, userId || null]);

    if (result.rows.length === 0) {
      throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
    }

    return result.rows[0];
  }

  async registerForEvent(registrationData) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const {
        event_id,
        user_id,
        pet_id,
        special_requirements,
        emergency_contact_name,
        emergency_contact_phone,
      } = registrationData;

      // Get event details
      const eventResult = await client.query(
        "SELECT * FROM community_events WHERE event_id = $1",
        [event_id]
      );

      if (eventResult.rows.length === 0) {
        throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      const event = eventResult.rows[0];

      // Check event status
      if (event.status === "cancelled") {
        throw new AppError("Event has been cancelled", 400, "EVENT_CANCELLED");
      }

      if (event.status === "completed") {
        throw new AppError("Event has already ended", 400, "EVENT_COMPLETED");
      }

      // Check registration deadline
      if (event.registration_deadline) {
        const deadline = new Date(event.registration_deadline);
        if (new Date() > deadline) {
          throw new AppError(
            "Registration deadline has passed",
            400,
            "REGISTRATION_CLOSED"
          );
        }
      }

      // Check if already registered
      const existingReg = await client.query(
        `SELECT registration_id FROM event_registrations
         WHERE event_id = $1 AND user_id = $2 AND pet_id = $3
         AND status NOT IN ('cancelled')`,
        [event_id, user_id, pet_id]
      );

      if (existingReg.rows.length > 0) {
        throw new AppError(
          "Already registered for this event",
          409,
          "ALREADY_REGISTERED"
        );
      }

      // Check if event is full
      if (event.current_participants >= event.max_participants) {
        if (!event.waitlist_enabled) {
          throw new AppError("Event is full", 400, "EVENT_FULL");
        }
        throw new AppError(
          "Event is full. Please join waitlist instead.",
          400,
          "EVENT_FULL_JOIN_WAITLIST"
        );
      }

      // Verify pet ownership
      const petCheck = await client.query(
        "SELECT pet_id FROM pets WHERE pet_id = $1 AND owner_id = $2 AND is_active = true",
        [pet_id, user_id]
      );

      if (petCheck.rows.length === 0) {
        throw new AppError("Pet not found", 404, "PET_NOT_FOUND");
      }

      // Check subscription tier requirements if any
      if (event.subscription_tiers_allowed) {
        const tierCheck = await client.query(
          `SELECT s.tier_id FROM subscriptions s
           WHERE s.user_id = $1 AND s.status = 'active'
           AND s.tier_id = ANY($2::smallint[])`,
          [user_id, event.subscription_tiers_allowed]
        );

        if (tierCheck.rows.length === 0) {
          throw new AppError(
            "Your subscription tier does not have access to this event",
            403,
            "TIER_NOT_ALLOWED"
          );
        }
      }

      // Determine payment requirement
      const payment_required = !event.is_free;
      const payment_status = payment_required ? "pending" : null;

      // Create registration
      const insertQuery = `
        INSERT INTO event_registrations (
          event_id, user_id, pet_id, registration_type, status,
          payment_required, payment_status, special_requirements,
          emergency_contact_name, emergency_contact_phone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const regResult = await client.query(insertQuery, [
        event_id,
        user_id,
        pet_id,
        "confirmed",
        "registered",
        payment_required,
        payment_status,
        special_requirements || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
      ]);

      // Update participant count
      await client.query(
        `UPDATE community_events
         SET current_participants = current_participants + 1
         WHERE event_id = $1`,
        [event_id]
      );

      await client.query("COMMIT");

      return regResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelRegistration(registrationId, userId, cancellationReason) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get registration
      const regResult = await client.query(
        `SELECT er.*, ce.event_date, ce.event_time
         FROM event_registrations er
         JOIN community_events ce ON er.event_id = ce.event_id
         WHERE er.registration_id = $1 AND er.user_id = $2`,
        [registrationId, userId]
      );

      if (regResult.rows.length === 0) {
        throw new AppError(
          "Registration not found",
          404,
          "REGISTRATION_NOT_FOUND"
        );
      }

      const registration = regResult.rows[0];

      if (registration.status === "cancelled") {
        throw new AppError(
          "Registration already cancelled",
          400,
          "ALREADY_CANCELLED"
        );
      }

      // Update registration
      await client.query(
        `UPDATE event_registrations
         SET status = 'cancelled',
             cancellation_reason = $1,
             cancelled_at = NOW()
         WHERE registration_id = $2`,
        [cancellationReason, registrationId]
      );

      // Decrement participant count
      await client.query(
        `UPDATE community_events
         SET current_participants = GREATEST(0, current_participants - 1)
         WHERE event_id = $1`,
        [registration.event_id]
      );

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserRegistrations(userId, filters) {
    const conditions = ["er.user_id = $1"];
    const params = [userId];
    let paramCount = 2;

    if (filters.status) {
      conditions.push(`er.status = $${paramCount}`);
      params.push(filters.status);
      paramCount++;
    }

    if (filters.upcoming) {
      conditions.push(`ce.event_date >= CURRENT_DATE`);
    }

    const offset = (filters.page - 1) * filters.limit;

    const query = `
      SELECT
        er.*,
        ce.title as event_title,
        ce.event_date,
        ce.event_time,
        ce.location_name,
        ce.event_type,
        p.name as pet_name,
        p.photo_url as pet_photo
      FROM event_registrations er
      JOIN community_events ce ON er.event_id = ce.event_id
      JOIN pets p ON er.pet_id = p.pet_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ce.event_date DESC, ce.event_time DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(filters.limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM event_registrations er
      JOIN community_events ce ON er.event_id = ce.event_id
      WHERE ${conditions.join(" AND ")}
    `;
    const countResult = await pool.query(
      countQuery,
      params.slice(0, paramCount - 1)
    );

    return {
      registrations: result.rows,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / filters.limit),
      },
    };
  }

  async submitFeedback(registrationId, userId, rating, feedbackText) {
    const query = `
      UPDATE event_registrations
      SET feedback_rating = $1,
          feedback_text = $2
      WHERE registration_id = $3 AND user_id = $4
      AND status = 'attended'
      RETURNING *
    `;

    const result = await pool.query(query, [
      rating,
      feedbackText,
      registrationId,
      userId,
    ]);

    if (result.rows.length === 0) {
      throw new AppError(
        "Registration not found or not eligible for feedback",
        404,
        "REGISTRATION_NOT_FOUND"
      );
    }

    return result.rows[0];
  }

  async joinWaitlist(eventId, userId, petId, specialRequirements) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get event
      const eventResult = await client.query(
        "SELECT * FROM community_events WHERE event_id = $1",
        [eventId]
      );

      if (eventResult.rows.length === 0) {
        throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      const event = eventResult.rows[0];

      if (!event.waitlist_enabled) {
        throw new AppError(
          "Waitlist not enabled for this event",
          400,
          "WAITLIST_DISABLED"
        );
      }

      // Check if already on waitlist
      const existingWaitlist = await client.query(
        `SELECT registration_id FROM event_registrations
         WHERE event_id = $1 AND user_id = $2 AND pet_id = $3
         AND registration_type = 'waitlist' AND status = 'registered'`,
        [eventId, userId, petId]
      );

      if (existingWaitlist.rows.length > 0) {
        throw new AppError(
          "Already on waitlist",
          409,
          "ALREADY_ON_WAITLIST"
        );
      }

      // Verify pet ownership
      const petCheck = await client.query(
        "SELECT pet_id FROM pets WHERE pet_id = $1 AND owner_id = $2",
        [petId, userId]
      );

      if (petCheck.rows.length === 0) {
        throw new AppError("Pet not found", 404, "PET_NOT_FOUND");
      }

      // Add to waitlist
      const insertQuery = `
        INSERT INTO event_registrations (
          event_id, user_id, pet_id, registration_type, status,
          special_requirements, payment_required, payment_status
        ) VALUES ($1, $2, $3, 'waitlist', 'registered', $4, $5, NULL)
        RETURNING *
      `;

      const regResult = await client.query(insertQuery, [
        eventId,
        userId,
        petId,
        specialRequirements || null,
        !event.is_free,
      ]);

      // Increment waitlist count
      await client.query(
        `UPDATE community_events
         SET waitlist_count = waitlist_count + 1
         WHERE event_id = $1`,
        [eventId]
      );

      await client.query("COMMIT");
      return regResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new CommunityService();