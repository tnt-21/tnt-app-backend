// ============================================
// FILE: controllers/auth.controller.js
// Authentication Controllers
// ============================================

const authService = require('../services/auth.service');
const ResponseUtil = require('../utils/response.util');

class AuthController {
  /**
   * POST /auth/send-otp
   * Send OTP to phone number
   */
  async sendOTP(req, res) {
    try {
      const { phone } = req.body;

      if (!phone) {
        return ResponseUtil.validationError(res, { phone: 'Phone number is required' });
      }

      // Validate phone format (Indian numbers)
      const phoneRegex = /^\+91[6-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return ResponseUtil.validationError(res, { 
          phone: 'Invalid phone number. Format: +91XXXXXXXXXX' 
        });
      }

      const result = await authService.sendOTP(phone, req.ip);

      return ResponseUtil.success(res, result, 'OTP sent successfully');
    } catch (error) {
      console.error('Send OTP error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  /**
   * POST /auth/verify-otp
   * Verify OTP and login/register
   */
  async verifyOTP(req, res) {
    try {
      const { phone, otp } = req.body;

      if (!phone || !otp) {
        return ResponseUtil.validationError(res, {
          phone: !phone ? 'Phone number is required' : undefined,
          otp: !otp ? 'OTP is required' : undefined
        });
      }

      // Device info for session tracking
      const deviceInfo = {
        deviceType: req.body.deviceType,
        deviceName: req.body.deviceName,
        deviceToken: req.body.deviceToken,
        fcmToken: req.body.fcmToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      };

      const result = await authService.verifyOTP(phone, otp, deviceInfo);

      return ResponseUtil.success(res, result, 'Login successful');
    } catch (error) {
      console.error('Verify OTP error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  /**
   * POST /auth/refresh-token
   * Get new access token using refresh token
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return ResponseUtil.validationError(res, { 
          refreshToken: 'Refresh token is required' 
        });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      return ResponseUtil.success(res, result, 'Token refreshed successfully');
    } catch (error) {
      console.error('Refresh token error:', error);
      return ResponseUtil.error(res, error.message, 401);
    }
  }

  /**
   * POST /auth/logout
   * Logout user and invalidate session
   */
  async logout(req, res) {
    try {
      // Extract session_id from refresh token if provided
      const { refreshToken } = req.body;

      if (refreshToken) {
        const decoded = authService.verifyToken(refreshToken, 'refresh');
        await authService.logout(decoded.session_id);
      }

      return ResponseUtil.success(res, {}, 'Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      return ResponseUtil.success(res, {}, 'Logged out successfully');
    }
  }

  /**
   * GET /auth/me
   * Get current user info (protected route)
   */
  async getCurrentUser(req, res) {
    try {
      // req.user is set by auth middleware
      const { pool } = require('../config/database');
      
      const result = await pool.query(
        `SELECT u.user_id, u.phone, u.email, u.full_name, u.profile_photo_url, 
                u.date_of_birth, u.status, r.role_code, r.role_name
         FROM users u
         JOIN user_roles_ref r ON u.role_id = r.role_id
         WHERE u.user_id = $1`,
        [req.user.user_id]
      );

      if (result.rows.length === 0) {
        return ResponseUtil.notFound(res, 'User not found');
      }

      return ResponseUtil.success(res, { user: result.rows[0] });
    } catch (error) {
      console.error('Get current user error:', error);
      return ResponseUtil.error(res, 'Failed to fetch user data', 500);
    }
  }
}

module.exports = new AuthController();