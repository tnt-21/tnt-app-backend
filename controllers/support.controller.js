// ============================================
// FILE: controllers/support.controller.js
// Support Tickets Controller
// ============================================

const supportService = require("../services/support.service");
const ResponseUtil = require("../utils/response.util");
const auditUtil = require("../utils/audit.util");

class SupportController {
  // ==================== TICKETS ====================

  async createTicket(req, res, next) {
    try {
      const userId = req.user.user_id;
      const ticketData = {
        ...req.body,
        user_id: userId,
      };

      const ticket = await supportService.createTicket(ticketData);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "create",
        entity_type: "support_ticket",
        entity_id: ticket.ticket_id,
        new_value: ticket,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        ticket,
        "Support ticket created successfully",
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async getMyTickets(req, res, next) {
    try {
      const userId = req.user.user_id;
      const filters = {
        status: req.query.status,
        category: req.query.category,
        priority: req.query.priority,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
      };

      const result = await supportService.getUserTickets(userId, filters);

      return ResponseUtil.success(
        res,
        result,
        "Tickets retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async getTicket(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { ticket_id } = req.params;

      const ticket = await supportService.getTicketById(ticket_id, userId);

      return ResponseUtil.success(
        res,
        ticket,
        "Ticket details retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async addMessage(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { ticket_id } = req.params;
      const { message, attachments } = req.body;

      const ticketMessage = await supportService.addMessage(
        ticket_id,
        userId,
        message,
        attachments
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "create",
        entity_type: "ticket_message",
        entity_id: ticketMessage.message_id,
        changes_summary: "Message added to ticket",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        ticketMessage,
        "Message added successfully",
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async getTicketMessages(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { ticket_id } = req.params;

      const messages = await supportService.getTicketMessages(
        ticket_id,
        userId
      );

      return ResponseUtil.success(
        res,
        { messages },
        "Messages retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async closeTicket(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { ticket_id } = req.params;
      const { customer_satisfaction_rating, customer_feedback } = req.body;

      const ticket = await supportService.closeTicket(
        ticket_id,
        userId,
        customer_satisfaction_rating,
        customer_feedback
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "support_ticket",
        entity_id: ticket_id,
        changes_summary: "Ticket closed by user",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, ticket, "Ticket closed successfully");
    } catch (error) {
      next(error);
    }
  }

  async reopenTicket(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { ticket_id } = req.params;
      const { reason } = req.body;

      const ticket = await supportService.reopenTicket(
        ticket_id,
        userId,
        reason
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "support_ticket",
        entity_id: ticket_id,
        changes_summary: `Ticket reopened: ${reason}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, ticket, "Ticket reopened successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== HELPER ENDPOINTS ====================

  async getTicketCategories(req, res, next) {
    try {
      const categories = await supportService.getTicketCategories();

      return ResponseUtil.success(
        res,
        { categories },
        "Categories retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async uploadAttachment(req, res, next) {
    try {
      const userId = req.user.user_id;

      if (!req.file) {
        return ResponseUtil.error(res, "No file uploaded", 400);
      }

      const uploadService = require("../services/upload.service");
      const attachmentUrl = await uploadService.uploadTicketAttachment(
        req.file,
        userId
      );

      return ResponseUtil.success(
        res,
        { url: attachmentUrl },
        "Attachment uploaded successfully"
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SupportController();