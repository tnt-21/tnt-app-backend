const { pool } = require("../config/database");
const { AppError } = require("../utils/response.util");
const EncryptionUtil = require("../utils/encryption.util");

class UserService {
  // ==================== USER PROFILE ====================

  async getUserById(userId) {
    const query = `
      SELECT 
        u.user_id,
        u.phone,
        u.email,
        u.full_name,
        u.role_id,
        r.role_name,
        u.profile_photo_url,
        u.date_of_birth,
        u.status,
        u.created_at,
        u.updated_at,
        u.last_login
      FROM users u
      LEFT JOIN user_roles_ref r ON u.role_id = r.role_id
      WHERE u.user_id = $1 AND u.status != 'deleted'
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    return result.rows[0];
  }

  async updateProfile(userId, updateData) {
    const { full_name, email, date_of_birth } = updateData;

    // Check email uniqueness if email is being updated
    if (email) {
      const emailCheck = await pool.query(
        "SELECT user_id FROM users WHERE email = $1 AND user_id != $2",
        [email, userId]
      );

      if (emailCheck.rows.length > 0) {
        throw new AppError("Email already exists", 409, "EMAIL_EXISTS");
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramCount}`);
      values.push(full_name);
      paramCount++;
    }

    if (email !== undefined) {
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    if (date_of_birth !== undefined) {
      updates.push(`date_of_birth = $${paramCount}`);
      values.push(date_of_birth);
      paramCount++;
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE user_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateProfilePhoto(userId, photoUrl) {
    const query = `
      UPDATE users 
      SET profile_photo_url = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING profile_photo_url
    `;

    const result = await pool.query(query, [photoUrl, userId]);
    return result.rows[0];
  }

  async deleteAccount(userId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check for active subscriptions
      const activeSubscriptions = await client.query(
        `SELECT subscription_id FROM subscriptions 
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      if (activeSubscriptions.rows.length > 0) {
        // Cancel active subscriptions
        await client.query(
          `UPDATE subscriptions 
           SET status = 'cancelled', 
               cancellation_date = NOW(),
               cancellation_reason = 'Account deleted by user'
           WHERE user_id = $1 AND status = 'active'`,
          [userId]
        );
      }

      // Soft delete user
      await client.query(
        `UPDATE users 
         SET status = 'deleted', updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      // Invalidate all sessions
      await client.query(
        `UPDATE sessions 
         SET is_active = false 
         WHERE user_id = $1`,
        [userId]
      );

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== ADDRESSES ====================

  async getAddresses(userId) {
    const query = `
      SELECT * FROM user_addresses
      WHERE user_id = $1 AND is_active = true
      ORDER BY is_default DESC, created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async getAddressById(addressId, userId) {
    const query = `
      SELECT * FROM user_addresses
      WHERE address_id = $1 AND user_id = $2 AND is_active = true
    `;

    const result = await pool.query(query, [addressId, userId]);

    if (result.rows.length === 0) {
      throw new AppError("Address not found", 404, "ADDRESS_NOT_FOUND");
    }

    return result.rows[0];
  }

  async createAddress(userId, addressData) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check address count limit
      const countResult = await client.query(
        "SELECT COUNT(*) as count FROM user_addresses WHERE user_id = $1 AND is_active = true",
        [userId]
      );

      const addressCount = parseInt(countResult.rows[0].count);
      const maxAddresses = 10; // Configurable

      if (addressCount >= maxAddresses) {
        throw new AppError(
          `Maximum ${maxAddresses} addresses allowed`,
          400,
          "MAX_ADDRESSES_REACHED"
        );
      }

      // If this is first address or explicitly set as default, make it default
      const isDefault = addressCount === 0 || addressData.is_default === true;

      // If setting as default, unset other defaults
      if (isDefault) {
        await client.query(
          "UPDATE user_addresses SET is_default = false WHERE user_id = $1",
          [userId]
        );
      }

      const query = `
        INSERT INTO user_addresses (
          user_id, label, address_line1, address_line2, landmark,
          city, state, pincode, country, latitude, longitude, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const values = [
        userId,
        addressData.label,
        addressData.address_line1,
        addressData.address_line2 || null,
        addressData.landmark || null,
        addressData.city,
        addressData.state,
        addressData.pincode,
        addressData.country || "India",
        addressData.latitude || null,
        addressData.longitude || null,
        isDefault,
      ];

      const result = await client.query(query, values);

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateAddress(addressId, userId, updateData) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verify ownership
      const existing = await this.getAddressById(addressId, userId);

      // If setting as default, unset other defaults
      if (updateData.is_default === true) {
        await client.query(
          "UPDATE user_addresses SET is_default = false WHERE user_id = $1",
          [userId]
        );
      }

      const updates = [];
      const values = [];
      let paramCount = 1;

      const fields = [
        "label",
        "address_line1",
        "address_line2",
        "landmark",
        "city",
        "state",
        "pincode",
        "latitude",
        "longitude",
        "is_default",
      ];

      fields.forEach((field) => {
        if (updateData[field] !== undefined) {
          updates.push(`${field} = $${paramCount}`);
          values.push(updateData[field]);
          paramCount++;
        }
      });

      updates.push(`updated_at = NOW()`);
      values.push(addressId, userId);

      const query = `
        UPDATE user_addresses 
        SET ${updates.join(", ")}
        WHERE address_id = $${paramCount} AND user_id = $${paramCount + 1}
        RETURNING *
      `;

      const result = await client.query(query, values);

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async setDefaultAddress(addressId, userId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verify ownership
      await this.getAddressById(addressId, userId);

      // Unset all defaults
      await client.query(
        "UPDATE user_addresses SET is_default = false WHERE user_id = $1",
        [userId]
      );

      // Set this as default
      const result = await client.query(
        `UPDATE user_addresses 
         SET is_default = true, updated_at = NOW()
         WHERE address_id = $1 AND user_id = $2
         RETURNING *`,
        [addressId, userId]
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteAddress(addressId, userId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verify ownership
      const address = await this.getAddressById(addressId, userId);

      // Check if it's the only address
      const countResult = await client.query(
        "SELECT COUNT(*) as count FROM user_addresses WHERE user_id = $1 AND is_active = true",
        [userId]
      );

      if (parseInt(countResult.rows[0].count) === 1) {
        throw new AppError(
          "Cannot delete the only address",
          400,
          "CANNOT_DELETE_ONLY_ADDRESS"
        );
      }

      // Soft delete
      await client.query(
        "UPDATE user_addresses SET is_active = false WHERE address_id = $1",
        [addressId]
      );

      // If this was default, set another as default
      if (address.is_default) {
        // await client.query(
        //   `UPDATE user_addresses
        //    SET is_default = true
        //    WHERE user_id = $1 AND is_active = true
        //    ORDER BY created_at DESC
        //    LIMIT 1`,
        //   [userId]
        // );
        await client.query(
          `UPDATE user_addresses
           SET is_default = true
           WHERE address_id = (
             SELECT address_id
             FROM user_addresses
             WHERE user_id = $1 AND is_active = true
             ORDER BY created_at DESC
             LIMIT 1
           )`,
          [userId]
        );
      }

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== PREFERENCES ====================

  async getPreferences(userId) {
    let query = `
      SELECT * FROM user_preferences WHERE user_id = $1
    `;

    let result = await pool.query(query, [userId]);

    // Create default preferences if don't exist
    if (result.rows.length === 0) {
      const insertQuery = `
        INSERT INTO user_preferences (user_id)
        VALUES ($1)
        RETURNING *
      `;
      result = await pool.query(insertQuery, [userId]);
    }

    return result.rows[0];
  }

  async updatePreferences(userId, updateData) {
    // Ensure preferences exist
    await this.getPreferences(userId);

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = [
      "language",
      "timezone",
      "currency",
      "notification_enabled",
      "sms_enabled",
      "email_enabled",
      "push_enabled",
      "whatsapp_enabled",
      "theme",
    ];

    fields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    });

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE user_preferences 
      SET ${updates.join(", ")}
      WHERE user_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // ==================== NOTIFICATION PREFERENCES ====================

  async getNotificationPreferences(userId) {
    let query = `
      SELECT * FROM notification_preferences WHERE user_id = $1
    `;

    let result = await pool.query(query, [userId]);

    // Create default if don't exist
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

  async updateNotificationPreferences(userId, updateData) {
    // Ensure preferences exist
    await this.getNotificationPreferences(userId);

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = [
      "booking_confirmations",
      "booking_reminders",
      "health_reminders",
      "vaccination_reminders",
      "medication_reminders",
      "subscription_updates",
      "payment_alerts",
      "promotional",
      "community_events",
      "care_manager_updates",
      "sms_enabled",
      "email_enabled",
      "push_enabled",
      "whatsapp_enabled",
      "quiet_hours_start",
      "quiet_hours_end",
    ];

    fields.forEach((field) => {
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
      SET ${updates.join(", ")}
      WHERE user_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // ==================== SESSIONS ====================

  async getSessions(userId) {
    const query = `
      SELECT 
        session_id,
        device_type,
        device_name,
        ip_address,
        last_activity,
        is_active,
        created_at
      FROM sessions
      WHERE user_id = $1 AND is_active = true
      ORDER BY last_activity DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async revokeSession(sessionId, userId, currentSessionId) {
    if (sessionId === currentSessionId) {
      throw new AppError(
        "Cannot revoke current session. Use logout instead.",
        400,
        "CANNOT_DELETE_CURRENT_SESSION"
      );
    }

    const query = `
      UPDATE sessions 
      SET is_active = false 
      WHERE session_id = $1 AND user_id = $2
      RETURNING session_id
    `;

    const result = await pool.query(query, [sessionId, userId]);

    if (result.rows.length === 0) {
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    }

    return true;
  }

  async revokeAllOtherSessions(userId, currentSessionId) {
    const query = `
      UPDATE sessions 
      SET is_active = false 
      WHERE user_id = $1 AND session_id != $2 AND is_active = true
    `;

    await pool.query(query, [userId, currentSessionId]);
    return true;
  }

  async logout(sessionId) {
    const query = `
      UPDATE sessions 
      SET is_active = false 
      WHERE session_id = $1
    `;

    await pool.query(query, [sessionId]);
    return true;
  }

  // ==================== PHONE & EMAIL UPDATE ====================

  async updatePhone(userId, newPhone, otp) {
    // ✅ Validate phone format
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(newPhone)) {
      throw new AppError("Invalid phone number format", 400, "INVALID_PHONE");
    }

    // ✅ Check if phone already exists
    const phoneCheck = await pool.query(
      "SELECT user_id FROM users WHERE phone = $1 AND user_id != $2",
      [newPhone, userId]
    );

    if (phoneCheck.rows.length > 0) {
      throw new AppError(
        "Phone number already registered",
        409,
        "PHONE_EXISTS"
      );
    }

    // ✅ Fetch latest OTP record for this specific phone and purpose
    const otpCheckResult = await pool.query(
      `SELECT * FROM otp_verifications 
     WHERE user_id = $1
     AND purpose = 'phone_update' 
     AND verified = false 
     AND expires_at > NOW()
     AND attempts < $2
     ORDER BY created_at DESC 
     LIMIT 1`,
      [userId, 3] // authConfig.otp.maxAttempts
    );

    if (otpCheckResult.rows.length === 0) {
      throw new AppError("Invalid or expired OTP", 400, "INVALID_OTP");
    }

    const otpRecord = otpCheckResult.rows[0];

    // ✅ Verify the new_phone matches what was requested
    const metadata = otpRecord.metadata || {};
    if (metadata.new_phone !== newPhone) {
      throw new AppError(
        "Phone number does not match the one OTP was sent for",
        400,
        "PHONE_MISMATCH"
      );
    }

    // ✅ Increment attempt count
    await pool.query(
      "UPDATE otp_verifications SET attempts = attempts + 1 WHERE otp_id = $1",
      [otpRecord.otp_id]
    );

    // ✅ Compare OTP using EncryptionUtil
    const isValid = await EncryptionUtil.compare(otp, otpRecord.otp);

    if (!isValid) {
      const attemptsLeft = 3 - (otpRecord.attempts + 1);
      throw new AppError(
        `Invalid OTP. ${attemptsLeft} attempt${
          attemptsLeft !== 1 ? "s" : ""
        } remaining`,
        400,
        "INVALID_OTP"
      );
    }

    // ✅ Now update phone in transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Update phone number
      await client.query(
        "UPDATE users SET phone = $1, updated_at = NOW() WHERE user_id = $2",
        [newPhone, userId]
      );

      // Mark OTP as verified
      await client.query(
        "UPDATE otp_verifications SET verified = true, verified_at = NOW() WHERE otp_id = $1",
        [otpRecord.otp_id]
      );

      // Invalidate all sessions (force re-login with new phone)
      await client.query(
        "UPDATE sessions SET is_active = false WHERE user_id = $1",
        [userId]
      );

      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async updateEmail(userId, newEmail, otp) {
    // ✅ Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new AppError("Invalid email format", 400, "INVALID_EMAIL");
    }
  
    // ✅ Check if email already exists
    const emailCheck = await pool.query(
      "SELECT user_id FROM users WHERE email = $1 AND user_id != $2",
      [newEmail, userId]
    );
  
    if (emailCheck.rows.length > 0) {
      throw new AppError("Email already registered", 409, "EMAIL_EXISTS");
    }
  
    // ✅ Fetch latest OTP record
    const otpCheckResult = await pool.query(
      `SELECT * FROM otp_verifications 
     WHERE user_id = $1
     AND purpose = 'email_update' 
     AND verified = false 
     AND expires_at > NOW()
     AND attempts < $2
     ORDER BY created_at DESC 
     LIMIT 1`,
      [userId, 3]
    );
  
    if (otpCheckResult.rows.length === 0) {
      throw new AppError("Invalid or expired OTP", 400, "INVALID_OTP");
    }
  
    const otpRecord = otpCheckResult.rows[0];
  
    // ✅ Handle metadata - it's already parsed by PostgreSQL
    const metadata = otpRecord.metadata || {};
    
    // ✅ Verify the new_email matches what was requested
    if (metadata.new_email !== newEmail) {
      throw new AppError(
        "Email does not match the one OTP was sent for",
        400,
        "EMAIL_MISMATCH"
      );
    }
  
    // ✅ Increment attempt count
    await pool.query(
      "UPDATE otp_verifications SET attempts = attempts + 1 WHERE otp_id = $1",
      [otpRecord.otp_id]
    );
  
    // ✅ Compare OTP using EncryptionUtil
    const isValid = await EncryptionUtil.compare(otp, otpRecord.otp);
  
    if (!isValid) {
      const attemptsLeft = 3 - (otpRecord.attempts + 1);
      throw new AppError(
        `Invalid OTP. ${attemptsLeft} attempt${
          attemptsLeft !== 1 ? "s" : ""
        } remaining`,
        400,
        "INVALID_OTP"
      );
    }
  
    // ✅ Update email in transaction
    const client = await pool.connect();
  
    try {
      await client.query("BEGIN");
  
      // Update email
      const result = await client.query(
        "UPDATE users SET email = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *",
        [newEmail, userId]
      );
  
      // Mark OTP as verified
      await client.query(
        "UPDATE otp_verifications SET verified = true, verified_at = NOW() WHERE otp_id = $1",
        [otpRecord.otp_id]
      );
  
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new UserService();
