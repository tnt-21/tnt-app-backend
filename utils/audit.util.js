const { pool } = require('../config/database');

class AuditUtil {
  async log(auditData) {
    const {
      user_id,
      admin_id,
      action,
      entity_type,
      entity_id,
      old_value,
      new_value,
      changes_summary,
      ip_address,
      user_agent,
      severity = 'info'
    } = auditData;

    const query = `
      INSERT INTO audit_logs (
        user_id, admin_id, action, entity_type, entity_id,
        old_value, new_value, changes_summary,
        ip_address, user_agent, severity
      ) VALUES (
        $1, 
        (SELECT admin_id FROM admin_users WHERE user_id = $2 OR admin_id = $2 LIMIT 1), 
        $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      RETURNING log_id
    `;

    // ✅ Helper to safely stringify JSON values (old_value, new_value)
    const safeStringify = (value) => {
      // Return null for undefined or null values
      if (value === null || value === undefined) {
        return null;
      }
      
      // If it's already a valid JSON string, return as-is
      if (typeof value === 'string') {
        try {
          JSON.parse(value); // Test if it's valid JSON
          return value;
        } catch {
          // If it's not valid JSON, stringify it as a string value
          return JSON.stringify(value);
        }
      }
      
      // For objects, arrays, etc., stringify them
      try {
        return JSON.stringify(value);
      } catch (err) {
        console.error('Error stringifying audit log value:', err);
        console.error('Value that failed:', value);
        // Return null instead of trying to convert - safer for JSON columns
        return null;
      }
    };

    // ✅ Helper to safely convert to string (for text fields like ip_address, user_agent)
    const safeToString = (value) => {
      if (value === null || value === undefined) {
        return null;
      }
      
      // If it's already a string, return as-is
      if (typeof value === 'string') {
        return value;
      }
      
      // If it's an object, stringify it first, then return
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (err) {
          console.error('Error converting object to string:', err);
          return null;
        }
      }
      
      // For primitives (numbers, booleans, etc.), convert to string
      return String(value);
    };

    const values = [
      user_id || null,
      admin_id || null,
      action,
      entity_type,
      entity_id || null,
      safeStringify(old_value),    // JSONB column
      safeStringify(new_value),    // JSONB column
      changes_summary || null,
      safeToString(ip_address),    // TEXT column - handle objects properly
      safeToString(user_agent),    // TEXT column - handle objects properly
      severity
    ];

    try {
      // Debug logging
      console.log('Audit log values being inserted:', {
        user_id: values[0],
        admin_id: values[1],
        action: values[2],
        entity_type: values[3],
        entity_id: values[4],
        old_value: values[5],
        new_value: values[6],
        changes_summary: values[7],
        ip_address: values[8],
        ip_address_type: typeof values[8],
        user_agent: values[9],
        user_agent_type: typeof values[9],
        severity: values[10]
      });

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      // Don't throw error for audit logging failures
      console.error('Audit logging failed:', error);
      console.error('Audit data:', auditData);
      console.error('Query values:', values);
      return null;
    }
  }

  /**
   * Log multiple audit entries in a transaction
   */
  async logBatch(auditDataArray) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results = [];
      for (const auditData of auditDataArray) {
        const result = await this.log(auditData);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Batch audit logging failed:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityLogs(entityType, entityId, limit = 50) {
    const query = `
      SELECT 
        log_id,
        user_id,
        admin_id,
        action,
        entity_type,
        entity_id,
        old_value,
        new_value,
        changes_summary,
        ip_address,
        severity,
        created_at
      FROM audit_logs
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;

    try {
      const result = await pool.query(query, [entityType, entityId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for a user
   */
  async getUserLogs(userId, limit = 50) {
    const query = `
      SELECT 
        log_id,
        action,
        entity_type,
        entity_id,
        changes_summary,
        ip_address,
        created_at
      FROM audit_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching user audit logs:', error);
      return [];
    }
  }
}

module.exports = new AuditUtil();