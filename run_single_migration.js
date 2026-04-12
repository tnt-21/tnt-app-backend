require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

async function runSpecificMigration() {
  const pool = new Pool(config);
  try {
    const filePath = path.join(__dirname, 'scripts', 'migrations', '023_booking_products.sql');
    console.log(`Running migration: ${filePath}`);
    const sql = await fs.readFile(filePath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 023_booking_products.sql completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runSpecificMigration();
