const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkTable() {
  try {
    const tables = ['attachments', 'service_catalog', 'users'];
    for (const tableName of tables) {
      const res = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`);
      console.log(`Table ${tableName} exists:`, res.rows[0].exists);
      if (res.rows[0].exists) {
        const columns = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}'`);
        console.log(`${tableName} Columns:`, columns.rows);
        
        const recentRows = await pool.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT 5`);
        console.log(`Recent ${tableName} Rows:`, recentRows.rows);

        if (tableName === 'users') {
          const s3Users = await pool.query(`SELECT user_id, profile_photo_url FROM users WHERE profile_photo_url LIKE '%amazonaws.com%' LIMIT 5`);
          console.log('Users with S3 URLs:', s3Users.rows);
        }
      }
    }
  } catch (err) {
    console.error('Error checking table:', err);
  } finally {
    await pool.end();
  }
}

checkTable();
