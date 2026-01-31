// ============================================
// FILE: scripts/add-password-column.js
// Add password_hash column to users table
// ============================================

require('dotenv').config();
const { pool } = require('../config/database');

async function addPasswordColumn() {
  try {
    console.log('🔧 Adding password_hash column to users table...\n');

    // Add password_hash column
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
    `);

    console.log('✅ password_hash column added successfully');

    // Create index for email lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);

    console.log('✅ Email index created successfully\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addPasswordColumn();
