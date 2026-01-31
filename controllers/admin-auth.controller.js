// ============================================
// FILE: controllers/admin-auth.controller.js
// Admin Authentication Controllers
// ============================================

const authService = require('../services/auth.service');
const { pool } = require('../config/database');
const ResponseUtil = require('../utils/response.util');
const EncryptionUtil = require('../utils/encryption.util');
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth');

class AdminAuthController {
  /**
   * POST /auth/admin/login
   * Admin login with email and password
   */
  async adminLogin(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return ResponseUtil.validationError(res, {
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined
        });
      }

      // Find admin user by email
      const userResult = await pool.query(
        `SELECT u.*, r.role_code, r.role_name
         FROM users u
         JOIN user_roles_ref r ON u.role_id = r.role_id
         WHERE u.email = $1 
         AND r.role_code IN ('admin', 'super_admin', 'support_agent')
         AND u.status = 'active'`,
        [email]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtil.error(res, 'Invalid email or password', 401);
      }

      const user = userResult.rows[0];

      // Verify password
      if (!user.password_hash) {
        return ResponseUtil.error(res, 'Password not set for this account', 401);
      }

      const isValidPassword = await EncryptionUtil.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return ResponseUtil.error(res, 'Invalid email or password', 401);
      }

      // Create session
      const deviceInfo = {
        deviceType: 'web',
        deviceName: 'Admin Dashboard',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      };

      const session = await authService.createSession(user.user_id, deviceInfo);

      // Generate tokens
      const tokens = authService.generateTokens(user, session.session_id);

      return ResponseUtil.success(res, {
        user: {
          user_id: user.user_id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role_code,
          is_active: user.status === 'active'
        },
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }, 'Login successful');
    } catch (error) {
      console.error('Admin login error:', error);
      return ResponseUtil.error(res, 'Login failed', 500);
    }
  }

  /**
   * GET /auth/me
   * Get current admin user profile
   */
  async getCurrentAdmin(req, res) {
    try {
      // req.user is set by auth middleware
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

      const user = result.rows[0];

      return ResponseUtil.success(res, {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role_code,
        is_active: user.status === 'active',
        created_at: user.created_at
      });
    } catch (error) {
      console.error('Get current admin error:', error);
      return ResponseUtil.error(res, 'Failed to fetch user data', 500);
    }
  }
}

module.exports = new AdminAuthController();
