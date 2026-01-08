// ============================================
// FILE: controllers/careManager.controller.js
// Care Manager Controller
// ============================================

const careManagerService = require("../services/careManager.service");
const uploadService = require("../services/upload.service");
const auditUtil = require("../utils/audit.util");
const ResponseUtil = require("../utils/response.util");

class CareManagerController {
  // ==================== PROFILE ====================

  async getProfile(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;
      const profile = await careManagerService.getProfileById(careManagerId);

      return ResponseUtil.success(res, profile, "Profile retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;
      const updateData = req.body;

      const oldProfile = await careManagerService.getProfileById(careManagerId);
      const updatedProfile = await careManagerService.updateProfile(careManagerId, updateData);

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "care_manager",
        entity_id: careManagerId,
        old_value: oldProfile,
        new_value: updatedProfile,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, updatedProfile, "Profile updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async uploadProfilePhoto(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;

      if (!req.file) {
        return ResponseUtil.error(res, "No file uploaded", 400);
      }

      const photoUrl = await uploadService.uploadProfilePhoto(req.file, careManagerId);
      const result = await careManagerService.updateProfilePhoto(careManagerId, photoUrl);

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "care_manager",
        entity_id: careManagerId,
        changes_summary: "Profile photo updated",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, result, "Photo uploaded successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== ASSIGNMENTS ====================

  async getAssignments(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;
      const { is_active, page = 1, limit = 20 } = req.query;

      const result = await careManagerService.getAssignments(careManagerId, {
        is_active: is_active !== undefined ? is_active === "true" : undefined,
        page: parseInt(page),
        limit: parseInt(limit),
      });

      return ResponseUtil.success(res, result, "Assignments retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getAssignmentDetails(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;
      const { assignment_id } = req.params;

      const assignment = await careManagerService.getAssignmentDetails(assignment_id, careManagerId);

      return ResponseUtil.success(res, assignment, "Assignment details retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async completeOnboarding(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;
      const { assignment_id } = req.params;
      const { notes, care_plan_url } = req.body;

      const result = await careManagerService.completeOnboarding(
        assignment_id,
        careManagerId,
        notes,
        care_plan_url
      );

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "care_manager_assignment",
        entity_id: assignment_id,
        changes_summary: "Onboarding completed",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, result, "Onboarding completed successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateCheckInFrequency(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;
      const { assignment_id } = req.params;
      const { check_in_frequency } = req.body;

      const result = await careManagerService.updateCheckInFrequency(
        assignment_id,
        careManagerId,
        check_in_frequency
      );

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "care_manager_assignment",
        entity_id: assignment_id,
        changes_summary: `Check-in frequency updated to ${check_in_frequency}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, result, "Check-in frequency updated successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== INTERACTIONS ====================

  async getInteractions(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;
      const { assignment_id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await careManagerService.getInteractions(assignment_id, careManagerId, {
        page: parseInt(page),
        limit: parseInt(limit),
      });

      return ResponseUtil.success(res, result, "Interactions retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async logInteraction(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;
      const { assignment_id } = req.params;
      const interactionData = req.body;

      const interaction = await careManagerService.logInteraction(
        assignment_id,
        careManagerId,
        req.user.user_id,
        interactionData
      );

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "create",
        entity_type: "care_manager_interaction",
        entity_id: interaction.interaction_id,
        new_value: interaction,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, interaction, "Interaction logged successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async updateInteraction(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;
      const { interaction_id } = req.params;
      const updateData = req.body;

      const interaction = await careManagerService.updateInteraction(
        interaction_id,
        careManagerId,
        updateData
      );

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "care_manager_interaction",
        entity_id: interaction_id,
        new_value: interaction,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, interaction, "Interaction updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async deleteInteraction(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;
      const { interaction_id } = req.params;

      await careManagerService.deleteInteraction(interaction_id, careManagerId);

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "delete",
        entity_type: "care_manager_interaction",
        entity_id: interaction_id,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Interaction deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== DASHBOARD ====================

  async getDashboard(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;

      const dashboard = await careManagerService.getDashboard(careManagerId);

      return ResponseUtil.success(res, dashboard, "Dashboard data retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getPetDetails(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;
      const { pet_id } = req.params;

      const petDetails = await careManagerService.getPetDetails(pet_id, careManagerId);

      return ResponseUtil.success(res, petDetails, "Pet details retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getUpcomingCheckIns(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;

      const checkIns = await careManagerService.getUpcomingCheckIns(careManagerId);

      return ResponseUtil.success(res, { check_ins: checkIns }, "Upcoming check-ins retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async scheduleCheckIn(req, res, next) {
    try {
      const careManagerId = req.user.care_manager_id;
      const { assignment_id } = req.params;
      const { next_check_in_date } = req.body;

      const result = await careManagerService.scheduleCheckIn(
        assignment_id,
        careManagerId,
        next_check_in_date
      );

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "care_manager_assignment",
        entity_id: assignment_id,
        changes_summary: `Check-in scheduled for ${next_check_in_date}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, result, "Check-in scheduled successfully");
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CareManagerController();