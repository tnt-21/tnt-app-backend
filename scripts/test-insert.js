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

async function testInsert() {
  try {
    const fileData = {
      s3_key: 'test/' + Date.now() + '.txt',
      url: 'https://test-bucket.s3.amazonaws.com/test/' + Date.now() + '.txt',
      size: 100,
      mimetype: 'text/plain'
    };
    
    const query = `
      INSERT INTO attachments (s3_key, url, size, mimetype, is_permanent)
      VALUES ($1, $2, $3, $4, FALSE)
      RETURNING *
    `;
    
    const res = await pool.query(query, [fileData.s3_key, fileData.url, fileData.size, fileData.mimetype]);
    console.log('Record inserted successfully:', res.rows[0]);
    
    // Clean up
    await pool.query('DELETE FROM attachments WHERE attachment_id = $1', [res.rows[0].attachment_id]);
    console.log('Test record cleaned up.');
    
  } catch (err) {
    console.error('Error during test insert:', err);
  } finally {
    await pool.end();
  }
}

testInsert();
