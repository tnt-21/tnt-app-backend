// ============================================
// FILE: scripts/fix-species-schema.js
// Add updated_at column to species_ref table
// ============================================

require('dotenv').config();
const { pool } = require('../config/database');

async function fixSpeciesSchema() {
  try {
    console.log('🔧 Fixing species_ref table schema...\n');

    // Add updated_at column
    await pool.query(`
      ALTER TABLE species_ref 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
    `);

    console.log('✅ updated_at column added to species_ref');

    // Also add to life_stages_ref while we're at it
    await pool.query(`
      ALTER TABLE life_stages_ref 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
    `);
    console.log('✅ updated_at column added to life_stages_ref');

    // Also add to service_categories_ref
    await pool.query(`
      ALTER TABLE service_categories_ref 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
    `);
    console.log('✅ updated_at column added to service_categories_ref');

    console.log('\n✨ Database schema updated successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixSpeciesSchema();
