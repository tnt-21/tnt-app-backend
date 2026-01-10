// ============================================
// FILE: routes/v1/support.routes.js
// Support Tickets Routes
// ============================================

const express = require("express");
const router = express.Router();
const supportController = require("../../controllers/support.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { validate } = require("../../middlewares/validation.middleware");
const {
  rateLimitMiddleware,
} = require("../../middlewares/rateLimit.middleware");
const { uploadTicketAttachment } = require("../../middlewares/upload.middleware");

// Validation schemas
const {
  createTicketSchema,
  addTicketMessageSchema,
  closeTicketSchema,
  reopenTicketSchema,
} = require("../../utils/validation.util");

// All routes require authentication
router.use(authMiddleware.authenticate);

// Ticket management
router.post(
  "/tickets",
  rateLimitMiddleware(10, 60),
  validate(createTicketSchema),
  supportController.createTicket
);

router.get("/tickets", supportController.getMyTickets);
router.get("/tickets/:ticket_id", supportController.getTicket);

// Ticket messages
router.get("/tickets/:ticket_id/messages", supportController.getTicketMessages);
router.post(
  "/tickets/:ticket_id/messages",
  rateLimitMiddleware(30, 60),
  validate(addTicketMessageSchema),
  supportController.addMessage
);

// Ticket actions
router.post(
  "/tickets/:ticket_id/close",
  rateLimitMiddleware(20, 60),
  validate(closeTicketSchema),
  supportController.closeTicket
);

router.post(
  "/tickets/:ticket_id/reopen",
  rateLimitMiddleware(10, 60),
  validate(reopenTicketSchema),
  supportController.reopenTicket
);

// Helpers
router.get("/categories", supportController.getTicketCategories);
router.post(
  "/upload-attachment",
  rateLimitMiddleware(10, 60),
  uploadTicketAttachment,
  supportController.uploadAttachment
);

module.exports = router;