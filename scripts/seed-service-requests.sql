-- ============================================
-- Seed Service Requests for Van Routing Testing
-- Creates sample requests across Pune with varying urgency
-- ============================================

-- First, let's create some test vans if they don't exist
INSERT INTO vans (van_number, van_name, registration_number, zone, start_location_lat, start_location_lng, max_stops_per_day, is_active)
VALUES 
  ('VAN001', 'Pune Van 1', 'MH12AB1234', 'Koregaon Park', 18.5362, 73.8954, 6, true),
  ('VAN002', 'Pune Van 2', 'MH12CD5678', 'Kothrud', 18.5074, 73.8077, 6, true),
  ('VAN003', 'Pune Van 3', 'MH12EF9012', 'Viman Nagar', 18.5679, 73.9143, 6, true)
ON CONFLICT (van_number) DO NOTHING;

-- Now create service requests using existing data
-- We'll sample from existing users, pets, services, and addresses

DO $$
DECLARE
  v_user_id UUID;
  v_pet_id UUID;
  v_service_id UUID;
  v_address_id UUID;
  v_subscription_id UUID;
  v_lat DECIMAL(10,8);
  v_lng DECIMAL(11,8);
  v_address TEXT;
  v_city TEXT;
  v_pincode TEXT;
  v_priority INT;
  v_last_service_date DATE;
