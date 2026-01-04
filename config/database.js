
// ============================================
// FILE: config/database.js
// PostgreSQL/NeonDB Configuration
// ============================================

require('dotenv').config();
const { Pool } = require('pg');

// Database configuration for NeonDB
const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds
};

// Create connection pool
const pool = new Pool(config);

// Connection event handlers
pool.on('connect', (client) => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected database error:', err);
  // Don't exit immediately - let the app try to recover
});

pool.on('remove', () => {
  console.log('📤 Client removed from pool');
});

// Test database connection
const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    console.log('✅ Database connection test successful');
    console.log('📅 Server time:', result.rows[0].current_time);
    console.log('🗄️  Database version:', result.rows[0].db_version.split(',')[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    throw error;
  }
};

// Helper function to execute queries with better error handling
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log query in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query executed', { 
        text: text.substring(0, 60) + (text.length > 60 ? '...' : ''), 
        duration: `${duration}ms`, 
        rows: res.rowCount 
      });
    }
    
    return res;
  } catch (error) {
    console.error('❌ Query error:', {
      message: error.message,
      query: text.substring(0, 100)
    });
    throw error;
  }
};

// Helper function to get a client from the pool
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Set a timeout warning if client held too long
  const timeout = setTimeout(() => {
    console.warn('⚠️  A client has been checked out for more than 5 seconds!');
    console.warn('⚠️  Remember to release the client after use.');
  }, 5000);
  
  // Override release to clear timeout
  client.release = () => {
    clearTimeout(timeout);
    return release();
  };
  
  return client;
};

// Transaction helper with automatic rollback on error
const transaction = async (callback) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Graceful shutdown
const closePool = async () => {
  try {
    await pool.end();
    console.log('👋 Database pool closed');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
};

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  testConnection,
  closePool,
};