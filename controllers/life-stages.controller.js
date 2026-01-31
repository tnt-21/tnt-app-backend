const lifeStagesService = require('../services/life-stages.service');
const ResponseUtil = require('../utils/response.util');

class LifeStagesController {
  async getAll(req, res) {
    try {
      const { speciesId } = req.query;
      const lifeStages = await lifeStagesService.getAll(speciesId);
      return ResponseUtil.success(res, lifeStages);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async getById(req, res) {
    try {
      const lifeStage = await lifeStagesService.getById(req.params.id);
      return ResponseUtil.success(res, lifeStage);
    } catch (error) {
      return ResponseUtil.error(res, error.message, error.message === 'Life stage not found' ? 404 : 500);
    }
  }

  async create(req, res) {
    try {
      const lifeStage = await lifeStagesService.create(req.body);
      return ResponseUtil.success(res, lifeStage, 'Life stage created successfully', 201);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async update(req, res) {
    try {
      const lifeStage = await lifeStagesService.update(req.params.id, req.body);
      return ResponseUtil.success(res, lifeStage, 'Life stage updated successfully');
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async delete(req, res) {
    try {
      const result = await lifeStagesService.delete(req.params.id);
      return ResponseUtil.success(res, null, result.message);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }

  async toggleActive(req, res) {
    try {
      const { is_active } = req.body;
      const lifeStage = await lifeStagesService.toggleActive(req.params.id, is_active);
      return ResponseUtil.success(res, lifeStage, `Life stage ${is_active ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  }
}

module.exports = new LifeStagesController();
