-- ========================================
-- MIGRATION 018: VAN SYSTEM
-- Manage care vans and scheduling (Reconstructed)
-- ========================================

CREATE TABLE IF NOT EXISTS vans (
    van_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    van_number VARCHAR(50) UNIQUE NOT NULL,
    van_name VARCHAR(100) NOT NULL,
    registration_number VARCHAR(20) UNIQUE,
    driver_id UUID REFERENCES users(user_id),
    status VARCHAR(20) DEFAULT 'active', -- active, maintenance, inactive
    current_location_lat DECIMAL(10,8),
    current_location_lng DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vans_status ON vans(status);

COMMENT ON TABLE vans IS 'Fleet of care vans for doorstep services';

CREATE TABLE IF NOT EXISTS van_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    van_id UUID NOT NULL REFERENCES vans(van_id),
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL DEFAULT '09:00:00',
    end_time TIME NOT NULL DEFAULT '18:00:00',
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    start_location_lat DECIMAL(10,8),
    start_location_lng DECIMAL(11,8),
    end_location_lat DECIMAL(10,8),
    end_location_lng DECIMAL(11,8),
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    total_distance_km DECIMAL(6,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(van_id, schedule_date)
);

CREATE INDEX IF NOT EXISTS idx_van_schedules_date ON van_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_van_schedules_van ON van_schedules(van_id);

COMMENT ON TABLE van_schedules IS 'Daily schedules for each van';

DO $$
BEGIN
    RAISE NOTICE 'Migration 018: Van system tables created successfully';
END $$;
