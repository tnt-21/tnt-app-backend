// ============================================
// FILE: services/support.service.js
// Support Tickets Service
// ============================================

const { pool } = require("../config/database");
const { AppError } = require("../utils/response.util");

class SupportService {
  // ==================== TICKETS ====================

  async createTicket(ticketData) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const {
        user_id,
        subject,
        description,
        category,
        subcategory,
        priority,
        channel,
        booking_id,
        subscription_id,
        pet_id,
        attachments,
      } = ticketData;

      // Generate ticket number
      const ticketNumber = await this.generateTicketNumber();

      // Calculate SLA due date based on priority
      const slaDueDate = this.calculateSLADueDate(priority || "medium");

      const query = `
        INSERT INTO support_tickets (
          ticket_number, user_id, subject, description,
          category, subcategory, priority, status, channel,
          booking_id, subscription_id, pet_id, attachments, sla_due_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;

      const result = await client.query(query, [
        ticketNumber,
        user_id,
        subject,
        description,
        category || "inquiry",
        subcategory || null,
        priority || "medium",
        "open",
        channel || "app",
        booking_id || null,
        subscription_id || null,
        pet_id || null,
        attachments ? JSON.stringify(attachments) : null,
        slaDueDate,
      ]);

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserTickets(userId, filters) {
    const conditions = ["user_id = $1"];
    const params = [userId];
    let paramCount = 2;

    if (filters.status) {
      conditions.push(`status = $${paramCount}`);
      params.push(filters.status);
      paramCount++;
    }

    if (filters.category) {
      conditions.push(`category = $${paramCount}`);
      params.push(filters.category);
      paramCount++;
    }

    if (filters.priority) {
      conditions.push(`priority = $${paramCount}`);
      params.push(filters.priority);
      paramCount++;
    }

    const offset = (filters.page - 1) * filters.limit;

    const query = `
      SELECT
        st.*,
        (SELECT COUNT(*)
         FROM ticket_messages tm
         WHERE tm.ticket_id = st.ticket_id
         AND tm.sender_type = 'admin'
         AND tm.is_read = false) as unread_messages
      FROM support_tickets st
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        CASE
          WHEN status = 'open' THEN 1
          WHEN status = 'in_progress' THEN 2
          WHEN status = 'waiting_customer' THEN 3
          WHEN status = 'resolved' THEN 4
          ELSE 5
        END,
        created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(filters.limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM support_tickets
      WHERE ${conditions.join(" AND ")}
    `;
    const countResult = await pool.query(
      countQuery,
      params.slice(0, paramCount - 1)
    );

    return {
      tickets: result.rows,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / filters.limit),
      },
    };
  }

  async getTicketById(ticketId, userId) {
    const query = `
      SELECT
        st.*,
        u.full_name as user_name,
        u.phone as user_phone,
        u.email as user_email,
        au.full_name as assigned_to_name,
        (SELECT COUNT(*)
         FROM ticket_messages tm
         WHERE tm.ticket_id = st.ticket_id) as total_messages,
        (SELECT COUNT(*)
         FROM ticket_messages tm
         WHERE tm.ticket_id = st.ticket_id
         AND tm.sender_type = 'admin'
         AND tm.is_read = false) as unread_messages
      FROM support_tickets st
      JOIN users u ON st.user_id = u.user_id
      LEFT JOIN admin_users au ON st.assigned_to = au.admin_id
      WHERE st.ticket_id = $1 AND st.user_id = $2
    `;

    const result = await pool.query(query, [ticketId, userId]);

    if (result.rows.length === 0) {
      throw new AppError("Ticket not found", 404, "TICKET_NOT_FOUND");
    }

    return result.rows[0];
  }

  async addMessage(ticketId, userId, message, attachments) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verify ticket ownership
      const ticketCheck = await client.query(
        "SELECT status FROM support_tickets WHERE ticket_id = $1 AND user_id = $2",
        [ticketId, userId]
      );

      if (ticketCheck.rows.length === 0) {
        throw new AppError("Ticket not found", 404, "TICKET_NOT_FOUND");
      }

      const ticket = ticketCheck.rows[0];

      if (ticket.status === "closed") {
        throw new AppError(
          "Cannot add messages to closed ticket",
          400,
          "TICKET_CLOSED"
        );
      }

      // Insert message
      const insertQuery = `
        INSERT INTO ticket_messages (
          ticket_id, sender_id, sender_type, message, attachments
        ) VALUES ($1, $2, 'customer', $3, $4)
        RETURNING *
      `;

      const msgResult = await client.query(insertQuery, [
        ticketId,
        userId,
        message,
        attachments ? JSON.stringify(attachments) : null,
      ]);

      // Update ticket status if it was waiting_customer
      if (ticket.status === "waiting_customer") {
        await client.query(
          `UPDATE support_tickets
           SET status = 'in_progress', updated_at = NOW()
           WHERE ticket_id = $1`,
          [ticketId]
        );
      } else {
        await client.query(
          `UPDATE support_tickets
           SET updated_at = NOW()
           WHERE ticket_id = $1`,
          [ticketId]
        );
      }

      await client.query("COMMIT");
      return msgResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getTicketMessages(ticketId, userId) {
    // Verify ticket ownership
    const ticketCheck = await pool.query(
      "SELECT ticket_id FROM support_tickets WHERE ticket_id = $1 AND user_id = $2",
      [ticketId, userId]
    );

    if (ticketCheck.rows.length === 0) {
      throw new AppError("Ticket not found", 404, "TICKET_NOT_FOUND");
    }

    const query = `
      SELECT
        tm.*,
        u.full_name as sender_name,
        u.profile_photo_url as sender_photo
      FROM ticket_messages tm
      JOIN users u ON tm.sender_id = u.user_id
      WHERE tm.ticket_id = $1 AND tm.is_internal = false
      ORDER BY tm.created_at ASC
    `;

    const result = await pool.query(query, [ticketId]);

    // Mark admin messages as read
    await pool.query(
      `UPDATE ticket_messages
       SET is_read = true, read_at = NOW()
       WHERE ticket_id = $1 AND sender_type = 'admin' AND is_read = false`,
      [ticketId]
    );

    return result.rows;
  }

  async closeTicket(ticketId, userId, rating, feedback) {
    const query = `
      UPDATE support_tickets
      SET status = 'closed',
          closed_at = NOW(),
          customer_satisfaction_rating = $1,
          customer_feedback = $2,
          updated_at = NOW()
      WHERE ticket_id = $3 AND user_id = $4
      AND status NOT IN ('closed')
      RETURNING *
    `;

    const result = await pool.query(query, [
      rating || null,
      feedback || null,
      ticketId,
      userId,
    ]);

    if (result.rows.length === 0) {
      throw new AppError(
        "Ticket not found or already closed",
        404,
        "TICKET_NOT_FOUND"
      );
    }

    return result.rows[0];
  }

  async reopenTicket(ticketId, userId, reason) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const query = `
        UPDATE support_tickets
        SET status = 'reopened',
            updated_at = NOW()
        WHERE ticket_id = $1 AND user_id = $2
        AND status = 'closed'
        RETURNING *
      `;

      const result = await client.query(query, [ticketId, userId]);

      if (result.rows.length === 0) {
        throw new AppError(
          "Ticket not found or not closed",
          404,
          "TICKET_NOT_FOUND"
        );
      }

      // Add system message about reopening
      await client.query(
        `INSERT INTO ticket_messages (
          ticket_id, sender_id, sender_type, message
        ) VALUES ($1, $2, 'customer', $3)`,
        [ticketId, userId, `Ticket reopened: ${reason}`]
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

  async getTicketCategories() {
    return [
      { code: "technical", name: "Technical Issue" },
      { code: "billing", name: "Billing & Payments" },
      { code: "service_quality", name: "Service Quality" },
      { code: "complaint", name: "Complaint" },
      { code: "inquiry", name: "General Inquiry" },
      { code: "feedback", name: "Feedback" },
    ];
  }

  // ==================== ADMINISTRATIVE METHODS ====================

  async getAllTicketsGlobal(filters) {
    const conditions = ["1=1"];
    const params = [];
    let paramCount = 1;

    if (filters.status) {
      conditions.push(`st.status = $${paramCount}`);
      params.push(filters.status);
      paramCount++;
    }

    if (filters.category) {
      conditions.push(`st.category = $${paramCount}`);
      params.push(filters.category);
      paramCount++;
    }

    if (filters.priority) {
      conditions.push(`st.priority = $${paramCount}`);
      params.push(filters.priority);
      paramCount++;
    }

    if (filters.assigned_to) {
      conditions.push(`st.assigned_to = $${paramCount}`);
      params.push(filters.assigned_to);
      paramCount++;
    }

    if (filters.search) {
      conditions.push(
        `(st.ticket_number ILIKE $${paramCount} OR st.subject ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount})`
      );
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    const { page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const query = `
      SELECT
        st.*,
        u.full_name as user_name,
        u.email as user_email,
        au.full_name as assigned_to_name
      FROM support_tickets st
      JOIN users u ON st.user_id = u.user_id
      LEFT JOIN admin_users au ON st.assigned_to = au.admin_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY st.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM support_tickets st
      JOIN users u ON st.user_id = u.user_id
      WHERE ${conditions.join(" AND ")}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, paramCount - 1));

    return {
      tickets: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
      },
    };
  }

  async getTicketDetailsAdmin(ticketId) {
    const query = `
      SELECT
        st.*,
        u.full_name as user_name,
        u.phone as user_phone,
        u.email as user_email,
        au.full_name as assigned_to_name,
        b.booking_number,
        s.subscription_id as sub_number,
        p.name as pet_name
      FROM support_tickets st
      JOIN users u ON st.user_id = u.user_id
      LEFT JOIN admin_users au ON st.assigned_to = au.admin_id
      LEFT JOIN bookings b ON st.booking_id = b.booking_id
      LEFT JOIN subscriptions s ON st.subscription_id = s.subscription_id
      LEFT JOIN pets p ON st.pet_id = p.pet_id
      WHERE st.ticket_id = $1
    `;

    const result = await pool.query(query, [ticketId]);

    if (result.rows.length === 0) {
      throw new AppError("Ticket not found", 404, "TICKET_NOT_FOUND");
    }

    return result.rows[0];
  }

  async updateTicketStatus(ticketId, status, resolutionNotes, adminId) {
    const updates = ["status = $1", "updated_at = NOW()"];
    const params = [status, ticketId];

    if (resolutionNotes) {
      updates.push("resolution_notes = $3");
      params.push(resolutionNotes);
    }

    if (status === "resolved") {
      updates.push("resolved_at = NOW()");
    } else if (status === "closed") {
      updates.push("closed_at = NOW()");
    }

    const query = `
      UPDATE support_tickets
      SET ${updates.join(", ")}
      WHERE ticket_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      throw new AppError("Ticket not found", 404, "TICKET_NOT_FOUND");
    }

    return result.rows[0];
  }

  async assignTicket(ticketId, adminId) {
    const query = `
      UPDATE support_tickets
      SET assigned_to = $1,
          assigned_at = NOW(),
          updated_at = NOW()
      WHERE ticket_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [adminId, ticketId]);

    if (result.rows.length === 0) {
      throw new AppError("Ticket not found", 404, "TICKET_NOT_FOUND");
    }

    return result.rows[0];
  }

  async addAdminMessage(ticketId, adminId, userId, message, attachments, isInternal) {
    const query = `
      INSERT INTO ticket_messages (
        ticket_id, sender_id, sender_type, message, attachments, is_internal
      ) VALUES ($1, $2, 'admin', $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(query, [
      ticketId,
      userId, // We use the user_id associated with the admin
      message,
      attachments ? JSON.stringify(attachments) : null,
      isInternal || false,
    ]);

    // Update ticket's first_response_at if not set and message is not internal
    if (!isInternal) {
      await pool.query(
        `UPDATE support_tickets
         SET first_response_at = COALESCE(first_response_at, NOW()),
             status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
             updated_at = NOW()
         WHERE ticket_id = $1`,
        [ticketId]
      );
    }

    return result.rows[0];
  }

  async getSupportMetrics() {
    const query = `
      SELECT
        COUNT(*) as total_tickets,
        COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tickets,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_tickets,
        COUNT(*) FILTER (WHERE priority = 'high' OR priority = 'urgent') as high_priority_tickets,
        AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/3600)::NUMERIC(10,2) as avg_response_time_hours,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)::NUMERIC(10,2) as avg_resolution_time_hours
      FROM support_tickets;
    `;

    const result = await pool.query(query);
    return result.rows[0];
  }

  async getAdminMessages(ticketId) {
    const query = `
      SELECT
        tm.*,
        u.full_name as sender_name,
        u.profile_photo_url as sender_photo
      FROM ticket_messages tm
      JOIN users u ON tm.sender_id = u.user_id
      WHERE tm.ticket_id = $1
      ORDER BY tm.created_at ASC
    `;

    const result = await pool.query(query, [ticketId]);
    return result.rows;
  }
}

module.exports = new SupportService();