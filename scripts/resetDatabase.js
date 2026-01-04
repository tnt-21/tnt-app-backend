/**
 * Database Reset Script
 * Drops all tables and re-runs migrations
 * USE WITH CAUTION - THIS WILL DELETE ALL DATA
 */

require('dotenv').config();
const { Pool } = require('pg');
const readline = require('readline');

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askConfirmation() {
  return new Promise((resolve) => {
    rl.question(
      `${colors.red}⚠️  WARNING: This will DELETE ALL TABLES and DATA!\n${colors.reset}Are you sure you want to continue? (yes/no): `,
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      }
    );
  });
}

async function dropAllTables() {
  const dbName = process.env.DB_NAME || 'neondb';
  
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: dbName,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    log.header('Tails & Tales - Database Reset');
    
    // Ask for confirmation
    const confirmed = await askConfirmation();
    
    if (!confirmed) {
      log.info('Reset cancelled by user');
      process.exit(0);
    }

    log.info('Connecting to database...');
    await pool.query('SELECT NOW()');
    log.success('Connected successfully');

    log.warning('Dropping all tables...');

    // Drop all tables in the public schema
    const dropTablesQuery = `
      DO $$ 
      DECLARE
          r RECORD;
      BEGIN
          -- Drop all tables
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
          LOOP
              EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
          
          -- Drop all sequences
          FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') 
          LOOP
              EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequencename) || ' CASCADE';
          END LOOP;
          
          -- Drop all types
          FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace) 
          LOOP
              EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
          END LOOP;
      END $$;
    `;

    await pool.query(dropTablesQuery);
    
    log.success('All tables dropped successfully');

    // Verify
    const result = await pool.query(`
      SELECT COUNT(*) as table_count 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    log.success(`Tables remaining: ${result.rows[0].table_count}`);

    await pool.end();

    log.header('Database Reset Complete');
    console.log('\nNext steps:');
    console.log('1. Regenerate migrations: npm run db:generate');
    console.log('2. Run migrations: npm run db:migrate');
    console.log('3. Seed database: npm run db:seed');
    console.log('\nOr run all at once: npm run db:setup');

  } catch (error) {
    log.error(`Reset failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

dropAllTables();