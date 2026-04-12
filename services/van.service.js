// ============================================
// FILE: services/van.service.js
// Zone-based van scheduling for Pune
// ============================================
//
// ZONE DAY MAPPING:
//   Zone A -> Monday    (Wakad, Pimple Saudagar, Punawale, Ravet, Kiwale)
//   Zone B -> Tuesday   (Baner, Balewadi, Aundh, Pashan, Bavdhan)
//   Zone C -> Wednesday (Kothrud, Karve Nagar, Warje, Deccan)
//   Zone D -> Thursday  (Viman Nagar, Kharadi, Koregaon Park, Magarpatta)
//   Zone E -> Friday    (NIBM, Kondhwa, Wanowrie, Camp, Shivajinagar)
//
// Max 6 bookings per zone per day. Overflow → next occurrence of same day-of-week.
//
// Cancellation flow:
//   User cancels → status = 'pending_admin_approval'
//   Admin approves → booking cancelled, slot freed, refund initiated, waitlist checked
//   Admin rejects  → booking restored to original status
// ============================================

const { pool } = require('../config/database');
const { AppError } = require('../utils/response.util');
const notificationService = require('./notification.service');

const MAX_BOOKINGS_PER_ZONE_DAY = 6;

// Day-of-week number for each zone (JS Date: 0=Sun, 1=Mon...6=Sat → we use 1=Mon...5=Fri)
const ZONE_DAY_OF_WEEK = {
  A: 1, // Monday
  B: 2, // Tuesday
  C: 3, // Wednesday
  D: 4, // Thursday
  E: 5  // Friday
};

class VanService {

  // ============================================
  // ZONE LOOKUP
  // ============================================

