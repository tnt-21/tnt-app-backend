// ============================================
// FILE: services/notification.service.js
// Notification System for Push, SMS, Email, WhatsApp
// ============================================

const { pool } = require('../config/database');
const { AppError } = require('../utils/response.util');
const smsService = require('./sms.service');

class NotificationService {
  // ==================== SEND NOTIFICATIONS ====================

  /**
   * Send notification to user
   */
  async sendNotification(userId, notificationData) {
    const {
      notification_type,
      priority = 'normal',
      title,
      message,
      rich_content,
      action_type,
      action_url,
      action_data,
      delivery_method = 'push',
      expires_at
    } = notificationData;

    // Check user's notification preferences
    const preferences = await this.getPreferences(userId);

    // Check if user has this notification type enabled
    const notificationTypeKey = this.getNotificationTypeKey(notification_type);
    if (notificationTypeKey && !preferences[notificationTypeKey]) {
      console.log(`Notification skipped: ${notification_type} disabled for user ${userId}`);
      return null;
    }

    // Check delivery method preferences
    const deliveryMethodKey = `${delivery_method}_enabled`;
    if (!preferences[deliveryMethodKey]) {
      console.log(`Notification skipped: ${delivery_method} disabled for user ${userId}`);
      return null;
    }

    // Check quiet hours
    if (this.isQuietHours(preferences)) {
      console.log(`Notification skipped: Quiet hours for user ${userId}`);
      return null;
    }

    // Create notification record
    const query = `
      INSERT INTO notifications (
        user_id, notification_type, priority, title, message,
        rich_content, action_type, action_url, action_data,
        delivery_method, expires_at, is_delivered
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      notification_type,
      priority,
      title,
      message,
      rich_content ? JSON.stringify(rich_content) : null,
      action_type || null,
      action_url || null,
      action_data ? JSON.stringify(action_data) : null,
      delivery_method,
      expires_at || null
    ]);

    const notification = result.rows[0];

    // Actually send the notification via appropriate channel
    try {
      await this.deliverNotification(userId, notification, delivery_method);
      
      // Update delivered status
      await pool.query(
        'UPDATE notifications SET is_delivered = true, delivered_at = NOW() WHERE notification_id = $1',
        [notification.notification_id]
      );
    } catch (error) {
      console.error('Failed to deliver notification:', error);
      await pool.query(
        'UPDATE notifications SET is_delivered = false WHERE notification_id = $1',
        [notification.notification_id]
      );
    }

    return notification;
  }

  /**
   * Send notification using template
   */
  async sendTemplateNotification(userId, templateCode, variables = {}, deliveryMethod = 'push') {
    // Get template
    const template = await this.getTemplate(templateCode);

    if (!template || !template.is_active) {
      throw new AppError('Notification template not found or inactive', 404, 'TEMPLATE_NOT_FOUND');
    }

    // Replace variables in template
    let title = template.subject || '';
    let message = template.body_template;

    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      title = title.replace(regex, variables[key]);
      message = message.replace(regex, variables[key]);
    });

    // Send notification
    return await this.sendNotification(userId, {
      notification_type: template.notification_type,
      title,
      message,
      delivery_method: deliveryMethod,
      action_data: variables
    });
  }

  /**
   * Deliver notification via specific channel
   */
  async deliverNotification(userId, notification, method) {
    const user = await this.getUserContactInfo(userId);

    switch (method) {
      case 'sms':
        if (user.phone) {
          await smsService.sendSMS(user.phone, notification.message);
        }
        break;

      case 'email':
        if (user.email) {
          // TODO: Implement email service
          console.log(`Email to ${user.email}: ${notification.title}`);
        }
        break;

      case 'push':
        // Get user's FCM tokens
        const tokens = await this.getUserFCMTokens(userId);
        if (tokens.length > 0) {
          // TODO: Implement FCM push notification
          console.log(`Push notification to ${tokens.length} devices`);
        }
        break;

      case 'whatsapp':
        if (user.phone) {
          // TODO: Implement WhatsApp Business API
          console.log(`WhatsApp to ${user.phone}: ${notification.message}`);
        }
        break;

      default:
        console.log('Unknown delivery method:', method);
    }
  }

  // ==================== NOTIFICATION MANAGEMENT ====================

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, filters = {}) {
    const { is_read, notification_type, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT *
      FROM notifications
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramCount = 2;

    if (is_read !== undefined) {
      query += ` AND is_read = $${paramCount}`;
      params.push(is_read);
      paramCount++;
    }

    if (notification_type) {
      query += ` AND notification_type = $${paramCount}`;
      params.push(notification_type);
      paramCount++;
    }

    query += ` AND (expires_at IS NULL OR expires_at > NOW())`;
    query += ` ORDER BY sent_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get counts
    const countQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_read = false) as unread
      FROM notifications
      WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
    `;

    const countResult = await pool.query(countQuery, [userId]);

    return {
      notifications: result.rows,
      counts: {
        total: parseInt(countResult.rows[0].total),
        unread: parseInt(countResult.rows[0].unread)
      },
      pagination: {
        limit,
        offset,
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    const query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE notification_id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [notificationId, userId]);

    if (result.rows.length === 0) {
      throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    return result.rows[0];
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    const query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id = $1 AND is_read = false
      RETURNING COUNT(*) as marked_count
    `;

