-- ========================================
-- MIGRATION 001: REFERENCE/LOOKUP TABLES
-- All master data and lookup tables
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Species Reference Table
CREATE TABLE IF NOT EXISTS species_ref (
    species_id SMALLSERIAL PRIMARY KEY,
    species_code VARCHAR(20) UNIQUE NOT NULL,
    species_name VARCHAR(50) NOT NULL,
    icon_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE species_ref IS 'Master species list - dog, cat';

-- Life Stages Reference Table
CREATE TABLE IF NOT EXISTS life_stages_ref (
    life_stage_id SMALLSERIAL PRIMARY KEY,
    species_id SMALLINT NOT NULL REFERENCES species_ref(species_id),
    life_stage_code VARCHAR(30) UNIQUE NOT NULL,
    life_stage_name VARCHAR(100) NOT NULL,
    min_age_months INT,
    max_age_months INT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_life_stages_species ON life_stages_ref(species_id, life_stage_code);
COMMENT ON TABLE life_stages_ref IS 'Life stages mapped to species with age ranges';

-- Subscription Tiers Reference
CREATE TABLE IF NOT EXISTS subscription_tiers_ref (
    tier_id SMALLSERIAL PRIMARY KEY,
    tier_code VARCHAR(20) UNIQUE NOT NULL,
    tier_name VARCHAR(50) NOT NULL,
    tier_description TEXT,
    marketing_tagline VARCHAR(255),
    display_order INT,
    icon_url VARCHAR(500),
    color_hex VARCHAR(7),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE subscription_tiers_ref IS 'Subscription tier definitions - Basic, Plus, Eternal';

-- Service Categories Reference
CREATE TABLE IF NOT EXISTS service_categories_ref (
    category_id SMALLSERIAL PRIMARY KEY,
    category_code VARCHAR(50) UNIQUE NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    display_order INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE service_categories_ref IS 'Service category master list';

-- Booking Statuses Reference
CREATE TABLE IF NOT EXISTS booking_statuses_ref (
    status_id SMALLSERIAL PRIMARY KEY,
    status_code VARCHAR(30) UNIQUE NOT NULL,
    status_name VARCHAR(50) NOT NULL,
    status_type VARCHAR(20),
    display_color VARCHAR(7),
    allow_cancellation BOOLEAN DEFAULT TRUE,
    allow_reschedule BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE booking_statuses_ref IS 'Booking status workflow definitions';

-- Location Types Reference
CREATE TABLE IF NOT EXISTS location_types_ref (
    location_type_id SMALLSERIAL PRIMARY KEY,
    type_code VARCHAR(20) UNIQUE NOT NULL,
    type_name VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE location_types_ref IS 'Service delivery location types';

-- User Roles Reference
CREATE TABLE IF NOT EXISTS user_roles_ref (
    role_id SMALLSERIAL PRIMARY KEY,
    role_code VARCHAR(30) UNIQUE NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    permissions JSON,
    is_active BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE user_roles_ref IS 'User role definitions';

-- Gender Reference
CREATE TABLE IF NOT EXISTS gender_ref (
    gender_id SMALLSERIAL PRIMARY KEY,
    gender_code VARCHAR(10) UNIQUE NOT NULL,
    gender_name VARCHAR(20) NOT NULL
);

COMMENT ON TABLE gender_ref IS 'Gender options for pets';

-- Billing Cycles Reference
CREATE TABLE IF NOT EXISTS billing_cycles_ref (
    billing_cycle_id SMALLSERIAL PRIMARY KEY,
    cycle_code VARCHAR(20) UNIQUE NOT NULL,
    cycle_name VARCHAR(50) NOT NULL,
    months INT NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0
);

COMMENT ON TABLE billing_cycles_ref IS 'Subscription billing cycle options';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 001: Reference tables created successfully';
END $$;