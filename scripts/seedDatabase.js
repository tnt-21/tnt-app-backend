/**
 * Database Seeder
 * Populates database with initial reference data
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.blue}${'='.repeat(50)}${colors.reset}\n${colors.blue}${msg}${colors.reset}\n${colors.blue}${'='.repeat(50)}${colors.reset}\n`),
};

async function runSeedFile(pool, filePath) {
  const fileName = path.basename(filePath);
  
  try {
    log.info(`Running seed file: ${fileName}`);
    
    const sql = await fs.readFile(filePath, 'utf8');
    await pool.query(sql);
    
    log.success(`${fileName} completed successfully`);
    return true;
  } catch (error) {
    // Check if error is due to duplicate data
    if (error.code === '23505') { // Unique violation
      log.warning(`${fileName} - Data already exists (skipping)`);
      return true;
    }
    
    log.error(`${fileName} failed: ${error.message}`);
    console.error(error);
    return false;
  }
}

async function seedDatabase() {
  const dbName = process.env.DB_NAME || 'tails_and_tales';
  const seedDir = path.join(__dirname, 'seed');
  
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: dbName,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  
  try {
    log.info('Testing database connection...');
    await pool.query('SELECT NOW()');
    log.success('Database connection successful');
    
    log.header('Starting Database Seeding');
    
    // Check if seed directory exists
    try {
      await fs.access(seedDir);
    } catch {
      log.error(`Seed directory not found: ${seedDir}`);
      process.exit(1);
    }
    
    // Read all seed files
    const files = await fs.readdir(seedDir);
    const sqlFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    if (sqlFiles.length === 0) {
      log.warning('No seed files found');
      await pool.end();
      return;
    }
    
    log.info(`Found ${sqlFiles.length} seed files`);
    
    // Run each seed file
    let successCount = 0;
    let failCount = 0;
    
    for (const file of sqlFiles) {
      const filePath = path.join(seedDir, file);
      const success = await runSeedFile(pool, filePath);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
    
    // Summary
    log.header('Seeding Summary');
    log.success(`Successful: ${successCount}`);
    if (failCount > 0) {
      log.error(`Failed: ${failCount}`);
    }
    
    // Show seeded data counts
    log.info('Verifying seeded data...');
    
    const tables = [
      'species_ref',
      'life_stages_ref',
      'subscription_tiers_ref',
      'service_categories_ref',
      'booking_statuses_ref',
      'user_roles_ref',
      'gender_ref',
      'billing_cycles_ref'
    ];
    
    console.log('\nSeeded Data Summary:');
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        const count = result.rows[0].count;
        log.success(`${table}: ${count} records`);
      } catch (error) {
        log.warning(`${table}: Could not verify`);
      }
    }
    
    await pool.end();
    
    if (failCount === 0) {
      log.header('Database seeding completed successfully! 🌱');
      console.log('\nYour database is ready to use!');
      console.log('\nQuick verification:');
      console.log(`psql -d ${dbName} -c "SELECT * FROM species_ref;"`);
    } else {
      log.error('Some seed files failed');
      process.exit(1);
    }
    
  } catch (error) {
    log.error(`Seeding process failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run seeder
log.header('Tails & Tales - Database Seeder');
seedDatabase();