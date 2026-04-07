const { pool } = require('./config/database');

async function checkUserPrefs() {
  try {
    const userResult = await pool.query("SELECT user_id, full_name FROM users WHERE full_name = 'Akshay Kumar' LIMIT 1");
    if (userResult.rows.length === 0) {
      console.log('User not found');
      return;
    }
    const userId = userResult.rows[0].user_id;
    console.log('User ID:', userId);

    const prefsResult = await pool.query('SELECT * FROM notification_preferences WHERE user_id = $1', [userId]);
    console.log('Notification Preferences:', JSON.stringify(prefsResult.rows, null, 2));

    const templatesResult = await pool.query("SELECT * FROM notification_templates WHERE template_code = 'schedule_confirmation'");
    console.log('Template Info:', JSON.stringify(templatesResult.rows, null, 2));

  } catch (err) {
    console.error('Error debugging:', err);
  } finally {
    await pool.end();
  }
}

checkUserPrefs();