    const result = await pool.query(query, [userId]);
    return { marked_count: result.rowCount };
  }

  /**
   * Mark notification as clicked
   */
  async markAsClicked(notificationId, userId) {
    const query = `
      UPDATE notifications
      SET is_clicked = true, clicked_at = NOW(), is_read = true, read_at = COALESCE(read_at, NOW())
      WHERE notification_id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [notificationId, userId]);

    if (result.rows.length === 0) {
      throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    return result.rows[0];
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    const query = `
      DELETE FROM notifications
      WHERE notification_id = $1 AND user_id = $2
      RETURNING notification_id
    `;

    const result = await pool.query(query, [notificationId, userId]);

    if (result.rows.length === 0) {
      throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    return true;
  }

  /**
   * Clear all read notifications
   */
  async clearReadNotifications(userId) {
    const query = `
      DELETE FROM notifications
      WHERE user_id = $1 AND is_read = true
      RETURNING COUNT(*) as deleted_count
    `;

    const result = await pool.query(query, [userId]);
    return { deleted_count: result.rowCount };
  }

  // ==================== PREFERENCES ====================

  /**
   * Get user notification preferences
   */
  async getPreferences(userId) {
    let query = `SELECT * FROM notification_preferences WHERE user_id = $1`;
    let result = await pool.query(query, [userId]);

    // Create default if doesn't exist
    if (result.rows.length === 0) {
      const insertQuery = `
        INSERT INTO notification_preferences (user_id)
        VALUES ($1)
        RETURNING *
      `;
      result = await pool.query(insertQuery, [userId]);
    }

    return result.rows[0];
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(userId, updateData) {
    await this.getPreferences(userId); // Ensure exists

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = [
      'booking_confirmations', 'booking_reminders', 'health_reminders',
      'vaccination_reminders', 'medication_reminders', 'subscription_updates',
      'payment_alerts', 'promotional', 'community_events', 'care_manager_updates',
      'sms_enabled', 'email_enabled', 'push_enabled', 'whatsapp_enabled',
      'quiet_hours_start', 'quiet_hours_end'
    ];

    fields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    });

    // Emergency alerts always true
    updates.push(`emergency_alerts = true`);
    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE notification_preferences
      SET ${updates.join(', ')}
      WHERE user_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // ==================== TEMPLATES ====================

  /**
   * Get notification template
   */
  async getTemplate(templateCode) {
    const query = `
      SELECT * FROM notification_templates
      WHERE template_code = $1 AND is_active = true
    `;

    const result = await pool.query(query, [templateCode]);
    return result.rows[0] || null;
  }

  // ==================== HELPER METHODS ====================

  getNotificationTypeKey(notificationType) {
    const mapping = {
      'booking_confirmation': 'booking_confirmations',
      'booking_reminder': 'booking_reminders',
      'health_reminder': 'health_reminders',
      'vaccination_reminder': 'vaccination_reminders',
      'medication_reminder': 'medication_reminders',
      'subscription_update': 'subscription_updates',
      'payment_alert': 'payment_alerts',
      'promo': 'promotional',
      'community_event': 'community_events',
      'care_manager_update': 'care_manager_updates',
      'emergency': 'emergency_alerts'
    };

    return mapping[notificationType] || null;
  }

  isQuietHours(preferences) {
    if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = preferences.quiet_hours_start.split(':').map(Number);
    const [endHour, endMin] = preferences.quiet_hours_end.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime < endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  async getUserContactInfo(userId) {
    const query = `SELECT phone, email FROM users WHERE user_id = $1`;
    const result = await pool.query(query, [userId]);
    return result.rows[0] || {};
  }

  async getUserFCMTokens(userId) {
    const query = `
      SELECT fcm_token FROM sessions
      WHERE user_id = $1 AND is_active = true AND fcm_token IS NOT NULL
    `;
    const result = await pool.query(query, [userId]);
    return result.rows.map(row => row.fcm_token);
  }
}

module.exports = new NotificationService();