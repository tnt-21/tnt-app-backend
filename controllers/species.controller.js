const speciesService = require('../services/species.service');
const ResponseUtil = require('../utils/response.util');

class SpeciesController {
  /**
   * GET /admin/species
   * Get all species
   */
  async getAll(req, res, next) {
    try {
      const species = await speciesService.getAll();
      return ResponseUtil.success(res, species, 'Species retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/species/:id
   * Get species by ID
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const species = await speciesService.getById(id);
      return ResponseUtil.success(res, species, 'Species retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/species
   * Create new species
   */
  async create(req, res, next) {
    try {
      const { species_code, species_name } = req.body;

      if (!species_code || !species_name) {
        return ResponseUtil.error(res, 'Species code and name are required', 400);
      }

      const species = await speciesService.create(req.body);
      return ResponseUtil.success(res, species, 'Species created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /admin/species/:id
   * Update species
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const species = await speciesService.update(id, req.body);
      return ResponseUtil.success(res, species, 'Species updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /admin/species/:id
   * Delete species
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const result = await speciesService.delete(id);
      return ResponseUtil.success(res, result, 'Species deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /admin/species/:id/status
   * Toggle active status
   */
  async toggleActive(req, res, next) {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      if (is_active === undefined) {
        return ResponseUtil.error(res, 'is_active field is required', 400);
      }

      const species = await speciesService.toggleActive(id, is_active);
      return ResponseUtil.success(res, species, 'Status updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SpeciesController();
