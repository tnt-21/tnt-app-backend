/**
 * Database Migration Runner
 * Executes all SQL migration files in order
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// ANSI color codes for console output
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

// Database configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres', // Connect to postgres DB first
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

async function createDatabaseIfNotExists(dbName) {
  const pool = new Pool(config);
  
  try {
    log.info(`Checking if database '${dbName}' exists...`);
    
    const result = await pool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    
    if (result.rows.length === 0) {
      log.info(`Creating database '${dbName}'...`);
      await pool.query(`CREATE DATABASE ${dbName}`);
      log.success(`Database '${dbName}' created`);
    } else {
      log.success(`Database '${dbName}' already exists`);
    }
  } catch (error) {
    log.error(`Error checking/creating database: ${error.message}`);
    throw error;
  } finally {
    await pool.end();
  }
}

async function runMigration(pool, filePath) {
  const fileName = path.basename(filePath);
  
  try {
    log.info(`Running migration: ${fileName}`);
    
    // Read SQL file
    const sql = await fs.readFile(filePath, 'utf8');
    
    // Execute SQL
    await pool.query(sql);
    
    log.success(`${fileName} completed successfully`);
    return true;
  } catch (error) {
    log.error(`${fileName} failed: ${error.message}`);
    console.error(error);
    return false;
  }
}

async function runAllMigrations() {
  const dbName = process.env.DB_NAME || 'tails_and_tales';
  const migrationsDir = path.join(__dirname, 'migrations');
  
  try {
    // For cloud databases like Neon, skip database creation
    const isCloudDb = process.env.DB_SSL === 'true' || 
                      process.env.DB_HOST?.includes('neon') || 
                      process.env.DB_HOST?.includes('supabase') ||
                      process.env.DB_HOST?.includes('aws');
    
    if (!isCloudDb) {
      // Only create database for local PostgreSQL
      await createDatabaseIfNotExists(dbName);
    } else {
      log.info('Cloud database detected - skipping database creation');
    }
    
    // Connect to the target database
    const pool = new Pool({
      ...config,
      database: dbName,
    });
    
    log.info('Testing database connection...');
    await pool.query('SELECT NOW()');
    log.success('Database connection successful');
    
    log.header('Starting Database Migrations');
    
    // Read all migration files
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort(); // Alphabetical order ensures numbered files run in sequence
    
    if (sqlFiles.length === 0) {
      log.warning('No migration files found');
      await pool.end();
      return;
    }
    
    log.info(`Found ${sqlFiles.length} migration files`);
    
    // Run each migration
    let successCount = 0;
    let failCount = 0;
    
    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      const success = await runMigration(pool, filePath);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
        log.error('Migration failed. Stopping...');
        break;
      }
    }
    
    // Summary
    log.header('Migration Summary');
    log.success(`Successful: ${successCount}`);
    if (failCount > 0) {
      log.error(`Failed: ${failCount}`);
    }
    
    await pool.end();
    
    if (failCount === 0) {
      log.header('All migrations completed successfully! 🎉');
      console.log('\nNext steps:');
      console.log('1. Run seed data: npm run db:seed');
      console.log('2. Verify tables: psql -d', dbName, '-c "\\dt"');
      process.exit(0);
    } else {
      process.exit(1);
    }
    
  } catch (error) {
    log.error(`Migration process failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run migrations
log.header('Tails & Tales - Database Migration Tool');
runAllMigrations();