BEGIN
  -- Get a grooming service ID
  SELECT service_id INTO v_service_id 
  FROM service_catalog 
  WHERE service_name ILIKE '%groom%' 
  LIMIT 1;

  -- Request 1: High urgency Eternal subscriber in Koregaon Park
  SELECT u.user_id, p.pet_id, a.address_id, s.subscription_id, 
         a.latitude, a.longitude, a.address_line1, a.city, a.pincode
  INTO v_user_id, v_pet_id, v_address_id, v_subscription_id,
       v_lat, v_lng, v_address, v_city, v_pincode
  FROM users u
  JOIN pets p ON u.user_id = p.user_id
  JOIN user_addresses a ON u.user_id = a.user_id
  LEFT JOIN subscriptions s ON p.pet_id = s.pet_id
  WHERE a.latitude BETWEEN 18.53 AND 18.55
    AND a.longitude BETWEEN 73.88 AND 73.91
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO service_requests (
      user_id, pet_id, service_id, address_id, subscription_id,
      service_type, latitude, longitude, address_line1, city, pincode,
      priority, last_service_date, special_instructions
    ) VALUES (
      v_user_id, v_pet_id, v_service_id, v_address_id, v_subscription_id,
      'grooming', 
      COALESCE(v_lat, 18.5362), 
      COALESCE(v_lng, 73.8954),
      COALESCE(v_address, 'Sample Address, Koregaon Park'),
      COALESCE(v_city, 'Pune'),
      COALESCE(v_pincode, '411001'),
      1, -- Eternal priority
      CURRENT_DATE - INTERVAL '45 days', -- Very overdue
      'Pet is very anxious, please be gentle'
    );
  END IF;

  -- Request 2-5: Medium urgency Plus subscribers in Koregaon Park area
  FOR i IN 1..4 LOOP
    SELECT u.user_id, p.pet_id, a.address_id, s.subscription_id,
           a.latitude, a.longitude, a.address_line1, a.city, a.pincode
    INTO v_user_id, v_pet_id, v_address_id, v_subscription_id,
         v_lat, v_lng, v_address, v_city, v_pincode
    FROM users u
    JOIN pets p ON u.user_id = p.user_id
    JOIN user_addresses a ON u.user_id = a.user_id
    LEFT JOIN subscriptions s ON p.pet_id = s.pet_id
    WHERE a.latitude BETWEEN 18.52 AND 18.55
      AND a.longitude BETWEEN 73.88 AND 73.92
    ORDER BY RANDOM()
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO service_requests (
        user_id, pet_id, service_id, address_id, subscription_id,
        service_type, latitude, longitude, address_line1, city, pincode,
        priority, last_service_date, special_instructions
      ) VALUES (
        v_user_id, v_pet_id, v_service_id, v_address_id, v_subscription_id,
        'grooming',
        COALESCE(v_lat, 18.5362 + (RANDOM() * 0.02 - 0.01)),
        COALESCE(v_lng, 73.8954 + (RANDOM() * 0.02 - 0.01)),
        COALESCE(v_address, 'Sample Address ' || i || ', Koregaon Park'),
        COALESCE(v_city, 'Pune'),
        COALESCE(v_pincode, '411001'),
        2, -- Plus priority
        CURRENT_DATE - INTERVAL '35 days',
        NULL
      );
    END IF;
  END LOOP;

  -- Request 6-8: Kothrud area (different cluster)
  FOR i IN 1..3 LOOP
    SELECT u.user_id, p.pet_id, a.address_id, s.subscription_id,
           a.latitude, a.longitude, a.address_line1, a.city, a.pincode
    INTO v_user_id, v_pet_id, v_address_id, v_subscription_id,
         v_lat, v_lng, v_address, v_city, v_pincode
    FROM users u
    JOIN pets p ON u.user_id = p.user_id
    JOIN user_addresses a ON u.user_id = a.user_id
    LEFT JOIN subscriptions s ON p.pet_id = s.pet_id
    WHERE a.latitude BETWEEN 18.50 AND 18.52
      AND a.longitude BETWEEN 73.80 AND 73.82
    ORDER BY RANDOM()
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO service_requests (
        user_id, pet_id, service_id, address_id, subscription_id,
        service_type, latitude, longitude, address_line1, city, pincode,
        priority, last_service_date, special_instructions
      ) VALUES (
        v_user_id, v_pet_id, v_service_id, v_address_id, v_subscription_id,
        'grooming',
        COALESCE(v_lat, 18.5074 + (RANDOM() * 0.01 - 0.005)),
        COALESCE(v_lng, 73.8077 + (RANDOM() * 0.01 - 0.005)),
        COALESCE(v_address, 'Sample Address ' || i || ', Kothrud'),
        COALESCE(v_city, 'Pune'),
        COALESCE(v_pincode, '411038'),
        3, -- Basic priority
        CURRENT_DATE - INTERVAL '32 days',
        NULL
      );
    END IF;
  END LOOP;

  -- Request 9-11: Viman Nagar area (third cluster)
  FOR i IN 1..3 LOOP
    SELECT u.user_id, p.pet_id, a.address_id, s.subscription_id,
           a.latitude, a.longitude, a.address_line1, a.city, a.pincode
    INTO v_user_id, v_pet_id, v_address_id, v_subscription_id,
         v_lat, v_lng, v_address, v_city, v_pincode
    FROM users u
    JOIN pets p ON u.user_id = p.user_id
    JOIN user_addresses a ON u.user_id = a.user_id
    LEFT JOIN subscriptions s ON p.pet_id = s.pet_id
    WHERE a.latitude BETWEEN 18.56 AND 18.58
      AND a.longitude BETWEEN 73.91 AND 73.93
    ORDER BY RANDOM()
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO service_requests (
        user_id, pet_id, service_id, address_id, subscription_id,
        service_type, latitude, longitude, address_line1, city, pincode,
        priority, last_service_date, special_instructions
      ) VALUES (
        v_user_id, v_pet_id, v_service_id, v_address_id, v_subscription_id,
        'grooming',
        COALESCE(v_lat, 18.5679 + (RANDOM() * 0.01 - 0.005)),
        COALESCE(v_lng, 73.9143 + (RANDOM() * 0.01 - 0.005)),
        COALESCE(v_address, 'Sample Address ' || i || ', Viman Nagar'),
        COALESCE(v_city, 'Pune'),
        COALESCE(v_pincode, '411014'),
        2, -- Plus priority
        CURRENT_DATE - INTERVAL '38 days',
        NULL
      );
    END IF;
  END LOOP;

  -- Request 12-14: Low urgency requests (recent service)
  FOR i IN 1..3 LOOP
    SELECT u.user_id, p.pet_id, a.address_id, s.subscription_id,
           a.latitude, a.longitude, a.address_line1, a.city, a.pincode
    INTO v_user_id, v_pet_id, v_address_id, v_subscription_id,
         v_lat, v_lng, v_address, v_city, v_pincode
    FROM users u
    JOIN pets p ON u.user_id = p.user_id
    JOIN user_addresses a ON u.user_id = a.user_id
    LEFT JOIN subscriptions s ON p.pet_id = s.pet_id
    ORDER BY RANDOM()
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO service_requests (
        user_id, pet_id, service_id, address_id, subscription_id,
        service_type, latitude, longitude, address_line1, city, pincode,
        priority, last_service_date, special_instructions
      ) VALUES (
        v_user_id, v_pet_id, v_service_id, v_address_id, v_subscription_id,
        'grooming',
        18.5204 + (RANDOM() * 0.03),
        73.8567 + (RANDOM() * 0.03),
        'Sample Address ' || i || ', Pune',
        'Pune',
        '411001',
        3, -- Basic priority
        CURRENT_DATE - INTERVAL '20 days', -- Not very overdue
        NULL
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Created test service requests successfully!';
  RAISE NOTICE 'Check the pending requests in the admin dashboard.';
END $$;

-- Show summary
SELECT 
  priority,
  CASE priority
    WHEN 1 THEN 'Eternal'
    WHEN 2 THEN 'Plus'
    WHEN 3 THEN 'Basic'
  END as tier,
  COUNT(*) as count,
  ROUND(AVG(urgency_score), 2) as avg_urgency,
  ROUND(AVG(days_since_last_service), 0) as avg_days_overdue
FROM service_requests
WHERE status = 'pending'
GROUP BY priority
ORDER BY priority;

SELECT COUNT(*) as total_pending FROM service_requests WHERE status = 'pending';
