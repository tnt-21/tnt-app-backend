// ============================================
// FILE: controllers/audit.controller.js
// Audit Log Controller
// ============================================

const { pool } = require('../config/database');
const ResponseUtil = require('../utils/response.util');

class AuditController {
  /**
   * GET /audit/logs
   * Get audit logs with filtering
   */
  async getAuditLogs(req, res, next) {
    try {
      const {
        admin_id,
        entity_type,
        action,
        severity,
        start_date,
        end_date,
        page = 1,
        limit = 50
      } = req.query;

      let whereConditions = ['1=1'];
      let values = [];
      let paramCount = 1;

      if (admin_id) {
        whereConditions.push(`al.admin_id = $${paramCount}`);
        values.push(admin_id);
        paramCount++;
      }

      if (entity_type) {
        whereConditions.push(`al.entity_type = $${paramCount}`);
        values.push(entity_type);
        paramCount++;
      }

      if (action) {
        whereConditions.push(`al.action = $${paramCount}`);
        values.push(action);
        paramCount++;
      }

      if (severity) {
        whereConditions.push(`al.severity = $${paramCount}`);
        values.push(severity);
        paramCount++;
      }

      if (start_date) {
        whereConditions.push(`al.created_at >= $${paramCount}`);
        values.push(start_date);
        paramCount++;
      }

      if (end_date) {
        whereConditions.push(`al.created_at <= $${paramCount}`);
        values.push(end_date);
        paramCount++;
      }

      const offset = (page - 1) * limit;

      const query = `
        SELECT 
          al.log_id,
          al.admin_id,
          al.user_id,
          al.action,
          al.entity_type,
          al.entity_id,
          al.old_value,
          al.new_value,
          al.changes_summary,
          al.ip_address,
          al.user_agent,
          al.severity,
          al.created_at,
          a.full_name as admin_name,
          a.email as admin_email
        FROM audit_logs al
        LEFT JOIN admin_users a ON al.admin_id = a.admin_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY al.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;

      values.push(limit, offset);

      const countQuery = `
        SELECT COUNT(*) as total
        FROM audit_logs al
        WHERE ${whereConditions.join(' AND ')}
      `;

      const [dataResult, countResult] = await Promise.all([
        pool.query(query, values),
        pool.query(countQuery, values.slice(0, -2))
      ]);

      return ResponseUtil.success(res, {
        logs: dataResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: Math.ceil(countResult.rows[0].total / limit)
        }
      }, 'Audit logs retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /audit/stats
   * Get audit log statistics
   */
  async getAuditStats(req, res, next) {
    try {
      const { start_date, end_date } = req.query;

      let whereCondition = '1=1';
      const values = [];
      let paramCount = 1;

      if (start_date) {
        whereCondition += ` AND created_at >= $${paramCount}`;
        values.push(start_date);
        paramCount++;
      }

      if (end_date) {
        whereCondition += ` AND created_at <= $${paramCount}`;
        values.push(end_date);
        paramCount++;
      }

      const query = `
        SELECT 
          COUNT(*) as total_logs,
          COUNT(DISTINCT admin_id) as unique_admins,
          COUNT(CASE WHEN action = 'CREATE' THEN 1 END) as creates,
          COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) as updates,
          COUNT(CASE WHEN action = 'DELETE' THEN 1 END) as deletes,
          COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity,
          COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_severity,
          COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_severity
        FROM audit_logs
        WHERE ${whereCondition}
      `;

      const result = await pool.query(query, values);

      return ResponseUtil.success(res, result.rows[0], 'Audit statistics retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuditController();
