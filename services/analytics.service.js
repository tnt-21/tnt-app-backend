// ============================================
// FILE: services/analytics.service.js
// Analytics & Reporting Service
// ============================================

const { pool } = require('../config/database');
const { AppError } = require('../utils/response.util');

class AnalyticsService {
  // ==================== USER BEHAVIOR ANALYTICS ====================

  async trackEvent(eventData) {
    const {
      user_id, session_id, event_type, event_name, page_url,
      referrer_url, event_data, device_type, browser, os
    } = eventData;

    const query = `
      INSERT INTO user_behavior_analytics (
        user_id, session_id, event_type, event_name, page_url,
        referrer_url, event_data, device_type, browser, os
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      user_id || null, session_id || null, event_type, event_name || null,
      page_url || null, referrer_url || null,
      event_data ? JSON.stringify(event_data) : null,
      device_type || null, browser || null, os || null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getUserEvents(userId, filters = {}) {
    const { event_type, start_date, end_date, limit = 100 } = filters;

    let whereConditions = ['user_id = $1'];
    let values = [userId];
    let paramCount = 2;

    if (event_type) {
      whereConditions.push(`event_type = $${paramCount}`);
      values.push(event_type);
      paramCount++;
    }

    if (start_date) {
      whereConditions.push(`timestamp >= $${paramCount}`);
      values.push(start_date);
      paramCount++;
    }

    if (end_date) {
      whereConditions.push(`timestamp <= $${paramCount}`);
      values.push(end_date);
      paramCount++;
    }

    const query = `
      SELECT * FROM user_behavior_analytics
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT $${paramCount}
    `;

    values.push(limit);

    const result = await pool.query(query, values);
    return result.rows;
  }

  async getEventStats(filters = {}) {
    const { event_type, start_date, end_date } = filters;

    let whereConditions = [];
    let values = [];
    let paramCount = 1;

    if (event_type) {
      whereConditions.push(`event_type = $${paramCount}`);
      values.push(event_type);
      paramCount++;
    }

    if (start_date) {
      whereConditions.push(`timestamp >= $${paramCount}`);
      values.push(start_date);
      paramCount++;
    }

    if (end_date) {
      whereConditions.push(`timestamp <= $${paramCount}`);
      values.push(end_date);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT 
        event_type,
        COUNT(*) as event_count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT session_id) as unique_sessions,
        DATE(timestamp) as event_date
      FROM user_behavior_analytics
      ${whereClause}
      GROUP BY event_type, DATE(timestamp)
      ORDER BY event_date DESC, event_count DESC
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  // ==================== BUSINESS METRICS ====================

  async recordMetric(metricData) {
    const { metric_date, metric_type, metric_value, breakdown } = metricData;

    const query = `
      INSERT INTO business_metrics (metric_date, metric_type, metric_value, breakdown)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (metric_date, metric_type) 
      DO UPDATE SET 
        metric_value = EXCLUDED.metric_value,
        breakdown = EXCLUDED.breakdown,
        calculated_at = NOW()
      RETURNING *
    `;

    const values = [
      metric_date, metric_type, metric_value,
      breakdown ? JSON.stringify(breakdown) : null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getMetrics(filters = {}) {
    const { metric_type, start_date, end_date } = filters;

    let whereConditions = [];
    let values = [];
    let paramCount = 1;

    if (metric_type) {
      whereConditions.push(`metric_type = $${paramCount}`);
      values.push(metric_type);
      paramCount++;
    }

    if (start_date) {
      whereConditions.push(`metric_date >= $${paramCount}`);
      values.push(start_date);
      paramCount++;
    }

    if (end_date) {
      whereConditions.push(`metric_date <= $${paramCount}`);
      values.push(end_date);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT * FROM business_metrics
      ${whereClause}
      ORDER BY metric_date DESC, metric_type
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  async calculateDailyRevenue(date) {
    const query = `
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COUNT(*) as transaction_count,
        COUNT(DISTINCT user_id) as unique_customers
      FROM payments
      WHERE DATE(payment_date) = $1 AND status = 'success'
    `;

    const result = await pool.query(query, [date]);
    const data = result.rows[0];

    // Record metric
    await this.recordMetric({
      metric_date: date,
      metric_type: 'daily_revenue',
      metric_value: data.total_revenue,
      breakdown: {
        transaction_count: data.transaction_count,
        unique_customers: data.unique_customers
      }
    });

    return data;
  }

  async calculateActiveSubscriptions(date) {
    const query = `
      SELECT 
        COUNT(*) as total_active,
        tier_id,
        st.tier_name,
        COUNT(*) as count
      FROM subscriptions s
      JOIN subscription_tiers_ref st ON s.tier_id = st.tier_id
      WHERE status = 'active'
        AND start_date <= $1
        AND (end_date IS NULL OR end_date >= $1)
      GROUP BY tier_id, st.tier_name
    `;

    const result = await pool.query(query, [date]);
    const totalActive = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);

    const breakdown = {};
    result.rows.forEach(row => {
      breakdown[row.tier_name] = parseInt(row.count);
    });

    await this.recordMetric({
      metric_date: date,
      metric_type: 'active_subscriptions',
      metric_value: totalActive,
      breakdown
    });

    return { total_active: totalActive, by_tier: result.rows };
  }

  async calculateBookingsCount(date) {
    const query = `
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status_id = (SELECT status_id FROM booking_statuses_ref WHERE status_code = 'completed') THEN 1 END) as completed,
        COUNT(CASE WHEN status_id = (SELECT status_id FROM booking_statuses_ref WHERE status_code = 'cancelled') THEN 1 END) as cancelled,
        COUNT(DISTINCT user_id) as unique_customers
      FROM bookings
      WHERE DATE(booking_date) = $1
    `;

    const result = await pool.query(query, [date]);
    const data = result.rows[0];

    await this.recordMetric({
      metric_date: date,
      metric_type: 'bookings_count',
      metric_value: data.total_bookings,
      breakdown: {
        completed: data.completed,
        cancelled: data.cancelled,
        unique_customers: data.unique_customers,
        completion_rate: data.total_bookings > 0 
          ? ((data.completed / data.total_bookings) * 100).toFixed(2)
          : 0
      }
    });

    return data;
  }

  async getDashboardMetrics(filters = {}) {
    const { start_date, end_date } = filters;

    // Default to last 30 days if no dates provided
    const endDate = end_date || new Date().toISOString().split('T')[0];
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [revenue, subscriptions, bookings, users] = await Promise.all([
      this.getMetrics({ metric_type: 'daily_revenue', start_date: startDate, end_date: endDate }),
      this.getMetrics({ metric_type: 'active_subscriptions', start_date: startDate, end_date: endDate }),
      this.getMetrics({ metric_type: 'bookings_count', start_date: startDate, end_date: endDate }),
      pool.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN DATE(created_at) >= $1 THEN 1 END) as new_users
        FROM users
        WHERE status = 'active'
      `, [startDate])
    ]);

    // Calculate totals
    const totalRevenue = revenue.reduce((sum, m) => sum + parseFloat(m.metric_value), 0);
    const avgActiveSubscriptions = subscriptions.length > 0 
      ? subscriptions.reduce((sum, m) => sum + parseFloat(m.metric_value), 0) / subscriptions.length
      : 0;
    const totalBookings = bookings.reduce((sum, m) => sum + parseFloat(m.metric_value), 0);

    return {
      period: { start_date: startDate, end_date: endDate },
      summary: {
        total_revenue: totalRevenue.toFixed(2),
        avg_active_subscriptions: Math.round(avgActiveSubscriptions),
        total_bookings: totalBookings,
        total_users: users.rows[0].total_users,
        new_users: users.rows[0].new_users
      },
      trends: {
        revenue: revenue.map(m => ({
          date: m.metric_date,
          value: m.metric_value,
          breakdown: m.breakdown
        })),
        subscriptions: subscriptions.map(m => ({
          date: m.metric_date,
          value: m.metric_value,
          breakdown: m.breakdown
        })),
        bookings: bookings.map(m => ({
          date: m.metric_date,
          value: m.metric_value,
          breakdown: m.breakdown
        }))
      }
    };
  }

  async getSubscriptionMetrics() {
    const query = `
      SELECT 
        COUNT(*) as total_subscriptions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        tier_id,
        st.tier_name,
        AVG(final_price) as avg_price
      FROM subscriptions s
      JOIN subscription_tiers_ref st ON s.tier_id = st.tier_id
      GROUP BY tier_id, st.tier_name
      ORDER BY tier_id
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  async getRevenueBreakdown(filters = {}) {
    const { start_date, end_date } = filters;

    let whereConditions = ["p.status = 'success'"];
    let values = [];
    let paramCount = 1;

    if (start_date) {
      whereConditions.push(`DATE(p.payment_date) >= $${paramCount}`);
      values.push(start_date);
      paramCount++;
    }

    if (end_date) {
      whereConditions.push(`DATE(p.payment_date) <= $${paramCount}`);
      values.push(end_date);
      paramCount++;
    }

    const query = `
      SELECT 
        i.invoice_type,
        COUNT(*) as transaction_count,
        SUM(p.amount) as total_amount,
        AVG(p.amount) as avg_amount
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.invoice_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY i.invoice_type
      ORDER BY total_amount DESC
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  async getCaregiverPerformance(filters = {}) {
    const { start_date, end_date, limit = 20 } = filters;

    let whereConditions = [];
    let values = [];
    let paramCount = 1;

    if (start_date) {
      whereConditions.push(`DATE(a.completed_at) >= $${paramCount}`);
      values.push(start_date);
      paramCount++;
    }

    if (end_date) {
      whereConditions.push(`DATE(a.completed_at) <= $${paramCount}`);
      values.push(end_date);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT 
        c.caregiver_id,
        c.full_name,
        c.average_rating,
        COUNT(a.assignment_id) as total_assignments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_assignments,
        SUM(a.total_earnings) as total_earnings,
        AVG(a.service_time_minutes) as avg_service_time
      FROM caregivers c
      LEFT JOIN assignments a ON c.caregiver_id = a.caregiver_id
      ${whereClause}
      GROUP BY c.caregiver_id, c.full_name, c.average_rating
      HAVING COUNT(a.assignment_id) > 0
      ORDER BY total_earnings DESC
      LIMIT $${paramCount}
    `;

    values.push(limit);

    const result = await pool.query(query, values);
    return result.rows;
  }
}

module.exports = new AnalyticsService();