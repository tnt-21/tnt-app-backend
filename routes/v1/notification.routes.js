// ============================================
// FILE: routes/v1/notification.routes.js
// Notification Management API Routes
// ============================================

const express = require('express');
const router = express.Router();
const notificationController = require('../../controllers/notification.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { rateLimitMiddleware } = require('../../middlewares/rateLimit.middleware');

// Import validation schemas
const {
  updateNotificationPreferencesSchema,
  sendNotificationSchema,
  sendTemplateNotificationSchema,
  sendBulkNotificationsSchema
} = require('../../utils/validation.util');

// All routes require authentication
router.use(authMiddleware.authenticate);

// ==================== USER NOTIFICATIONS ====================

/**
 * GET /api/v1/notifications
 * Get user's notifications with filters
 * Query params: is_read, notification_type, limit, offset
 */
router.get(
  '/',
  rateLimitMiddleware(60, 60),
  notificationController.getNotifications
);

/**
 * GET /api/v1/notifications/unread-count
 * Get count of unread notifications
 */
router.get(
  '/unread-count',
  rateLimitMiddleware(120, 60),
  notificationController.getUnreadCount
);

/**
 * PUT /api/v1/notifications/:notification_id/read
 * Mark notification as read
 */
router.put(
  '/:notification_id/read',
  rateLimitMiddleware(100, 60),
  notificationController.markAsRead
);

/**
 * PUT /api/v1/notifications/read-all
 * Mark all notifications as read
 */
router.put(
  '/read-all',
  rateLimitMiddleware(10, 60),
  notificationController.markAllAsRead
);

/**
 * PUT /api/v1/notifications/:notification_id/clicked
 * Mark notification as clicked (tracks engagement)
 */
router.put(
  '/:notification_id/clicked',
  rateLimitMiddleware(100, 60),
  notificationController.markAsClicked
);

/**
 * DELETE /api/v1/notifications/:notification_id
 * Delete a specific notification
 */
router.delete(
  '/:notification_id',
  rateLimitMiddleware(60, 60),
  notificationController.deleteNotification
);

/**
 * DELETE /api/v1/notifications/clear-read
 * Clear all read notifications
 */
router.delete(
  '/clear-read',
  rateLimitMiddleware(10, 60),
  notificationController.clearReadNotifications
);

// ==================== NOTIFICATION PREFERENCES ====================

/**
 * GET /api/v1/notifications/preferences
 * Get user's notification preferences
 */
router.get(
  '/preferences',
  rateLimitMiddleware(30, 60),
  notificationController.getPreferences
);

/**
 * PUT /api/v1/notifications/preferences
 * Update notification preferences
 */
router.put(
  '/preferences',
  rateLimitMiddleware(20, 60),
  validate(updateNotificationPreferencesSchema),
  notificationController.updatePreferences
);

// ==================== ADMIN ROUTES (Require admin role) ====================

/**
 * POST /api/v1/notifications/send
 * Send notification to a user (Admin/System only)
 * Requires admin authentication middleware
 */
router.post(
  '/send',
  rateLimitMiddleware(100, 60),
  validate(sendNotificationSchema),
  notificationController.sendNotification
);

/**
 * POST /api/v1/notifications/send-template
 * Send template-based notification (Admin/System only)
 */
router.post(
  '/send-template',
  rateLimitMiddleware(100, 60),
  validate(sendTemplateNotificationSchema),
  notificationController.sendTemplateNotification
);

/**
 * POST /api/v1/notifications/send-bulk
 * Send bulk notifications to multiple users (Admin only)
 */
router.post(
  '/send-bulk',
  rateLimitMiddleware(10, 60),
  validate(sendBulkNotificationsSchema),
  notificationController.sendBulkNotifications
);

module.exports = router;