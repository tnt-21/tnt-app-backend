// ============================================
// FILE: controllers/community.controller.js
// Community Events Controller
// ============================================

const communityService = require("../services/community.service");
const ResponseUtil = require("../utils/response.util");
const auditUtil = require("../utils/audit.util");

class CommunityController {
  // ==================== EVENTS ====================

  async getEvents(req, res, next) {
    try {
      const userId = req.user?.user_id;
      const filters = {
        status: req.query.status,
        event_type: req.query.event_type,
        species_id: req.query.species_id,
        from_date: req.query.from_date,
        to_date: req.query.to_date,
        is_free: req.query.is_free,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
      };

      const result = await communityService.getEvents(filters, userId);

      return ResponseUtil.success(
        res,
        result,
        "Events retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async getEvent(req, res, next) {
    try {
      const { event_id } = req.params;
      const userId = req.user?.user_id;

      const event = await communityService.getEventById(event_id, userId);

      return ResponseUtil.success(
        res,
        event,
        "Event details retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async registerForEvent(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { event_id } = req.params;
      const registrationData = {
        ...req.body,
        event_id,
        user_id: userId,
      };

      const registration = await communityService.registerForEvent(
        registrationData
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "create",
        entity_type: "event_registration",
        entity_id: registration.registration_id,
        new_value: registration,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        registration,
        "Successfully registered for event",
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async cancelEventRegistration(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { registration_id } = req.params;
      const { cancellation_reason } = req.body;

      await communityService.cancelRegistration(
        registration_id,
        userId,
        cancellation_reason
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "event_registration",
        entity_id: registration_id,
        changes_summary: `Registration cancelled: ${cancellation_reason}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        null,
        "Event registration cancelled successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async getMyRegistrations(req, res, next) {
    try {
      const userId = req.user.user_id;
      const filters = {
        status: req.query.status,
        upcoming: req.query.upcoming === "true",
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
      };

      const result = await communityService.getUserRegistrations(
        userId,
        filters
      );

      return ResponseUtil.success(
        res,
        result,
        "Registrations retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async submitEventFeedback(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { registration_id } = req.params;
      const { feedback_rating, feedback_text } = req.body;

      const result = await communityService.submitFeedback(
        registration_id,
        userId,
        feedback_rating,
        feedback_text
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "event_registration",
        entity_id: registration_id,
        changes_summary: "Event feedback submitted",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        result,
        "Feedback submitted successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async joinWaitlist(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { event_id } = req.params;
      const { pet_id, special_requirements } = req.body;

      const registration = await communityService.joinWaitlist(
        event_id,
        userId,
        pet_id,
        special_requirements
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "create",
        entity_type: "event_registration",
        entity_id: registration.registration_id,
        changes_summary: "Joined event waitlist",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        registration,
        "Successfully joined waitlist",
        201
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CommunityController();