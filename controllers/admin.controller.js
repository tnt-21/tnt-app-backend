
const subscriptionService = require('../services/subscription.service');
const adminService = require('../services/admin.service');
const ResponseUtil = require('../utils/response.util');

class AdminController {
  
  async updateTier(req, res, next) {
    try {
      const { tierId } = req.params;
      const updates = req.body;

      // Basic validation
      if (!updates.base_price && !updates.tier_name) {
        // Allow partial updates, but ensure at least something is there
      }

      const updatedTier = await subscriptionService.updateTier(tierId, updates);

      return ResponseUtil.success(
        res,
        updatedTier,
        'Tier updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async updateTierConfig(req, res, next) {
    try {
      const { tierId } = req.params;
      const { species_id, life_stage_id, category_id, quota_monthly, quota_annual, is_included } = req.body;

      if (!species_id || !life_stage_id || !category_id) {
        return ResponseUtil.error(res, 'Missing required fields', 400);
      }

      const config = {
        quota_monthly,
        quota_annual,
        is_included: is_included !== undefined ? is_included : true
      };

      const updatedConfig = await subscriptionService.updateTierConfig(
        tierId,
        species_id,
        life_stage_id,
        category_id,
        config
      );

      return ResponseUtil.success(
        res,
        updatedConfig,
        'Tier configuration updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== CAREGIVER MANAGEMENT ====================

  async createCaregiver(req, res, next) {
    try {
      const { phone, full_name } = req.body;
      
      if (!phone || !full_name) {
        return ResponseUtil.error(res, 'Phone and Full Name are required', 400);
      }

      const result = await adminService.createCaregiver(req.body);

      return ResponseUtil.success(res, result, 'Caregiver created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async promoteUserToCaregiver(req, res, next) {
    try {
      const { userId } = req.params;
      
      const result = await adminService.promoteToCaregiver(userId, req.body);

      return ResponseUtil.success(res, result, 'User promoted to caregiver successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAllCaregivers(req, res, next) {
    try {
      const result = await adminService.getAllCaregivers(req.query);
      return ResponseUtil.success(res, result, 'Caregivers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCaregiverById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.getCaregiverById(id);
      return ResponseUtil.success(res, result, 'Caregiver details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateCaregiver(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.updateCaregiver(id, req.body);
      return ResponseUtil.success(res, result, 'Caregiver updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteCaregiver(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteCaregiver(id);
      return ResponseUtil.success(res, result, 'Caregiver deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== CARE MANAGER MANAGEMENT ====================

  async createCareManager(req, res, next) {
    try {
      const { phone, full_name, email } = req.body;
      
      if (!phone || !full_name || !email) {
        return ResponseUtil.error(res, 'Phone, Email and Full Name are required', 400);
      }

      const result = await adminService.createCareManager(req.body);

      return ResponseUtil.success(res, result, 'Care Manager created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async promoteUserToCareManager(req, res, next) {
    try {
      const { userId } = req.params;
      
      const result = await adminService.promoteToCareManager(userId, req.body);

      return ResponseUtil.success(res, result, 'User promoted to care manager successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAllCareManagers(req, res, next) {
    try {
      const result = await adminService.getAllCareManagers(req.query);
      return ResponseUtil.success(res, result, 'Care Managers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCareManagerById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.getCareManagerById(id);
      return ResponseUtil.success(res, result, 'Care Manager details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateCareManager(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.updateCareManager(id, req.body);
      return ResponseUtil.success(res, result, 'Care Manager updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteCareManager(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteCareManager(id);
      return ResponseUtil.success(res, result, 'Care Manager deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();
