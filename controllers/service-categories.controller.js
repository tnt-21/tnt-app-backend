const serviceCategoriesService = require('../services/service-categories.service');
const ResponseUtil = require('../utils/response.util');

class ServiceCategoriesController {
  async getAll(req, res) {
    try {
      const categories = await serviceCategoriesService.getAll();
      return ResponseUtil.success(res, categories);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async getById(req, res) {
    try {
      const category = await serviceCategoriesService.getById(req.params.id);
      return ResponseUtil.success(res, category);
    } catch (error) {
      return ResponseUtil.error(res, error.message, error.message === 'Service category not found' ? 404 : 500);
    }
  }

  async create(req, res) {
    try {
      const category = await serviceCategoriesService.create(req.body);
      return ResponseUtil.success(res, category, 'Service category created successfully', 201);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async update(req, res) {
    try {
      const category = await serviceCategoriesService.update(req.params.id, req.body);
      return ResponseUtil.success(res, category, 'Service category updated successfully');
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async delete(req, res) {
    try {
      const result = await serviceCategoriesService.delete(req.params.id);
      return ResponseUtil.success(res, null, result.message);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async toggleActive(req, res) {
    try {
      const { is_active } = req.body;
      const category = await serviceCategoriesService.toggleActive(req.params.id, is_active);
      return ResponseUtil.success(res, category, `Service category ${is_active ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }
}

module.exports = new ServiceCategoriesController();
