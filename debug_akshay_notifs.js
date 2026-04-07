const { pool } = require('./config/database');

async function checkAllAkshayNotifs() {
  try {
    const userResult = await pool.query("SELECT user_id FROM users WHERE full_name = 'Akshay Kumar' LIMIT 1");
    if (userResult.rows.length === 0) {
      console.log('User not found');
      return;
    }
    const userId = userResult.rows[0].user_id;

    const notifsResult = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    console.log('All Akshay Notifications:', JSON.stringify(notifsResult.rows, null, 2));

  } catch (err) {
    console.error('Error debugging:', err);
  } finally {
    await pool.end();
  }
}

checkAllAkshayNotifs();
