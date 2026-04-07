const { pool } = require('./config/database');

async function checkAkshaySessions() {
  try {
    const userResult = await pool.query("SELECT user_id FROM users WHERE full_name = 'Akshay Kumar' LIMIT 1");
    if (userResult.rows.length === 0) {
      console.log('User not found');
      return;
    }
    const userId = userResult.rows[0].user_id;

    const sessionsResult = await pool.query('SELECT * FROM sessions WHERE user_id = $1', [userId]);
    console.log('Sessions for Akshay:', JSON.stringify(sessionsResult.rows, null, 2));

  } catch (err) {
    console.error('Error debugging:', err);
  } finally {
    await pool.end();
  }
}

checkAkshaySessions();
