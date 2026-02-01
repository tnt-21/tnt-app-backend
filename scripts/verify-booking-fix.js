const { pool } = require('../config/database');
const serviceService = require('../services/service.service');
const { v4: uuidv4 } = require('uuid');

async function runVerification() {
  console.log('Starting verification...');
  const client = await pool.connect();

  let userId, petId, serviceId, addressId;

  try {
    // Note: We are not using a transaction block because service methods use their own pool connections
    // and wouldn't see uncommitted data. careful cleanup is handled in finally block.

    // 1. Get Role & Create Test User
    const roleRes = await client.query("SELECT role_id FROM user_roles_ref WHERE role_code = 'customer'");
    const roleId = roleRes.rows[0].role_id;
    
    userId = uuidv4();
    const randomPhone = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    await client.query(`
      INSERT INTO users (user_id, phone, email, full_name, status, role_id)
      VALUES ($1, $2, 'test@example.com', 'Test User', 'active', $3)
    `, [userId, randomPhone, roleId]);
    console.log('✓ Test User created');

    // 2. Create Test Address (Pincode 411028)
    addressId = uuidv4();
    await client.query(`
      INSERT INTO user_addresses (address_id, user_id, address_line1, city, state, pincode, is_active)
      VALUES ($1, $2, 'Test Address', 'Pune', 'MH', '411028', true)
    `, [addressId, userId]);
    console.log('✓ Test Address created (411028)');

    // 3. Create Test Pet
    petId = uuidv4();
    // Use existing species/breed if possible, or just insert dummy if referenced tables allow.
    // Assuming species_id 1 exists (Dog) based on typical seeds.
    await client.query(`
      INSERT INTO pets (pet_id, owner_id, name, species_id, life_stage_id, is_active, date_of_birth)
      VALUES ($1, $2, 'Buddy', 1, 1, true, '2020-01-01')
    `, [petId, userId]);
    console.log('✓ Test Pet created');

    // 4. Create Service (Should create default eligibility rule)
    const serviceData = {
      service_name: 'Test Grooming ' + Date.now(),
      category_id: 1, // Assuming 1 exists
      base_price: 500,
      duration_minutes: 60,
      description: 'Test Service'
    };
    
    // We need to temporarily mock category checking if foreign keys fail, 
    // but let's assume seed data exists.
    const service = await serviceService.createService(serviceData);
    serviceId = service.service_id;
    console.log('✓ Test Service created:', serviceId);

    // Verify Default Eligibility Rule
    const rules = await serviceService.getServiceEligibilityRules(serviceId);
    if (rules.length > 0 && rules[0].species_id === null) {
      console.log('✓ Default "All Access" eligibility rule verified');
    } else {
      console.error('✗ Default eligibility rule FAILED');
    }

    // 5. Check Eligibility (Wildcard Test)
    const eligibility = await serviceService.checkServiceEligibility(serviceId, petId, userId);
    if (eligibility.eligible) {
      console.log('✓ Wildcard Eligibility Check PASSED');
    } else {
      console.error('✗ Wildcard Eligibility Check FAILED:', eligibility.reason);
    }

    // 6. Setup Location-Based Availability
    // Pincode 411028: Monday (Day 1) 10:00-11:00
    const availability = [{
      day_of_week: 1,
      start_time: '10:00',
      end_time: '11:00',
      pincode: '411028',
      slot_duration_minutes: 60,
      max_bookings_per_slot: 1
    }];
    await serviceService.updateServiceAvailability(serviceId, availability);
    console.log('✓ Location-based availability configured');

    // 7. Check Slots (Matching Pincode)
    // Next Monday
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + (1 + 7 - nextMonday.getDay()) % 7);
    const dateStr = nextMonday.toISOString().split('T')[0];

    // Pass addressId to getAvailableSlots
    const slots = await serviceService.getAvailableSlots(serviceId, dateStr, 1, addressId);
    if (slots.length > 0) {
      console.log(`✓ Slots found for pincode 411028: ${slots.length} slots`);
    } else {
      console.error('✗ No slots found for correct pincode');
    }

    // 8. Check Slots (Wrong Address/Pincode)
    const wrongAddressId = uuidv4();
    await client.query(`
      INSERT INTO user_addresses (address_id, user_id, address_line1, city, state, pincode, is_active)
      VALUES ($1, $2, 'Other Address', 'Pune', 'MH', '999999', true)
    `, [wrongAddressId, userId]);

    const wrongSlots = await serviceService.getAvailableSlots(serviceId, dateStr, 1, wrongAddressId);
    if (wrongSlots.length === 0) {
      console.log('✓ Correctly filtered out slots for wrong pincode');
    } else {
      console.warn('! Found slots for wrong pincode (might be global fallback?):', wrongSlots.length);
    }

  } catch (err) {
    console.error('Verification Failed:', err);
  } finally {
    // Cleanup
    try {
      if (serviceId) await client.query('DELETE FROM service_catalog WHERE service_id = $1', [serviceId]);
      if (userId) await client.query('DELETE FROM users WHERE user_id = $1', [userId]);
      console.log('✓ Cleanup completed');
    } catch (cleanupErr) {
      console.error('Cleanup Failed:', cleanupErr);
    }
    client.release();
    pool.end();
  }
}

runVerification();
