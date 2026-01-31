// ============================================
// FILE: scripts/create-admin.js
// Create Admin User Script
// ============================================

require('dotenv').config();
const { pool } = require('../config/database');
const EncryptionUtil = require('../utils/encryption.util');
const { v4: uuidv4 } = require('uuid');

async function createAdminUser() {
  try {
    console.log('🔐 Creating admin user...\n');

    // Admin details
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tailsandtales.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = process.env.ADMIN_NAME || 'Admin User';
    const adminPhone = process.env.ADMIN_PHONE || '+919999999999';

    // Check if admin role exists
    const roleResult = await pool.query(
      "SELECT role_id FROM user_roles_ref WHERE role_code = 'admin'"
    );

    if (roleResult.rows.length === 0) {
      console.error('❌ Admin role not found in database');
      console.log('Creating admin role...');
      
      const roleId = uuidv4();
      await pool.query(
        `INSERT INTO user_roles_ref (role_id, role_code, role_name, description)
         VALUES ($1, 'admin', 'Administrator', 'Full system administrator')`,
        [roleId]
      );
      console.log('✅ Admin role created');
    }

    const roleId = roleResult.rows.length > 0 
      ? roleResult.rows[0].role_id 
      : (await pool.query("SELECT role_id FROM user_roles_ref WHERE role_code = 'admin'")).rows[0].role_id;

    // Check if admin user already exists
    const existingUser = await pool.query(
      'SELECT user_id, email FROM users WHERE email = $1',
      [adminEmail]
    );

    if (existingUser.rows.length > 0) {
      console.log(`⚠️  Admin user already exists: ${adminEmail}`);
      console.log('Updating password...');
      
      const hashedPassword = await EncryptionUtil.hash(adminPassword);
      
      await pool.query(
        'UPDATE users SET password_hash = $1, full_name = $2 WHERE email = $3',
        [hashedPassword, adminName, adminEmail]
      );
      
      console.log('✅ Admin password updated successfully\n');
    } else {
      // Create new admin user
      const userId = uuidv4();
      const hashedPassword = await EncryptionUtil.hash(adminPassword);

      await pool.query(
        `INSERT INTO users 
         (user_id, phone, email, full_name, password_hash, role_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())`,
        [userId, adminPhone, adminEmail, adminName, hashedPassword, roleId]
      );

      // Create default preferences
      await pool.query(
        `INSERT INTO user_preferences (preference_id, user_id)
         VALUES ($1, $2)`,
        [uuidv4(), userId]
      );

      console.log('✅ Admin user created successfully\n');
    }

    // Display credentials
    console.log('═══════════════════════════════════════');
    console.log('📧 Admin Credentials:');
    console.log('═══════════════════════════════════════');
    console.log(`Email:    ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log(`Name:     ${adminName}`);
    console.log('═══════════════════════════════════════\n');
    console.log('⚠️  IMPORTANT: Change the password after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();
