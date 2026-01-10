// ============================================
// FILE: controllers/notification.controller.js
// Notification Management Controller
// ============================================

const notificationService = require('../services/notification.service');
const ResponseUtil = require('../utils/response.util');
const auditUtil = require('../utils/audit.util');

class NotificationController {
  // ==================== NOTIFICATIONS ====================

  /**
   * Get user notifications
   */
  async getNotifications(req, res, next) {
    try {
      const userId = req.user.user_id;
      const filters = {
        is_read: req.query.is_read !== undefined ? req.query.is_read === 'true' : undefined,
        notification_type: req.query.notification_type,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      const result = await notificationService.getUserNotifications(userId, filters);

      return ResponseUtil.success(
        res,
        result,
        'Notifications retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.user_id;

      const result = await notificationService.getUserNotifications(userId, { limit: 1 });

      return ResponseUtil.success(
        res,
        { unread_count: result.counts.unread },
        'Unread count retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { notification_id } = req.params;

      const notification = await notificationService.markAsRead(notification_id, userId);

      return ResponseUtil.success(
        res,
        notification,
        'Notification marked as read'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req, res, next) {
    try {
      const userId = req.user.user_id;

      const result = await notificationService.markAllAsRead(userId);

      await auditUtil.log({
        user_id: userId,
        action: 'update',
        entity_type: 'notification',
        changes_summary: `Marked ${result.marked_count} notifications as read`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        result,
        'All notifications marked as read'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark notification as clicked
   */
  async markAsClicked(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { notification_id } = req.params;

      const notification = await notificationService.markAsClicked(notification_id, userId);

      return ResponseUtil.success(
        res,
        notification,
        'Notification marked as clicked'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { notification_id } = req.params;

      await notificationService.deleteNotification(notification_id, userId);

      return ResponseUtil.success(
        res,
        null,
        'Notification deleted successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Clear all read notifications
   */
  async clearReadNotifications(req, res, next) {
    try {
      const userId = req.user.user_id;

      const result = await notificationService.clearReadNotifications(userId);

      await auditUtil.log({
        user_id: userId,
        action: 'delete',
        entity_type: 'notification',
        changes_summary: `Cleared ${result.deleted_count} read notifications`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        result,
        'Read notifications cleared successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== NOTIFICATION PREFERENCES ====================

  /**
   * Get notification preferences
   */
  async getPreferences(req, res, next) {
    try {
      const userId = req.user.user_id;

      const preferences = await notificationService.getPreferences(userId);

      return ResponseUtil.success(
        res,
        preferences,
        'Notification preferences retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(req, res, next) {
    try {
      const userId = req.user.user_id;
      const updateData = req.body;

      const preferences = await notificationService.updatePreferences(userId, updateData);

      await auditUtil.log({
        user_id: userId,
        action: 'update',
        entity_type: 'notification_preferences',
        entity_id: userId,
        new_value: preferences,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        preferences,
        'Notification preferences updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== ADMIN: SEND NOTIFICATIONS ====================

  /**
   * Send notification (Admin/System only)
   */
  async sendNotification(req, res, next) {
    try {
      const { user_id, ...notificationData } = req.body;
      const adminId = req.user.user_id;

      const notification = await notificationService.sendNotification(user_id, notificationData);

      await auditUtil.log({
        admin_id: adminId,
        action: 'create',
        entity_type: 'notification',
        entity_id: notification?.notification_id,
        changes_summary: `Sent ${notificationData.notification_type} to user ${user_id}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        notification,
        'Notification sent successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send template notification (Admin/System only)
   */
  async sendTemplateNotification(req, res, next) {
    try {
      const { user_id, template_code, variables, delivery_method } = req.body;
      const adminId = req.user.user_id;

      const notification = await notificationService.sendTemplateNotification(
        user_id,
        template_code,
        variables,
        delivery_method
      );

      await auditUtil.log({
        admin_id: adminId,
        action: 'create',
        entity_type: 'notification',
        entity_id: notification?.notification_id,
        changes_summary: `Sent template ${template_code} to user ${user_id}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        notification,
        'Template notification sent successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send bulk notifications (Admin only)
   */
  async sendBulkNotifications(req, res, next) {
    try {
      const { user_ids, ...notificationData } = req.body;
      const adminId = req.user.user_id;

      if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return ResponseUtil.validationError(res, {
          user_ids: 'user_ids must be a non-empty array'
        });
      }

      const results = {
        total: user_ids.length,
        sent: 0,
        failed: 0,
        notifications: []
      };

      for (const userId of user_ids) {
        try {
          const notification = await notificationService.sendNotification(userId, notificationData);
          results.sent++;
          results.notifications.push({ user_id: userId, status: 'sent', notification_id: notification?.notification_id });
        } catch (error) {
          results.failed++;
          results.notifications.push({ user_id: userId, status: 'failed', error: error.message });
        }
      }

      await auditUtil.log({
        admin_id: adminId,
        action: 'create',
        entity_type: 'notification',
        changes_summary: `Sent bulk notification to ${results.sent}/${user_ids.length} users`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        results,
        `Bulk notifications sent: ${results.sent} successful, ${results.failed} failed`
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();