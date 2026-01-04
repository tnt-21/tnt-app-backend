-- ========================================
-- MIGRATION 009: TRACKING SYSTEM
-- GPS tracking for services and continuous pet tracking
-- ========================================

CREATE TABLE IF NOT EXISTS tracking_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(booking_id),
    caregiver_id UUID NOT NULL REFERENCES caregivers(caregiver_id),
    pet_id UUID NOT NULL REFERENCES pets(pet_id),
    session_type VARCHAR(30),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    total_distance_km DECIMAL(6,2),
    average_speed DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_track_booking_active ON tracking_sessions(booking_id, is_active);
CREATE INDEX IF NOT EXISTS idx_track_pet_active ON tracking_sessions(pet_id, is_active);
CREATE INDEX IF NOT EXISTS idx_track_caregiver ON tracking_sessions(caregiver_id);

COMMENT ON TABLE tracking_sessions IS 'GPS tracking sessions for services and continuous pet tracking';

CREATE TABLE IF NOT EXISTS location_tracking (
    tracking_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES tracking_sessions(session_id) ON DELETE CASCADE,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    accuracy DECIMAL(6,2),
    altitude DECIMAL(8,2),
    speed DECIMAL(5,2),
    heading DECIMAL(5,2),
    battery_level INT,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_session_time ON location_tracking(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_location_session ON location_tracking(session_id);

COMMENT ON TABLE location_tracking IS 'Real-time GPS location points';

DO $$
BEGIN
    RAISE NOTICE 'Migration 009: Tracking tables created successfully';
END $$;