// ============================================
// FILE: controllers/caregiver.controller.js
// Caregiver Management Controller
// ============================================

const caregiverService = require("../services/caregiver.service");
const uploadService = require("../services/upload.service");
const auditUtil = require("../utils/audit.util");
const ResponseUtil = require("../utils/response.util");

class CaregiverController {
  // ==================== CAREGIVER PROFILE ====================

  async getProfile(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id || req.params.caregiver_id;
      const caregiver = await caregiverService.getCaregiverById(caregiverId);

      return ResponseUtil.success(res, caregiver, "Profile retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const updateData = req.body;

      const oldProfile = await caregiverService.getCaregiverById(caregiverId);
      const updatedProfile = await caregiverService.updateProfile(caregiverId, updateData);

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "caregiver",
        entity_id: caregiverId,
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
      const caregiverId = req.user.caregiver_id;

      if (!req.file) {
        return ResponseUtil.error(res, "No file uploaded", 400);
      }

      const photoUrl = await uploadService.uploadProfilePhoto(req.file, caregiverId);
      const result = await caregiverService.updateProfilePhoto(caregiverId, photoUrl);

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "caregiver",
        entity_id: caregiverId,
        changes_summary: "Profile photo updated",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, result, "Photo uploaded successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== SPECIALIZATIONS ====================

  async getSpecializations(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const specializations = await caregiverService.getSpecializations(caregiverId);

      return ResponseUtil.success(res, { specializations }, "Specializations retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async addSpecialization(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const specializationData = req.body;

      const specialization = await caregiverService.addSpecialization(caregiverId, specializationData);

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "create",
        entity_type: "caregiver_specialization",
        entity_id: specialization.specialization_id,
        new_value: specialization,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, specialization, "Specialization added successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async deleteSpecialization(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const { specialization_id } = req.params;

      await caregiverService.deleteSpecialization(specialization_id, caregiverId);

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "delete",
        entity_type: "caregiver_specialization",
        entity_id: specialization_id,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Specialization deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== ASSIGNMENTS ====================

  async getAssignments(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const { status, date, page = 1, limit = 20 } = req.query;

      const result = await caregiverService.getAssignments(caregiverId, {
        status,
        date,
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
      const caregiverId = req.user.caregiver_id;
      const { assignment_id } = req.params;

      const assignment = await caregiverService.getAssignmentDetails(assignment_id, caregiverId);

      return ResponseUtil.success(res, assignment, "Assignment details retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async acceptAssignment(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const { assignment_id } = req.params;

      const assignment = await caregiverService.acceptAssignment(assignment_id, caregiverId);

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "assignment",
        entity_id: assignment_id,
        changes_summary: "Assignment accepted",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, assignment, "Assignment accepted successfully");
    } catch (error) {
      next(error);
    }
  }

  async rejectAssignment(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const { assignment_id } = req.params;
      const { rejection_reason } = req.body;

      const assignment = await caregiverService.rejectAssignment(
        assignment_id,
        caregiverId,
        rejection_reason
      );

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "assignment",
        entity_id: assignment_id,
        changes_summary: `Assignment rejected: ${rejection_reason}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, assignment, "Assignment rejected");
    } catch (error) {
      next(error);
    }
  }

  async startService(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const { assignment_id } = req.params;
      const { latitude, longitude } = req.body;

      const assignment = await caregiverService.startService(
        assignment_id,
        caregiverId,
        latitude,
        longitude
      );

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "assignment",
        entity_id: assignment_id,
        changes_summary: "Service started",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, assignment, "Service started successfully");
    } catch (error) {
      next(error);
    }
  }

  async completeService(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const { assignment_id } = req.params;
      const serviceLogData = req.body;

      const result = await caregiverService.completeService(
        assignment_id,
        caregiverId,
        serviceLogData
      );

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "assignment",
        entity_id: assignment_id,
        changes_summary: "Service completed",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, result, "Service completed successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== AVAILABILITY ====================

  async getAvailability(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const { start_date, end_date } = req.query;

      const availability = await caregiverService.getAvailability(
        caregiverId,
        start_date,
        end_date
      );

      return ResponseUtil.success(res, { availability }, "Availability retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async setAvailability(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const availabilityData = req.body;

      const availability = await caregiverService.setAvailability(caregiverId, availabilityData);

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "create",
        entity_type: "caregiver_availability",
        entity_id: availability.availability_id,
        new_value: availability,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, availability, "Availability set successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async updateAvailability(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const { availability_id } = req.params;
      const updateData = req.body;

      const availability = await caregiverService.updateAvailability(
        availability_id,
        caregiverId,
        updateData
      );

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "update",
        entity_type: "caregiver_availability",
        entity_id: availability_id,
        new_value: availability,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, availability, "Availability updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async deleteAvailability(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const { availability_id } = req.params;

      await caregiverService.deleteAvailability(availability_id, caregiverId);

      await auditUtil.log({
        user_id: req.user.user_id,
        action: "delete",
        entity_type: "caregiver_availability",
        entity_id: availability_id,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Availability deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== EARNINGS ====================

  async getEarnings(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const { start_date, end_date, payout_status, page = 1, limit = 50 } = req.query;

      const result = await caregiverService.getEarnings(caregiverId, {
        start_date,
        end_date,
        payout_status,
        page: parseInt(page),
        limit: parseInt(limit),
      });

      return ResponseUtil.success(res, result, "Earnings retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getEarningsSummary(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const { period = "month" } = req.query;

      const summary = await caregiverService.getEarningsSummary(caregiverId, period);

      return ResponseUtil.success(res, summary, "Earnings summary retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== RATINGS ====================

  async getRatings(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;
      const { page = 1, limit = 20 } = req.query;

      const result = await caregiverService.getRatings(caregiverId, {
        page: parseInt(page),
        limit: parseInt(limit),
      });

      return ResponseUtil.success(res, result, "Ratings retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getRatingSummary(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;

      const summary = await caregiverService.getRatingSummary(caregiverId);

      return ResponseUtil.success(res, summary, "Rating summary retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== DASHBOARD ====================

  async getDashboard(req, res, next) {
    try {
      const caregiverId = req.user.caregiver_id;

      const dashboard = await caregiverService.getDashboard(caregiverId);

      return ResponseUtil.success(res, dashboard, "Dashboard data retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CaregiverController();