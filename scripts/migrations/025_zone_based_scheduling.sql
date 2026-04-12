-- ========================================
-- MIGRATION 025: ZONE-BASED SCHEDULING
-- Supports zone→day van scheduling for Pune
-- ========================================

-- Zone → Pincode mapping table
-- Zone A: Mon, B: Tue, C: Wed, D: Thu, E: Fri
CREATE TABLE IF NOT EXISTS zone_pincode_map (
  pincode      VARCHAR(10)  NOT NULL,
  zone         CHAR(1)      NOT NULL CHECK (zone IN ('A','B','C','D','E')),
  day_of_week  INT          NOT NULL CHECK (day_of_week BETWEEN 1 AND 5), -- 1=Mon ... 5=Fri
  area_name    VARCHAR(100),
  PRIMARY KEY (pincode)
);

CREATE INDEX IF NOT EXISTS idx_zone_pincode_zone ON zone_pincode_map(zone);
CREATE INDEX IF NOT EXISTS idx_zone_pincode_dow  ON zone_pincode_map(day_of_week);

-- --------------------------------------------------------
-- Seed data — standard Pune pincodes per zone
-- Zone A: North-West (PCMC) — Monday
-- --------------------------------------------------------
INSERT INTO zone_pincode_map (pincode, zone, day_of_week, area_name) VALUES
  ('411057', 'A', 1, 'Wakad'),
  ('411027', 'A', 1, 'Pimple Saudagar'),
  ('411061', 'A', 1, 'Pimple Nilakh'),
  ('411033', 'A', 1, 'Punawale'),
  ('410506', 'A', 1, 'Ravet'),
  ('410507', 'A', 1, 'Kiwale')
ON CONFLICT (pincode) DO UPDATE SET zone=EXCLUDED.zone, day_of_week=EXCLUDED.day_of_week, area_name=EXCLUDED.area_name;

-- Zone B: West (Pune Proper) — Tuesday
INSERT INTO zone_pincode_map (pincode, zone, day_of_week, area_name) VALUES
  ('411045', 'B', 2, 'Baner'),
  ('411045', 'B', 2, 'Balewadi'),   -- Balewadi shares 411045
  ('411007', 'B', 2, 'Aundh'),
  ('411021', 'B', 2, 'Pashan'),
  ('411021', 'B', 2, 'Bavdhan')
ON CONFLICT (pincode) DO UPDATE SET zone=EXCLUDED.zone, day_of_week=EXCLUDED.day_of_week, area_name=EXCLUDED.area_name;

-- Zone C: South & South-West — Wednesday
INSERT INTO zone_pincode_map (pincode, zone, day_of_week, area_name) VALUES
  ('411038', 'C', 3, 'Kothrud'),
  ('411052', 'C', 3, 'Karve Nagar'),
  ('411041', 'C', 3, 'Sinhgad Road'),
  ('411058', 'C', 3, 'Warje'),
  ('411004', 'C', 3, 'Deccan')
ON CONFLICT (pincode) DO UPDATE SET zone=EXCLUDED.zone, day_of_week=EXCLUDED.day_of_week, area_name=EXCLUDED.area_name;

-- Zone D: East & South-East — Thursday
INSERT INTO zone_pincode_map (pincode, zone, day_of_week, area_name) VALUES
  ('411014', 'D', 4, 'Viman Nagar'),
  ('411014', 'D', 4, 'Kharadi'),
  ('411001', 'D', 4, 'Koregaon Park'),
  ('411006', 'D', 4, 'Kalyani Nagar'),
  ('411013', 'D', 4, 'Magarpatta')
ON CONFLICT (pincode) DO UPDATE SET zone=EXCLUDED.zone, day_of_week=EXCLUDED.day_of_week, area_name=EXCLUDED.area_name;

-- Zone E: Deep South & Core — Friday
INSERT INTO zone_pincode_map (pincode, zone, day_of_week, area_name) VALUES
  ('411048', 'E', 5, 'NIBM'),
  ('411048', 'E', 5, 'Kondhwa'),
  ('411040', 'E', 5, 'Wanowrie'),
  ('411001', 'E', 5, 'Camp'),
  ('411005', 'E', 5, 'Shivajinagar')
ON CONFLICT (pincode) DO UPDATE SET zone=EXCLUDED.zone, day_of_week=EXCLUDED.day_of_week, area_name=EXCLUDED.area_name;

-- --------------------------------------------------------
-- Alter bookings table to add zone + cancellation tracking
-- --------------------------------------------------------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS zone CHAR(1);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_status VARCHAR(30) DEFAULT NULL;
-- cancellation_status: 'pending_admin_approval' | 'approved' | 'rejected'
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by_user_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_admin_note TEXT;

-- Vans table: wiring zone + is_active
ALTER TABLE vans ADD COLUMN IF NOT EXISTS zone CHAR(1);
ALTER TABLE vans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE vans ADD COLUMN IF NOT EXISTS start_location_lat DECIMAL(10,8) DEFAULT 18.5314;
ALTER TABLE vans ADD COLUMN IF NOT EXISTS start_location_lng DECIMAL(11,8) DEFAULT 73.8446;

-- Index for fast zone-date queries
CREATE INDEX IF NOT EXISTS idx_bookings_zone ON bookings(zone);
CREATE INDEX IF NOT EXISTS idx_bookings_cancel_status ON bookings(cancellation_status) WHERE cancellation_status IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE 'Migration 025: Zone-based scheduling tables ready.';
END $$;
