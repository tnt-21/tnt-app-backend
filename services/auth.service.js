// ============================================
// FILE: services/auth.service.js
// Core Authentication Logic
// ============================================

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const authConfig = require('../config/auth');
const EncryptionUtil = require('../utils/encryption.util');
const smsService = require('./sms.service');

class AuthService {
  /**
   * Send OTP to phone number
   */
  async sendOTP(phone, ipAddress) {
    try {
      // Generate OTP
      const otp = EncryptionUtil.generateOTP(authConfig.otp.length);
      const hashedOTP = await EncryptionUtil.hash(otp);
      
      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + authConfig.otp.expiryMinutes);

      // Check if user exists (for returning vs new user flow)
      const userCheck = await pool.query(
        'SELECT user_id FROM users WHERE phone = $1',
        [phone]
      );
      const userId = userCheck.rows[0]?.user_id || null;

      // Store OTP in database
      await pool.query(
        `INSERT INTO otp_verifications 
         (otp_id, user_id, phone, otp, purpose, expires_at, ip_address) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), userId, phone, hashedOTP, 'login', expiresAt, ipAddress]
      );

      // Send OTP via SMS
      await smsService.sendOTP(phone, otp);

      return {
        success: true,
        message: 'OTP sent successfully',
        expiresIn: authConfig.otp.expiryMinutes * 60, // seconds
        isNewUser: !userId,
        otp // temporary as we do not have real SMS sending in dev
      };
    } catch (error) {
      console.error('Send OTP error:', error);
      throw new Error('Failed to send OTP');
    }
  }

  /**
   * Verify OTP and authenticate user
   */
  async verifyOTP(phone, otp, deviceInfo = {}) {
    try {
      // Find the most recent valid OTP
      const otpRecord = await pool.query(
        `SELECT * FROM otp_verifications 
         WHERE phone = $1 
         AND verified = false 
         AND expires_at > NOW()
         AND attempts < $2
         ORDER BY created_at DESC 
         LIMIT 1`,
        [phone, authConfig.otp.maxAttempts]
      );

      if (otpRecord.rows.length === 0) {
        throw new Error('OTP expired or invalid');
      }

      const record = otpRecord.rows[0];

      // Increment attempt count
      await pool.query(
        'UPDATE otp_verifications SET attempts = attempts + 1 WHERE otp_id = $1',
        [record.otp_id]
      );

      // Verify OTP
      const isValid = await EncryptionUtil.compare(otp, record.otp);
      
      if (!isValid) {
        const attemptsLeft = authConfig.otp.maxAttempts - (record.attempts + 1);
        throw new Error(`Invalid OTP. ${attemptsLeft} attempts remaining`);
      }

      // Mark OTP as verified
      await pool.query(
        `UPDATE otp_verifications 
         SET verified = true, verified_at = NOW() 
         WHERE otp_id = $1`,
        [record.otp_id]
      );

      // Find or create user
      let user = await this.findOrCreateUser(phone);

      // Create session
      const session = await this.createSession(user.user_id, deviceInfo);

      // Generate tokens
      const tokens = this.generateTokens(user, session.session_id);

      return {
        success: true,
        user: {
          user_id: user.user_id,
          phone: user.phone,
          full_name: user.full_name,
          email: user.email,
          role: user.role_code
        },
        tokens,
        isNewUser: !user.full_name // Profile incomplete
      };
    } catch (error) {
      console.error('Verify OTP error:', error);
      throw error;
    }
  }

  /**
   * Find existing user or create new one
   */
  async findOrCreateUser(phone) {
    // Check if user exists
    let userResult = await pool.query(
      `SELECT u.*, r.role_code 
       FROM users u 
       JOIN user_roles_ref r ON u.role_id = r.role_id 
       WHERE u.phone = $1`,
      [phone]
    );

    if (userResult.rows.length > 0) {
      return userResult.rows[0];
    }

    // Create new user with 'customer' role
    const roleResult = await pool.query(
      "SELECT role_id FROM user_roles_ref WHERE role_code = 'customer'"
    );
    
    const newUserId = uuidv4();
    
    await pool.query(
      `INSERT INTO users (user_id, phone, role_id, status, created_at) 
       VALUES ($1, $2, $3, 'active', NOW())`,
      [newUserId, phone, roleResult.rows[0].role_id]
    );

    // Create default preferences
    await pool.query(
      `INSERT INTO user_preferences (preference_id, user_id) 
       VALUES ($1, $2)`,
      [uuidv4(), newUserId]
    );

    // Fetch newly created user
    userResult = await pool.query(
      `SELECT u.*, r.role_code 
       FROM users u 
       JOIN user_roles_ref r ON u.role_id = r.role_id 
       WHERE u.user_id = $1`,
      [newUserId]
    );

    return userResult.rows[0];
  }

  /**
   * Create user session
   */
  async createSession(userId, deviceInfo) {
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + authConfig.session.expiryDays);

    await pool.query(
      `INSERT INTO sessions 
       (session_id, user_id, device_type, device_name, device_token, 
        fcm_token, ip_address, user_agent, expires_at, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
      [
        sessionId,
        userId,
        deviceInfo.deviceType || null,
        deviceInfo.deviceName || null,
        deviceInfo.deviceToken || null,
        deviceInfo.fcmToken || null,
        deviceInfo.ipAddress || null,
        deviceInfo.userAgent || null,
        expiresAt
      ]
    );

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE user_id = $1',
      [userId]
    );

    return { session_id: sessionId, expires_at: expiresAt };
  }

