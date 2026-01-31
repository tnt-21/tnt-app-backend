const locationTypesService = require('../services/location-types.service');
const ResponseUtil = require('../utils/response.util');

class LocationTypesController {
  async getAll(req, res) {
    try {
      const types = await locationTypesService.getAll();
      return ResponseUtil.success(res, types);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async getById(req, res) {
    try {
      const type = await locationTypesService.getById(req.params.id);
      return ResponseUtil.success(res, type);
    } catch (error) {
      return ResponseUtil.error(res, error.message, error.message === 'Location type not found' ? 404 : 500);
    }
  }

  async create(req, res) {
    try {
      const type = await locationTypesService.create(req.body);
      return ResponseUtil.success(res, type, 'Location type created successfully', 201);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async update(req, res) {
    try {
      const type = await locationTypesService.update(req.params.id, req.body);
      return ResponseUtil.success(res, type, 'Location type updated successfully');
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async delete(req, res) {
    try {
      const result = await locationTypesService.delete(req.params.id);
      return ResponseUtil.success(res, null, result.message);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async toggleActive(req, res) {
    try {
      const { is_active } = req.body;
      const type = await locationTypesService.toggleActive(req.params.id, is_active);
      return ResponseUtil.success(res, type, `Location type ${is_active ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }
}

module.exports = new LocationTypesController();