  /**
   * Determine the zone for a given customer address.
   * Falls back to null if not in any zone.
   */
  async getZoneForAddress(addressId) {
    const result = await pool.query(
      `SELECT zpm.zone, zpm.day_of_week, zpm.area_name
       FROM user_addresses ua
       JOIN zone_pincode_map zpm ON zpm.pincode = ua.pincode
       WHERE ua.address_id = $1`,
      [addressId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find the next available date for a zone that still has capacity.
   * Returns a YYYY-MM-DD string.
   * 
   * @param {string} zone - 'A','B','C','D','E'
   * @param {string|null} fromDateStr - optional start date (YYYY-MM-DD), defaults to today
   */
  async getNextAvailableZoneDate(zone, fromDateStr = null) {
    const targetDow = ZONE_DAY_OF_WEEK[zone]; // 1=Mon ... 5=Fri
    if (!targetDow) throw new AppError(`Unknown zone: ${zone}`, 400);

    const from = fromDateStr ? new Date(fromDateStr) : new Date();
    from.setHours(0, 0, 0, 0);

    // Iterate at most 52 weeks ahead
    for (let week = 0; week < 52; week++) {
      const candidate = new Date(from);

      // Number of days until the target day-of-week
      // JS getDay(): 0=Sun,1=Mon,...
      // Our targetDow: 1=Mon,...,5=Fri → same scale
      const currentDow = candidate.getDay() === 0 ? 7 : candidate.getDay(); // make Sun=7
      let daysAhead = targetDow - currentDow;
      if (week === 0 && daysAhead < 0) daysAhead += 7;  // already passed this week
      if (week === 0 && daysAhead === 0) daysAhead = 0;  // same day
      if (week > 0) daysAhead += 7 * week;               // subsequent weeks
      else if (daysAhead < 0) daysAhead += 7;

      candidate.setDate(candidate.getDate() + daysAhead);

      // Re-compute for week > 0
      if (week > 0) {
        const base = new Date(from);
        const baseDow = base.getDay() === 0 ? 7 : base.getDay();
        let d = targetDow - baseDow;
        if (d <= 0) d += 7;
        base.setDate(base.getDate() + d + (week - 1) * 7);
        candidate.setTime(base.getTime());
      }

      const dateStr = candidate.toISOString().split('T')[0];

      // Count confirmed (non-cancelled) grooming bookings for this zone+date
      const countResult = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM bookings
         WHERE zone = $1
           AND booking_date = $2
           AND (cancellation_status IS NULL OR cancellation_status NOT IN ('approved'))
           AND cancelled_at IS NULL`,
        [zone, dateStr]
      );

      const count = parseInt(countResult.rows[0].cnt);
      if (count < MAX_BOOKINGS_PER_ZONE_DAY) {
        return { date: dateStr, slotsUsed: count, slotsRemaining: MAX_BOOKINGS_PER_ZONE_DAY - count };
      }
    }

    throw new AppError('No available zone slots found in the next 52 weeks', 503);
  }

  /**
   * Assign a booking to its zone-based schedule date.
   * Called after a grooming booking is created.
   * Updates bookings.zone and bookings.booking_date.
   */
  async assignBookingToZoneSlot(addressId, bookingId) {
    const zoneInfo = await this.getZoneForAddress(addressId);
    if (!zoneInfo) {
      console.log(`[VanService] Address ${addressId} is not in any zone. No zone scheduling.`);
      return null;
    }

    const { zone } = zoneInfo;
    const { date } = await this.getNextAvailableZoneDate(zone);

    // Assign time slot: each booking gets a 90-min window starting at 09:00
    const slotCount = await this._getZoneSlotCountForDate(zone, date);
    const startMinutes = 9 * 60 + slotCount * 100; // 09:00, 10:40, 12:20...
    const hours = Math.floor(startMinutes / 60);
    const mins = startMinutes % 60;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;

    await pool.query(
      `UPDATE bookings
       SET zone = $1,
           booking_date = $2,
           booking_time = $3,
           updated_at = NOW()
       WHERE booking_id = $4`,
      [zone, date, timeStr, bookingId]
    );

    console.log(`[VanService] Booking ${bookingId} assigned to Zone ${zone} on ${date} at ${timeStr}`);
    return { zone, date, time: timeStr };
  }

  async _getZoneSlotCountForDate(zone, date) {
    const result = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM bookings
       WHERE zone = $1 AND booking_date = $2
         AND (cancellation_status IS NULL OR cancellation_status NOT IN ('approved'))
         AND cancelled_at IS NULL`,
      [zone, date]
    );
    return parseInt(result.rows[0].cnt);
  }

  // ============================================
  // ZONE CAPACITY OVERVIEW
  // ============================================

  /**
   * Return capacity info for all zones for the next N occurrences of each day.
   */
  async getZoneCapacity(weeksAhead = 4) {
    const zones = ['A', 'B', 'C', 'D', 'E'];
    const result = {};

    for (const zone of zones) {
      result[zone] = {
        zone,
        dayOfWeek: ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][ZONE_DAY_OF_WEEK[zone]],
        slots: []
      };

      let from = null;
      for (let i = 0; i < weeksAhead; i++) {
        try {
          const info = await this.getNextAvailableZoneDate(zone, from);
          result[zone].slots.push({
            date: info.date,
            slotsUsed: info.slotsUsed,
            slotsRemaining: info.slotsRemaining,
            isFull: info.slotsRemaining === 0
          });

          // Advance from to the day AFTER this date so we get the next occurrence
          const next = new Date(info.date);
          next.setDate(next.getDate() + 1);
          from = next.toISOString().split('T')[0];
        } catch {
          break;
        }
      }
    }

    return result;
  }

  // ============================================
  // CANCELLATION WORKFLOW
  // ============================================

  /**
   * User requests cancellation — sets pending_admin_approval status.
   */
  async requestCancellation(bookingId, userId, reason) {
    const bookingResult = await pool.query(
      `SELECT b.*, bs.status_code
       FROM bookings b
       JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
       WHERE b.booking_id = $1 AND b.user_id = $2`,
      [bookingId, userId]
    );

    if (bookingResult.rows.length === 0) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    const booking = bookingResult.rows[0];

    if (booking.status_code === 'completed') {
      throw new AppError('Cannot cancel a completed booking', 400, 'BOOKING_COMPLETED');
    }

    if (booking.cancellation_status === 'pending_admin_approval') {
      throw new AppError('A cancellation request is already pending for this booking', 400, 'CANCEL_ALREADY_PENDING');
    }

    await pool.query(
      `UPDATE bookings
       SET cancellation_status = 'pending_admin_approval',
           cancellation_reason = $1,
           cancelled_by_user_at = NOW(),
           updated_at = NOW()
       WHERE booking_id = $2`,
      [reason, bookingId]
    );

    return { success: true, status: 'pending_admin_approval', message: 'Your cancellation request has been submitted. Our team will review it shortly.' };
  }

  /**
   * Admin approves cancellation.
   * - Marks booking as cancelled
   * - Frees the slot
   * - Tries to refill from any pending bookings in same zone on same date (waitlist)
   */
  async approveCancellation(bookingId, adminNote = null, externalClient = null) {
    const client = externalClient || await pool.connect();
    try {
      if (!externalClient) await client.query('BEGIN');

      const bookingResult = await client.query(
        `SELECT b.*, bs.status_code
         FROM bookings b
         JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
         WHERE b.booking_id = $1`,
        [bookingId]
      );

      if (bookingResult.rows.length === 0) throw new AppError('Booking not found', 404);
      const booking = bookingResult.rows[0];

      if (booking.cancellation_status !== 'pending_admin_approval') {
        throw new AppError('No pending cancellation request for this booking', 400);
      }

      // Get cancelled status
      const cancelledStatus = await client.query(
        `SELECT status_id FROM booking_statuses_ref WHERE status_code = 'cancelled'`
      );
      const cancelledStatusId = cancelledStatus.rows[0].status_id;

      // Mark as cancelled
      await client.query(
        `UPDATE bookings
         SET status_id = $1,
             cancellation_status = 'approved',
             cancellation_admin_note = $2,
             cancelled_at = NOW(),
             updated_at = NOW()
         WHERE booking_id = $3`,
        [cancelledStatusId, adminNote, bookingId]
      );

      // Try to refill the freed slot
      const refillResult = await this._tryRefillZoneSlot(booking.zone, booking.booking_date, client);

      if (!externalClient) await client.query('COMMIT');

      return {
        success: true,
        bookingId,
        refillAttempted: !!booking.zone,
        refillResult
      };
    } catch (error) {
      if (!externalClient) await client.query('ROLLBACK');
      throw error;
    } finally {
      if (!externalClient) client.release();
    }
  }

  /**
   * Admin rejects cancellation — booking is restored.
   */
  async rejectCancellation(bookingId, adminNote = null) {
    const result = await pool.query(
      `UPDATE bookings
       SET cancellation_status = 'rejected',
           cancellation_admin_note = $1,
           updated_at = NOW()
       WHERE booking_id = $2
         AND cancellation_status = 'pending_admin_approval'
       RETURNING *`,
      [adminNote, bookingId]
    );

    if (result.rows.length === 0) {
      throw new AppError('No pending cancellation found for this booking', 404);
    }

    return { success: true, booking: result.rows[0] };
  }

  /**
   * Try to pull in a booking from the waitlist (zone + same day) to fill a freed slot.
   * A "waitlist" booking is one that has zone = null (not yet assigned a date) 
   * or is scheduled for a future date on the same zone.
   * We look for the earliest pending booking in the same zone that is on a later date
   * and reschedule it to fill this slot.
   */
  async _tryRefillZoneSlot(zone, freedDate, client) {
    if (!zone || !freedDate) return null;

    // Find next-in-line booking for same zone that is scheduled AFTER this date
    const waitlistResult = await client.query(
      `SELECT b.booking_id, b.booking_time, b.user_id
       FROM bookings b
       JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
       WHERE b.zone = $1
         AND b.booking_date > $2
         AND bs.status_code NOT IN ('cancelled', 'completed')
         AND (b.cancellation_status IS NULL OR b.cancellation_status = 'rejected')
       ORDER BY b.booking_date ASC, b.booking_time ASC
       LIMIT 1`,
      [zone, freedDate]
    );

    if (waitlistResult.rows.length === 0) {
      console.log(`[VanService] No waitlist booking found for Zone ${zone} after ${freedDate}`);
      return null;
    }

    const waitlistBooking = waitlistResult.rows[0];

    // Count current bookings on the freed date to assign a time slot
    const slotCount = await this._getZoneSlotCountForDate(zone, freedDate, client);
    const startMinutes = 9 * 60 + slotCount * 100;
    const hours = Math.floor(startMinutes / 60);
    const mins = startMinutes % 60;
    const newTimeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;

    // Reschedule it to the freed date
    await client.query(
      `UPDATE bookings
       SET booking_date = $1,
           booking_time = $2,
           updated_at = NOW()
       WHERE booking_id = $3`,
      [freedDate, newTimeStr, waitlistBooking.booking_id]
    );

    // Notify customer about the new earlier date
    try {
      await notificationService.sendTemplateNotification(
        waitlistBooking.user_id,
        'booking_rescheduled',
        { date: freedDate, time: newTimeStr },
        'push'
      );
    } catch (notifErr) {
      console.warn(`[VanService] Could not notify user on refill: ${notifErr.message}`);
    }

    console.log(`[VanService] Refilled Zone ${zone} slot on ${freedDate} with booking ${waitlistBooking.booking_id}`);
    return { rescheduledBookingId: waitlistBooking.booking_id, newDate: freedDate, newTime: newTimeStr };
  }

  async _getZoneSlotCountForDate(zone, date, client = null) {
    const db = client || pool;
    const result = await db.query(
      `SELECT COUNT(*) AS cnt
       FROM bookings
       WHERE zone = $1 AND booking_date = $2
         AND (cancellation_status IS NULL OR cancellation_status NOT IN ('approved'))
         AND cancelled_at IS NULL`,
      [zone, date]
    );
    return parseInt(result.rows[0].cnt);
  }

  // ============================================
  // ADMIN VIEWS
  // ============================================

  /**
   * Get pending cancellation requests (for admin dashboard).
   */
  async getPendingCancellations() {
    const result = await pool.query(
      `SELECT 
         b.booking_id,
         b.booking_number,
         b.zone,
         b.booking_date,
         b.booking_time,
         b.cancellation_reason,
         b.cancelled_by_user_at,
         b.base_amount,
         b.total_amount,
         b.payment_status,
         u.full_name  AS customer_name,
         u.phone      AS customer_phone,
         p.name       AS pet_name,
         sc.service_name,
         bs.status_name
       FROM bookings b
       JOIN users u              ON b.user_id      = u.user_id
       JOIN pets p               ON b.pet_id       = p.pet_id
       JOIN service_catalog sc   ON b.service_id   = sc.service_id
       JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
       WHERE b.cancellation_status = 'pending_admin_approval'
       ORDER BY b.cancelled_by_user_at ASC`
    );
    return result.rows;
  }

  // ============================================
  // LEGACY: Van management (kept for admin use)
  // ============================================

  async createVan(data) {
    const { van_number, van_name, registration_number, zone, start_location_lat, start_location_lng } = data;
    const result = await pool.query(
      `INSERT INTO vans (van_number, van_name, registration_number, zone, start_location_lat, start_location_lng)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        van_number, van_name, registration_number,
        zone || null,
        start_location_lat || 18.5314,
        start_location_lng || 73.8446
      ]
    );
    return result.rows[0];
  }

  async getVans(date = null) {
    if (date) {
      const result = await pool.query(
        `SELECT v.*, vs.schedule_id, vs.status AS schedule_status, vs.start_time, vs.end_time,
                (SELECT COUNT(*) FROM bookings WHERE zone = v.zone AND booking_date = $1
                  AND cancelled_at IS NULL AND (cancellation_status IS NULL OR cancellation_status != 'approved')
                ) AS booking_count
         FROM vans v
         LEFT JOIN van_schedules vs ON v.van_id = vs.van_id AND vs.schedule_date = $1
         WHERE v.is_active = true ORDER BY v.van_number`,
        [date]
      );
      return result.rows;
    }
    const result = await pool.query('SELECT * FROM vans WHERE is_active = true ORDER BY van_number');
    return result.rows;
  }

  async createVanSchedule(vanId, date, startTime = '09:00:00', endTime = '18:00:00') {
    const result = await pool.query(
      `INSERT INTO van_schedules (van_id, schedule_date, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (van_id, schedule_date) DO UPDATE
       SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, updated_at = NOW()
       RETURNING *`,
      [vanId, date, startTime, endTime]
    );
    return result.rows[0];
  }

  async getScheduleAssignments(scheduleId) {
    const result = await pool.query(
      `SELECT b.booking_id, b.booking_number, b.booking_date, b.booking_time,
              b.zone, b.total_amount, u.full_name AS customer_name, u.phone AS customer_phone,
              p.name AS pet_name, sc.service_name
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       JOIN pets  p ON b.pet_id  = p.pet_id
       JOIN service_catalog sc ON b.service_id = sc.service_id
       JOIN van_schedules vs ON b.zone = vs.van_id   -- link by zone when schedule is zone-based
       WHERE vs.schedule_id = $1
       ORDER BY b.booking_time ASC`,
      [scheduleId]
    );
    return result.rows;
  }
}

module.exports = new VanService();
