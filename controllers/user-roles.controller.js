const userRolesService = require('../services/user-roles.service');
const ResponseUtil = require('../utils/response.util');

class UserRolesController {
  async getAll(req, res) {
    try {
      const roles = await userRolesService.getAll();
      return ResponseUtil.success(res, roles);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async getById(req, res) {
    try {
      const role = await userRolesService.getById(req.params.id);
      return ResponseUtil.success(res, role);
    } catch (error) {
      return ResponseUtil.error(res, error.message, error.message === 'User role not found' ? 404 : 500);
    }
  }

  async create(req, res) {
    try {
      const role = await userRolesService.create(req.body);
      return ResponseUtil.success(res, role, 'User role created successfully', 201);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async update(req, res) {
    try {
      const role = await userRolesService.update(req.params.id, req.body);
      return ResponseUtil.success(res, role, 'User role updated successfully');
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async delete(req, res) {
    try {
      const result = await userRolesService.delete(req.params.id);
      return ResponseUtil.success(res, null, result.message);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async toggleActive(req, res) {
    try {
      const { is_active } = req.body;
      const role = await userRolesService.toggleActive(req.params.id, is_active);
      return ResponseUtil.success(res, role, `User role ${is_active ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }
}

module.exports = new UserRolesController();
