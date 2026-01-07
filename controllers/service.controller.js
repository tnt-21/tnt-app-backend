// ============================================
// FILE: controllers/service.controller.js
// Service catalog and booking management
// ============================================

const serviceService = require('../services/service.service');
const ResponseUtil = require('../utils/response.util');
const auditUtil = require('../utils/audit.util');

class ServiceController {
  // ==================== SERVICE CATALOG ====================

  async getServices(req, res, next) {
    try {
      const { category_id, is_active, search } = req.query;
      const userId = req.user?.user_id;

      const services = await serviceService.getServices({
        category_id,
        is_active: is_active !== undefined ? is_active === 'true' : undefined,
        search,
        userId
      });

      return ResponseUtil.success(
        res,
        { services, count: services.length },
        'Services retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getServiceById(req, res, next) {
    try {
      const { service_id } = req.params;
      const userId = req.user?.user_id;

      const service = await serviceService.getServiceById(service_id, userId);

      return ResponseUtil.success(res, service, 'Service retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async checkServiceEligibility(req, res, next) {
    try {
      const { service_id } = req.params;
      const { pet_id } = req.query;
      const userId = req.user.user_id;

      if (!pet_id) {
        return ResponseUtil.validationError(res, { pet_id: 'Pet ID is required' });
      }

      const eligibility = await serviceService.checkServiceEligibility(
        service_id,
        pet_id,
        userId
      );

      return ResponseUtil.success(
        res,
        eligibility,
        'Service eligibility checked successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getAvailableSlots(req, res, next) {
    try {
      const { service_id } = req.params;
      const { date, location_type_id } = req.query;

      if (!date) {
        return ResponseUtil.validationError(res, { date: 'Date is required' });
      }

      const slots = await serviceService.getAvailableSlots(
        service_id,
        date,
        location_type_id
      );

      return ResponseUtil.success(
        res,
        { slots, date, total_slots: slots.length },
        'Available slots retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== BOOKINGS ====================

  async createBooking(req, res, next) {
    try {
      const userId = req.user.user_id;
      const bookingData = req.body;

      const booking = await serviceService.createBooking(userId, bookingData);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: 'create',
        entity_type: 'booking',
        entity_id: booking.booking_id,
        new_value: booking,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        booking,
        'Booking created successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async getBookings(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { status, pet_id, from_date, to_date, limit = 20, offset = 0 } = req.query;

      const result = await serviceService.getBookings(userId, {
        status,
        pet_id,
        from_date,
        to_date,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return ResponseUtil.success(
        res,
        {
          bookings: result.bookings,
          total: result.total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        },
        'Bookings retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getBookingById(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { booking_id } = req.params;

      const booking = await serviceService.getBookingById(booking_id, userId);

      return ResponseUtil.success(res, booking, 'Booking retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async cancelBooking(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { booking_id } = req.params;
      const { reason } = req.body;

      const result = await serviceService.cancelBooking(
        booking_id,
        userId,
        reason
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: 'update',
        entity_type: 'booking',
        entity_id: booking_id,
        changes_summary: `Booking cancelled: ${reason}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, result, 'Booking cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  async rescheduleBooking(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { booking_id } = req.params;
      const { new_date, new_time, reason } = req.body;

      const result = await serviceService.rescheduleBooking(
        booking_id,
        userId,
        new_date,
        new_time,
        reason
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: 'update',
        entity_type: 'booking',
        entity_id: booking_id,
        changes_summary: `Booking rescheduled to ${new_date} ${new_time}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(res, result, 'Booking rescheduled successfully');
    } catch (error) {
      next(error);
    }
  }

  async getBookingHistory(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { booking_id } = req.params;

      // Verify booking ownership
      await serviceService.getBookingById(booking_id, userId);

      const history = await serviceService.getBookingHistory(booking_id);

      return ResponseUtil.success(
        res,
        { history, count: history.length },
        'Booking history retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async calculateBookingPrice(req, res, next) {
    try {
      const { service_id, pet_id, addons, promo_code } = req.body;
      const userId = req.user.user_id;

      const pricing = await serviceService.calculateBookingPrice({
        service_id,
        pet_id,
        userId,
        addons,
        promo_code
      });

      return ResponseUtil.success(
        res,
        pricing,
        'Booking price calculated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== UPCOMING & PAST BOOKINGS ====================

  async getUpcomingBookings(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, limit = 10 } = req.query;

      const bookings = await serviceService.getUpcomingBookings(
        userId,
        pet_id,
        parseInt(limit)
      );

      return ResponseUtil.success(
        res,
        { bookings, count: bookings.length },
        'Upcoming bookings retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getPastBookings(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, limit = 20, offset = 0 } = req.query;

      const result = await serviceService.getPastBookings(
        userId,
        pet_id,
        parseInt(limit),
        parseInt(offset)
      );

      return ResponseUtil.success(
        res,
        {
          bookings: result.bookings,
          total: result.total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        },
        'Past bookings retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== SERVICE CATEGORIES ====================

  async getServiceCategories(req, res, next) {
    try {
      const categories = await serviceService.getServiceCategories();

      return ResponseUtil.success(
        res,
        { categories, count: categories.length },
        'Service categories retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ServiceController();