  /**
   * Generate JWT tokens
   */
  generateTokens(user, sessionId) {
    const accessPayload = {
      user_id: user.user_id,
      phone: user.phone,
      role: user.role_code,
      type: 'access'
    };

    const refreshPayload = {
      user_id: user.user_id,
      session_id: sessionId,
      type: 'refresh'
    };

    const accessToken = jwt.sign(accessPayload, authConfig.jwt.accessSecret, {
      expiresIn: authConfig.jwt.accessExpiresIn
    });

    const refreshToken = jwt.sign(refreshPayload, authConfig.jwt.refreshSecret, {
      expiresIn: authConfig.jwt.refreshExpiresIn
    });

    return {
      accessToken,
      refreshToken,
      accessExpiresIn: authConfig.jwt.accessExpiresIn,
      refreshExpiresIn: authConfig.jwt.refreshExpiresIn
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, authConfig.jwt.refreshSecret);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if session is still active
      const sessionResult = await pool.query(
        `SELECT s.*, u.*, r.role_code 
         FROM sessions s 
         JOIN users u ON s.user_id = u.user_id 
         JOIN user_roles_ref r ON u.role_id = r.role_id
         WHERE s.session_id = $1 
         AND s.is_active = true 
         AND s.expires_at > NOW()`,
        [decoded.session_id]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Session expired or invalid');
      }

      const session = sessionResult.rows[0];

      // Update last activity
      await pool.query(
        'UPDATE sessions SET last_activity = NOW() WHERE session_id = $1',
        [decoded.session_id]
      );

      // Generate new access token
      const accessPayload = {
        user_id: session.user_id,
        phone: session.phone,
        role: session.role_code,
        type: 'access'
      };

      const newAccessToken = jwt.sign(accessPayload, authConfig.jwt.accessSecret, {
        expiresIn: authConfig.jwt.accessExpiresIn
      });

      return {
        accessToken: newAccessToken,
        expiresIn: authConfig.jwt.accessExpiresIn
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Logout - invalidate session
   */
  async logout(sessionId) {
    await pool.query(
      'UPDATE sessions SET is_active = false WHERE session_id = $1',
      [sessionId]
    );

    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token, tokenType = 'access') {
    const secret = tokenType === 'access' 
      ? authConfig.jwt.accessSecret 
      : authConfig.jwt.refreshSecret;

    return jwt.verify(token, secret);
  }
}

module.exports = new AuthService();