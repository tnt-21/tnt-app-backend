const bookingStatusesService = require('../services/booking-statuses.service');
const ResponseUtil = require('../utils/response.util');

class BookingStatusesController {
  async getAll(req, res) {
    try {
      const statuses = await bookingStatusesService.getAll();
      return ResponseUtil.success(res, statuses);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async getById(req, res) {
    try {
      const status = await bookingStatusesService.getById(req.params.id);
      return ResponseUtil.success(res, status);
    } catch (error) {
      return ResponseUtil.error(res, error.message, error.message === 'Booking status not found' ? 404 : 500);
    }
  }

  async create(req, res) {
    try {
      const status = await bookingStatusesService.create(req.body);
      return ResponseUtil.success(res, status, 'Booking status created successfully', 201);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async update(req, res) {
    try {
      const status = await bookingStatusesService.update(req.params.id, req.body);
      return ResponseUtil.success(res, status, 'Booking status updated successfully');
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async delete(req, res) {
    try {
      const result = await bookingStatusesService.delete(req.params.id);
      return ResponseUtil.success(res, null, result.message);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async toggleActive(req, res) {
    try {
      const { is_active } = req.body;
      const status = await bookingStatusesService.toggleActive(req.params.id, is_active);
      return ResponseUtil.success(res, status, `Booking status ${is_active ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }
}

module.exports = new BookingStatusesController();
