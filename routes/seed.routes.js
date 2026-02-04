// Create a simple API endpoint to seed test data
// Add this temporarily to test the van module

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

router.post('/seed-test-requests', async (req, res) => {
  try {
    console.log('🌱 Seeding test service requests...');
    
    // Get a grooming service
    const serviceResult = await pool.query(`
      SELECT service_id FROM service_catalog WHERE service_name ILIKE '%groom%' LIMIT 1
    `);
    
    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No grooming service found' });
    }
    
    const serviceId = serviceResult.rows[0].service_id;

    // Create vans
    await pool.query(`
      INSERT INTO vans (van_number, van_name, registration_number, zone, start_location_lat, start_location_lng, max_stops_per_day, is_active)
      VALUES 
        ('VAN001', 'Pune Van 1', 'MH12AB1234', 'Koregaon Park', 18.5362, 73.8954, 6, true),
        ('VAN002', 'Pune Van 2', 'MH12CD5678', 'Kothrud', 18.5074, 73.8077, 6, true)
      ON CONFLICT (van_number) DO NOTHING
    `);

    // Get users with pets
    const usersResult = await pool.query(`
      SELECT DISTINCT
        u.user_id,
        p.pet_id,
        a.address_id,
        s.subscription_id,
        CASE 
          WHEN st.tier_code = 'eternal' THEN 1
          WHEN st.tier_code = 'plus' THEN 2
          ELSE 3
        END as priority
      FROM users u
      JOIN pets p ON p.owner_id = u.user_id
      JOIN user_addresses a ON a.user_id = u.user_id
      LEFT JOIN subscriptions s ON s.pet_id = p.pet_id
      LEFT JOIN subscription_tiers_ref st ON s.tier_id = st.tier_id
      LIMIT 12
    `);

    const areas = [
      { name: 'Koregaon Park', lat: 18.5362, lng: 73.8954, daysAgo: 45 },
      { name: 'Koregaon Park', lat: 18.5370, lng: 73.8960, daysAgo: 35 },
      { name: 'Koregaon Park', lat: 18.5355, lng: 73.8945, daysAgo: 38 },
      { name: 'Kothrud', lat: 18.5074, lng: 73.8077, daysAgo: 32 },
      { name: 'Kothrud', lat: 18.5080, lng: 73.8085, daysAgo: 33 },
      { name: 'Kothrud', lat: 18.5068, lng: 73.8070, daysAgo: 31 },
      { name: 'Viman Nagar', lat: 18.5679, lng: 73.9143, daysAgo: 40 },
      { name: 'Viman Nagar', lat: 18.5685, lng: 73.9150, daysAgo: 38 },
      { name: 'Viman Nagar', lat: 18.5672, lng: 73.9138, daysAgo: 37 },
      { name: 'Hadapsar', lat: 18.5089, lng: 73.9260, daysAgo: 25 },
      { name: 'Baner', lat: 18.5590, lng: 73.7787, daysAgo: 28 },
      { name: 'Pune Central', lat: 18.5204, lng: 73.8567, daysAgo: 30 },
    ];

    let created = 0;
    for (let i = 0; i < Math.min(usersResult.rows.length, areas.length); i++) {
      const user = usersResult.rows[i];
      const area = areas[i];

      await pool.query(`
        INSERT INTO service_requests (
          user_id, pet_id, service_id, address_id, subscription_id,
          service_type, latitude, longitude, address_line1, city, pincode,
          priority, last_service_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        user.user_id,
        user.pet_id,
        serviceId,
        user.address_id,
        user.subscription_id,
        'grooming',
        area.lat,
        area.lng,
        `Sample Address, ${area.name}`,
        'Pune',
        '411001',
        user.priority || 3,
        new Date(Date.now() - area.daysAgo * 24 * 60 * 60 * 1000)
      ]);
      created++;
    }

    const summary = await pool.query(`
      SELECT COUNT(*) as total FROM service_requests WHERE status = 'pending'
    `);

    res.json({
      success: true,
      message: `Created ${created} service requests`,
      totalPending: summary.rows[0].total
    });

  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
