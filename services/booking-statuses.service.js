const { pool } = require('../config/database');

class BookingStatusesService {
  /**
   * Get all booking statuses
   */
  async getAll() {
    const query = `
      SELECT * FROM booking_statuses_ref
      ORDER BY status_id ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get status by ID
   */
  async getById(id) {
    const result = await pool.query(
      'SELECT * FROM booking_statuses_ref WHERE status_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Booking status not found');
    }
    
    return result.rows[0];
  }

  /**
   * Create new status
   */
  async create(data) {
    const { 
      status_code, 
      status_name, 
      status_type, 
      display_color, 
      allow_cancellation = true, 
      allow_reschedule = true, 
      is_active = true 
    } = data;

    // Check if code already exists
    const existing = await pool.query(
      'SELECT status_id FROM booking_statuses_ref WHERE status_code = $1',
      [status_code]
    );

    if (existing.rows.length > 0) {
      throw new Error('Status code already exists');
    }

    const result = await pool.query(
      `INSERT INTO booking_statuses_ref 
       (status_code, status_name, status_type, display_color, allow_cancellation, allow_reschedule, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        status_code, 
        status_name, 
        status_type || null, 
        display_color || '#000000', 
        allow_cancellation, 
        allow_reschedule, 
        is_active
      ]
    );

    return result.rows[0];
  }

  /**
   * Update status
   */
  async update(id, data) {
    const { 
      status_code, 
      status_name, 
      status_type, 
      display_color, 
      allow_cancellation, 
      allow_reschedule, 
      is_active 
    } = data;

    // Check if exists
    await this.getById(id);

    // Check code conflict
    if (status_code) {
      const existing = await pool.query(
        'SELECT status_id FROM booking_statuses_ref WHERE status_code = $1 AND status_id != $2',
        [status_code, id]
      );

      if (existing.rows.length > 0) {
        throw new Error('Status code already exists');
      }
    }

    const result = await pool.query(
      `UPDATE booking_statuses_ref 
       SET status_code = COALESCE($1, status_code),
           status_name = COALESCE($2, status_name),
           status_type = COALESCE($3, status_type),
           display_color = COALESCE($4, display_color),
           allow_cancellation = COALESCE($5, allow_cancellation),
           allow_reschedule = COALESCE($6, allow_reschedule),
           is_active = COALESCE($7, is_active)
       WHERE status_id = $8
       RETURNING *`,
      [
        status_code, 
        status_name, 
        status_type, 
        display_color, 
        allow_cancellation, 
        allow_reschedule, 
        is_active, 
        id
      ]
    );

    return result.rows[0];
  }

  /**
   * Delete status
   */
  async delete(id) {
    await this.getById(id);

    // Check if in use (bookings table)
    const bookings = await pool.query(
      'SELECT COUNT(*) FROM bookings WHERE status_id = $1',
      [id]
    );

    if (parseInt(bookings.rows[0].count) > 0) {
      throw new Error('Cannot delete status as it is associated with one or more bookings');
    }

    await pool.query('DELETE FROM booking_statuses_ref WHERE status_id = $1', [id]);
    return { success: true, message: 'Booking status deleted successfully' };
  }

  /**
   * Toggle active status
   */
  async toggleActive(id, isActive) {
    const result = await pool.query(
      `UPDATE booking_statuses_ref 
       SET is_active = $1
       WHERE status_id = $2
       RETURNING *`,
      [isActive, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Booking status not found');
    }

    return result.rows[0];
  }
}

module.exports = new BookingStatusesService();
