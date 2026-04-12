// ============================================
// FILE: controllers/van.controller.js
// Van routing and scheduling controller
// Zone-based system
// ============================================

const vanService = require('../services/van.service');
const ResponseUtil = require('../utils/response.util');

class VanController {

  // ============================================
  // ZONE CAPACITY
  // ============================================

  /**
   * GET /van/zone-capacity
   * Returns slots available per zone per upcoming day.
   */
  async getZoneCapacity(req, res, next) {
    try {
      const weeksAhead = parseInt(req.query.weeks_ahead) || 4;
      const capacity = await vanService.getZoneCapacity(weeksAhead);
      return ResponseUtil.success(res, capacity, 'Zone capacity retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // CANCELLATION WORKFLOW (Admin)
  // ============================================

  /**
   * GET /van/pending-cancellations
   * Admin: list all bookings with pending_admin_approval cancellations.
   */
  async getPendingCancellations(req, res, next) {
    try {
      const cancellations = await vanService.getPendingCancellations();
      return ResponseUtil.success(
        res,
        { cancellations, count: cancellations.length },
        'Pending cancellations retrieved'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /van/bookings/:booking_id/approve-cancellation
   * Admin: approve the cancellation → frees slot, triggers refill.
   */
  async approveCancellation(req, res, next) {
    try {
      const { booking_id } = req.params;
      const { admin_note } = req.body;
      const result = await vanService.approveCancellation(booking_id, admin_note);
      return ResponseUtil.success(res, result, 'Booking cancellation approved. Slot freed and waitlist checked.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /van/bookings/:booking_id/reject-cancellation
   * Admin: reject the cancellation → booking restored.
   */
  async rejectCancellation(req, res, next) {
    try {
      const { booking_id } = req.params;
      const { admin_note } = req.body;
      const result = await vanService.rejectCancellation(booking_id, admin_note);
      return ResponseUtil.success(res, result, 'Booking cancellation rejected. Booking has been restored.');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // VAN MANAGEMENT
  // ============================================

  async createVan(req, res, next) {
    try {
      const van = await vanService.createVan(req.body);
      return ResponseUtil.success(res, van, 'Van created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getVans(req, res, next) {
    try {
      const { date } = req.query;
      const vans = await vanService.getVans(date);
      return ResponseUtil.success(res, { vans }, 'Vans retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createSchedule(req, res, next) {
    try {
      const { van_id, date, start_time, end_time } = req.body;
      const schedule = await vanService.createVanSchedule(van_id, date, start_time, end_time);
      return ResponseUtil.success(res, schedule, 'Van schedule created/updated successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getScheduleAssignments(req, res, next) {
    try {
      const { schedule_id } = req.params;
      const assignments = await vanService.getScheduleAssignments(schedule_id);
      return ResponseUtil.success(res, { assignments }, 'Schedule assignments retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new VanController();
