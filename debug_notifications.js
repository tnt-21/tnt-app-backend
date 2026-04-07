const { pool } = require('./config/database');

async function debugNotifications() {
  try {
    const result = await pool.query(`
      SELECT n.*, u.full_name
      FROM notifications n
      JOIN users u ON n.user_id = u.user_id
      ORDER BY n.created_at DESC
      LIMIT 10
    `);
    
    console.log('Recent Notifications:', JSON.stringify(result.rows, null, 2));
    
  } catch (err) {
    console.error('Error debugging:', err);
  } finally {
    await pool.end();
  }
}

debugNotifications();
