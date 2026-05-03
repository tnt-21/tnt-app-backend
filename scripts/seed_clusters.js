const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const pool = new Pool(config);

const zones = [
  { id: 'A', name: 'Wakad', lat: 18.59, lng: 73.76 },
  { id: 'B', name: 'Baner', lat: 18.55, lng: 73.79 },
  { id: 'C', name: 'Kothrud', lat: 18.50, lng: 73.81 },
  { id: 'D', name: 'Viman Nagar', lat: 18.56, lng: 73.91 },
  { id: 'E', name: 'Camp', lat: 18.49, lng: 73.89 },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get required references
    const userRes = await client.query('SELECT user_id FROM users LIMIT 1');
    if (userRes.rows.length === 0) throw new Error('No users found. Please seed users first.');
    const userId = userRes.rows[0].user_id;

    let petRes = await client.query('SELECT pet_id FROM pets WHERE owner_id = $1 LIMIT 1', [userId]);
    if (petRes.rows.length === 0) {
      // Just take any pet
      petRes = await client.query('SELECT pet_id FROM pets LIMIT 1');
      if (petRes.rows.length === 0) throw new Error('No pets found. Please seed pets first.');
    }
    const petId = petRes.rows[0].pet_id;

    const serviceRes = await client.query('SELECT service_id FROM service_catalog WHERE category_id = 1 LIMIT 1');
    if (serviceRes.rows.length === 0) throw new Error('No grooming services found.');
    const serviceId = serviceRes.rows[0].service_id;

    const locTypeRes = await client.query('SELECT location_type_id FROM location_types_ref LIMIT 1');
    const locTypeId = locTypeRes.rows[0].location_type_id;

    const statusRes = await client.query("SELECT status_id FROM booking_statuses_ref WHERE status_code = 'pending'");
    const statusId = statusRes.rows[0].status_id;

    console.log('Seeding 20 bookings per zone (Total 100)...');

    let count = 0;
    for (const zone of zones) {
      for (let i = 1; i <= 20; i++) {
        // Randomize location slightly around the center
        const lat = zone.lat + (Math.random() * 0.02 - 0.01);
        const lng = zone.lng + (Math.random() * 0.02 - 0.01);

        // Insert address
        const addrRes = await client.query(
          `INSERT INTO user_addresses (user_id, address_line1, city, state, pincode, latitude, longitude, is_default)
           VALUES ($1, $2, 'Pune', 'Maharashtra', '411000', $3, $4, false) RETURNING address_id`,
          [userId, `Test Address ${i} in ${zone.name}`, lat, lng]
        );
        const addressId = addrRes.rows[0].address_id;

        // Insert booking
        const bookingNumber = `BK-TST-${zone.id}-${Date.now()}-${i}`;
        await client.query(
          `INSERT INTO bookings (
            booking_number, user_id, pet_id, service_id, location_type_id, address_id,
            status_id, base_amount, total_amount, payment_status, zone
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 500, 500, 'pending', $8)`,
          [bookingNumber, userId, petId, serviceId, locTypeId, addressId, statusId, zone.id]
        );
        count++;
      }
      console.log(`Seeded 20 bookings for Zone ${zone.id}`);
    }

    await client.query('COMMIT');
    console.log(`✅ Successfully seeded ${count} dummy service requests for cluster testing.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding dummy requests:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
