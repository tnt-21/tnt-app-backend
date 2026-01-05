const userService = require("../services/user.service");
const uploadService = require("../services/upload.service");
const auditUtil = require("../utils/audit.util");
const ResponseUtil = require("../utils/response.util");
const { AppError } = require("../utils/response.util");

class UserController {
  // ==================== USER PROFILE ====================

  async getProfile(req, res, next) {
    try {
      const userId = req.user.user_id;
      const user = await userService.getUserById(userId);

      return ResponseUtil.success(res, user, "Profile retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const userId = req.user.user_id;
      const updateData = req.body;

      const oldUser = await userService.getUserById(userId);
      const updatedUser = await userService.updateProfile(userId, updateData);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "user",
        entity_id: userId,
        old_value: oldUser,
        new_value: updatedUser,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        updatedUser,
        "Profile updated successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async uploadProfilePhoto(req, res, next) {
    try {
      const userId = req.user.user_id;

      if (!req.file) {
        return ResponseUtil.error(res, "No file uploaded", 400);
      }

      const photoUrl = await uploadService.uploadProfilePhoto(req.file, userId);
      const result = await userService.updateProfilePhoto(userId, photoUrl);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "user",
        entity_id: userId,
        changes_summary: "Profile photo updated",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        result,
        "Profile photo uploaded successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req, res, next) {
    try {
      const userId = req.user.user_id;

      await userService.deleteAccount(userId);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "delete",
        entity_type: "user",
        entity_id: userId,
        changes_summary: "Account deleted by user",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Account deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== ADDRESSES ====================

  async getAddresses(req, res, next) {
    try {
      const userId = req.user.user_id;
      const addresses = await userService.getAddresses(userId);

      return ResponseUtil.success(
        res,
        { addresses },
        "Addresses retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async getAddress(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { address_id } = req.params;

      const address = await userService.getAddressById(address_id, userId);

      return ResponseUtil.success(
        res,
        address,
        "Address retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async createAddress(req, res, next) {
    try {
      const userId = req.user.user_id;
      const addressData = req.body;

      const address = await userService.createAddress(userId, addressData);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "create",
        entity_type: "user_address",
        entity_id: address.address_id,
        new_value: address,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        address,
        "Address created successfully",
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async updateAddress(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { address_id } = req.params;
      const updateData = req.body;

      const oldAddress = await userService.getAddressById(address_id, userId);
      const address = await userService.updateAddress(
        address_id,
        userId,
        updateData
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "user_address",
        entity_id: address_id,
        old_value: oldAddress,
        new_value: address,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, address, "Address updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async setDefaultAddress(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { address_id } = req.params;

      const address = await userService.setDefaultAddress(address_id, userId);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "user_address",
        entity_id: address_id,
        changes_summary: "Set as default address",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        address,
        "Default address updated successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteAddress(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { address_id } = req.params;

      await userService.deleteAddress(address_id, userId);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "delete",
        entity_type: "user_address",
        entity_id: address_id,
        changes_summary: "Address deleted",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Address deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== PREFERENCES ====================

  async getPreferences(req, res, next) {
    try {
      const userId = req.user.user_id;
      const preferences = await userService.getPreferences(userId);

      return ResponseUtil.success(
        res,
        preferences,
        "Preferences retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req, res, next) {
    try {
      const userId = req.user.user_id;
      const updateData = req.body;

      const preferences = await userService.updatePreferences(
        userId,
        updateData
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "user_preferences",
        entity_id: userId,
        new_value: preferences,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        preferences,
        "Preferences updated successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== NOTIFICATION PREFERENCES ====================

  async getNotificationPreferences(req, res, next) {
    try {
      const userId = req.user.user_id;
      const preferences = await userService.getNotificationPreferences(userId);

      return ResponseUtil.success(
        res,
        preferences,
        "Notification preferences retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async updateNotificationPreferences(req, res, next) {
    try {
      const userId = req.user.user_id;
      const updateData = req.body;

      const preferences = await userService.updateNotificationPreferences(
        userId,
        updateData
      );

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "notification_preferences",
        entity_id: userId,
        new_value: preferences,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        preferences,
        "Notification preferences updated successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== SESSIONS ====================

  async getSessions(req, res, next) {
    try {
      const userId = req.user.user_id;
      const currentSessionId = req.auth?.session_id;

      const sessions = await userService.getSessions(userId);

      // Mark current session
      const sessionsWithCurrent = sessions.map((session) => ({
        ...session,
        is_current: session.session_id === currentSessionId,
      }));

      return ResponseUtil.success(
        res,
        { sessions: sessionsWithCurrent },
        "Sessions retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async revokeSession(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { session_id } = req.params;
      const currentSessionId = req.auth?.session_id;

      await userService.revokeSession(session_id, userId, currentSessionId);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "delete",
        entity_type: "session",
        entity_id: session_id,
        changes_summary: "Session revoked",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Session revoked successfully");
    } catch (error) {
      next(error);
    }
  }

  async revokeAllOtherSessions(req, res, next) {
    try {
      const userId = req.user.user_id;
      const currentSessionId = req.auth?.session_id;

      await userService.revokeAllOtherSessions(userId, currentSessionId);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "delete",
        entity_type: "session",
        changes_summary: "All other sessions revoked",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        null,
        "All other sessions revoked successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const sessionId = req.auth?.session_id;
      const userId = req.user.user_id;

      await userService.logout(sessionId);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: "logout",
        entity_type: "session",
        entity_id: sessionId,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Logged out successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== PHONE & EMAIL UPDATE ====================

  async requestPhoneUpdate(req, res, next) {
    try {
      const { new_phone } = req.body;
      const userId = req.user.user_id;

      // Validate phone format
      const phoneRegex = /^\+91[6-9]\d{9}$/;
      if (!phoneRegex.test(new_phone)) {
        return ResponseUtil.validationError(res, {
          phone: "Invalid phone number. Format: +91XXXXXXXXXX",
        });
      }

      // Check if phone already exists
      const { pool } = require("../config/database");
      const existingPhone = await pool.query(
        "SELECT user_id FROM users WHERE phone = $1 AND user_id != $2",
        [new_phone, userId]
      );

      if (existingPhone.rows.length > 0) {
        return ResponseUtil.error(res, "Phone number already registered", 409);
      }

      const smsService = require("../services/sms.service");
      const EncryptionUtil = require("../utils/encryption.util");
      const authConfig = require("../config/auth");
      const { v4: uuidv4 } = require("uuid");

      // Generate OTP
      const otp = EncryptionUtil.generateOTP(6);
      const hashedOTP = await EncryptionUtil.hash(otp);

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setMinutes(
        expiresAt.getMinutes() + authConfig.otp.expiryMinutes
      );

      // Get user's current phone for storing in phone field
      const user = await userService.getUserById(userId);

      // ✅ Store OTP with metadata containing new_phone
      await pool.query(
        `INSERT INTO otp_verifications 
       (otp_id, user_id, phone, otp, purpose, expires_at, ip_address, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          uuidv4(),
          userId,
          user.phone, // Current phone (for tracking)
          hashedOTP,
          "phone_update",
          expiresAt,
          req.ip,
          JSON.stringify({ new_phone }), // Store new phone in metadata
        ]
      );

      // Send OTP to NEW phone number
      await smsService.sendOTP(new_phone, otp, "phone_update");

      return ResponseUtil.success(
        res,
        {
          new_phone: new_phone,
          expiresIn: authConfig.otp.expiryMinutes * 60, // seconds
          otp: process.env.NODE_ENV !== "production" ? otp : undefined,
        },
        "OTP sent successfully to new phone number"
      );
    } catch (error) {
      next(error);
    }
  }

  async updatePhone(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { new_phone, otp } = req.body;

      await userService.updatePhone(userId, new_phone, otp);

      // ✅ Audit log - don't pass complex objects, just summary
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "user",
        entity_id: userId,
        changes_summary: `Phone number updated to ${new_phone}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(
        res,
        null,
        "Phone number updated successfully. Please login again with your new phone number."
      );
    } catch (error) {
      next(error);
    }
  }

  async requestEmailUpdate(req, res, next) {
    try {
      const { new_email } = req.body;
      const userId = req.user.user_id;

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(new_email)) {
        return ResponseUtil.validationError(res, {
          email: "Invalid email format",
        });
      }

      // Check if email already exists
      const { pool } = require("../config/database");
      const existingEmail = await pool.query(
        "SELECT user_id FROM users WHERE email = $1 AND user_id != $2",
        [new_email, userId]
      );

      if (existingEmail.rows.length > 0) {
        return ResponseUtil.error(res, "Email already registered", 409);
      }

      // Get user's current phone to send OTP
      const user = await userService.getUserById(userId);

      const smsService = require("../services/sms.service");
      const EncryptionUtil = require("../utils/encryption.util");
      const authConfig = require("../config/auth");
      const { v4: uuidv4 } = require("uuid");

      // Generate OTP
      const otp = EncryptionUtil.generateOTP(6);
      const hashedOTP = await EncryptionUtil.hash(otp);

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setMinutes(
        expiresAt.getMinutes() + authConfig.otp.expiryMinutes
      );

      // ✅ Store OTP with metadata containing new_email
      await pool.query(
        `INSERT INTO otp_verifications 
       (otp_id, user_id, phone, otp, purpose, expires_at, ip_address, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          uuidv4(),
          userId,
          user.phone, // Send to current registered phone
          hashedOTP,
          "email_update",
          expiresAt,
          req.ip,
          JSON.stringify({ new_email }), // Store new email in metadata
        ]
      );

      // Send OTP to user's registered phone number (for security)
      await smsService.sendOTP(user.phone, otp, "email_update");

      return ResponseUtil.success(
        res,
        {
          new_email: new_email,
          phone_sent_to: user.phone.replace(
            /(\+91)(\d{6})(\d{4})/,
            "$1******$3"
          ), // Mask phone
          expiresIn: authConfig.otp.expiryMinutes * 60,
          otp: process.env.NODE_ENV !== "production" ? otp : undefined,
        },
        "OTP sent to your registered phone number for security verification"
      );
    } catch (error) {
      next(error);
    }
  }

  async updateEmail(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { new_email, otp } = req.body;
  
      console.log('=== UPDATE EMAIL DEBUG ===');
      console.log('req.ip:', req.ip, 'type:', typeof req.ip);
      console.log('req.headers["user-agent"]:', req.headers["user-agent"], 'type:', typeof req.headers["user-agent"]);
      
      await userService.updateEmail(userId, new_email, otp);
  
      console.log('About to call audit log with:', {
        user_id: userId,
        action: "update",
        entity_type: "user",
        entity_id: userId,
        changes_summary: `Email updated to ${new_email}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });
  
      // ✅ Audit log - don't pass complex objects, just summary
      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "user",
        entity_id: userId,
        changes_summary: `Email updated to ${new_email}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });
  
      return ResponseUtil.success(res, null, "Email updated successfully");
    } catch (error) {
      console.error('Error in updateEmail:', error);
      next(error);
    }
  }
}

module.exports = new UserController();
