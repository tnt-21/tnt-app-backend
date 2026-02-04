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
    base_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
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
END $$;-- ========================================
-- MIGRATION 002: USERS & AUTHENTICATION
-- User accounts, OTP, addresses, sessions
-- ========================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    role_id SMALLINT NOT NULL REFERENCES user_roles_ref(role_id),
    profile_photo_url VARCHAR(500),
    date_of_birth DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

COMMENT ON TABLE users IS 'All system users - customers, caregivers, admins';
COMMENT ON COLUMN users.status IS 'active, inactive, suspended, deleted';

-- OTP Verifications
CREATE TABLE IF NOT EXISTS otp_verifications (
    otp_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    phone VARCHAR(15) NOT NULL,
    otp VARCHAR(255) NOT NULL,
    purpose VARCHAR(30) DEFAULT 'login',
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    ip_address VARCHAR(45),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_created ON otp_verifications(phone, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_metadata ON otp_verifications USING GIN (metadata);

COMMENT ON TABLE otp_verifications IS 'OTP verification for authentication';
COMMENT ON COLUMN otp_verifications.purpose IS 'login, registration, password_reset';
COMMENT ON COLUMN otp_verifications.metadata IS 'Additional context (e.g., new_phone, new_email for update operations)';

-- User Addresses
CREATE TABLE IF NOT EXISTS user_addresses (
    address_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    label VARCHAR(50),
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    landmark VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    country VARCHAR(50) DEFAULT 'India',
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_default ON user_addresses(user_id, is_default);

COMMENT ON TABLE user_addresses IS 'User saved addresses for service delivery';
COMMENT ON COLUMN user_addresses.label IS 'home, work, other';

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    device_token VARCHAR(500),
    device_type VARCHAR(50),
    device_name VARCHAR(100),
    fcm_token VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, is_active);

COMMENT ON TABLE sessions IS 'User session management and device tracking';
COMMENT ON COLUMN sessions.device_type IS 'ios, android, web';
COMMENT ON COLUMN sessions.fcm_token IS 'Firebase Cloud Messaging token for push notifications';

-- User Preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    preference_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    currency VARCHAR(3) DEFAULT 'INR',
    notification_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    whatsapp_enabled BOOLEAN DEFAULT FALSE,
    theme VARCHAR(20) DEFAULT 'light',
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE user_preferences IS 'User app preferences and notification settings';
COMMENT ON COLUMN user_preferences.theme IS 'light, dark, auto';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 002: Users and authentication tables created successfully';
END $$;-- ========================================
-- MIGRATION 003: PET MANAGEMENT
-- Pet profiles, health records, vaccinations
-- ========================================

CREATE TABLE IF NOT EXISTS pets (
    pet_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    species_id SMALLINT NOT NULL REFERENCES species_ref(species_id),
    life_stage_id SMALLINT NOT NULL REFERENCES life_stages_ref(life_stage_id),
    breed VARCHAR(100),
    gender_id SMALLINT REFERENCES gender_ref(gender_id),
    date_of_birth DATE NOT NULL,
    weight DECIMAL(5,2),
    color VARCHAR(50),
    photo_url VARCHAR(500),
    microchip_id VARCHAR(50) UNIQUE,
    medical_conditions TEXT,
    behavioral_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_deceased BOOLEAN DEFAULT FALSE,
    deceased_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pets_owner ON pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_pets_species_lifestage ON pets(species_id, life_stage_id);
CREATE INDEX IF NOT EXISTS idx_pets_microchip ON pets(microchip_id);
CREATE INDEX IF NOT EXISTS idx_pets_active ON pets(is_active);

COMMENT ON TABLE pets IS 'Pet profiles with core information';

CREATE TABLE IF NOT EXISTS health_records (
    record_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(pet_id) ON DELETE CASCADE,
    record_type VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    record_date DATE NOT NULL,
    provider_name VARCHAR(255),
    provider_contact VARCHAR(50),
    provider_address TEXT,
    document_urls JSON,
    diagnosis TEXT,
    treatment_plan TEXT,
    notes TEXT,
    cost DECIMAL(10,2),
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_pet ON health_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_health_type ON health_records(record_type);
CREATE INDEX IF NOT EXISTS idx_health_date ON health_records(record_date);

COMMENT ON TABLE health_records IS 'Complete health history for each pet';
COMMENT ON COLUMN health_records.record_type IS 'vaccination, vet_visit, medication, surgery, allergy, condition, test_result';

CREATE TABLE IF NOT EXISTS vaccinations (
    vaccination_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(pet_id) ON DELETE CASCADE,
    vaccine_name VARCHAR(255) NOT NULL,
    vaccination_date DATE NOT NULL,
    next_due_date DATE,
    batch_number VARCHAR(100),
    provider VARCHAR(255),
    provider_contact VARCHAR(50),
    veterinarian_name VARCHAR(255),
    vaccination_site VARCHAR(100),
    adverse_reactions TEXT,
    certificate_url VARCHAR(500),
    is_completed BOOLEAN DEFAULT TRUE,
    reminder_sent BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vacc_pet ON vaccinations(pet_id);
CREATE INDEX IF NOT EXISTS idx_vacc_due ON vaccinations(next_due_date);
CREATE INDEX IF NOT EXISTS idx_vacc_pet_completed ON vaccinations(pet_id, is_completed);

COMMENT ON TABLE vaccinations IS 'Vaccination records with reminder tracking';

CREATE TABLE IF NOT EXISTS medications (
    medication_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(pet_id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    medication_type VARCHAR(50),
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    route VARCHAR(50),
    start_date DATE NOT NULL,
    end_date DATE,
    prescribed_by VARCHAR(255),
    prescribed_for VARCHAR(255),
    pharmacy VARCHAR(255),
    refills_remaining INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    reminder_enabled BOOLEAN DEFAULT TRUE,
    reminder_times JSON,
    side_effects TEXT,
    instructions TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_pet_active ON medications(pet_id, is_active);
CREATE INDEX IF NOT EXISTS idx_med_pet_start ON medications(pet_id, start_date);

COMMENT ON TABLE medications IS 'Current and historical medications';

CREATE TABLE IF NOT EXISTS pet_insurance (
    insurance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(pet_id) ON DELETE CASCADE,
    insurer_name VARCHAR(255) NOT NULL,
    policy_number VARCHAR(100) UNIQUE NOT NULL,
    policy_holder_name VARCHAR(255),
    coverage_type VARCHAR(100),
    coverage_amount DECIMAL(10,2),
    deductible_amount DECIMAL(10,2),
    premium_amount DECIMAL(10,2),
    premium_frequency VARCHAR(20),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    renewal_date DATE,
    renewal_reminder_sent BOOLEAN DEFAULT FALSE,
    claim_phone VARCHAR(50),
    claim_email VARCHAR(255),
    exclusions TEXT,
    documents_urls JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_pet ON pet_insurance(pet_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policy ON pet_insurance(policy_number);
CREATE INDEX IF NOT EXISTS idx_insurance_end_active ON pet_insurance(end_date, is_active);

COMMENT ON TABLE pet_insurance IS 'Pet insurance policy information';

CREATE TABLE IF NOT EXISTS growth_tracking (
    tracking_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(pet_id) ON DELETE CASCADE,
    measurement_date DATE NOT NULL,
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    length DECIMAL(5,2),
    body_condition_score INT,
    notes TEXT,
    recorded_by UUID REFERENCES users(user_id),
    photo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_growth_pet_date ON growth_tracking(pet_id, measurement_date);

COMMENT ON TABLE growth_tracking IS 'Growth and weight tracking over time';
COMMENT ON COLUMN growth_tracking.body_condition_score IS '1-9 scale';

DO $$
BEGIN
    RAISE NOTICE 'Migration 003: Pet management tables created successfully';
END $$;-- ========================================
-- MIGRATION 004: SUBSCRIPTION SYSTEM
-- Subscription management and tracking
-- ========================================

CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(pet_id) ON DELETE CASCADE,
    tier_id SMALLINT NOT NULL REFERENCES subscription_tiers_ref(tier_id),
    billing_cycle_id SMALLINT NOT NULL REFERENCES billing_cycles_ref(billing_cycle_id),
    start_date DATE NOT NULL,
    end_date DATE,
    current_period_start DATE NOT NULL,
    current_period_end DATE NOT NULL,
    next_billing_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    pause_reason TEXT,
    paused_at TIMESTAMP,
    resume_date DATE,
    auto_renew BOOLEAN DEFAULT TRUE,
    base_price DECIMAL(10,2) NOT NULL,
    discount_applied DECIMAL(10,2) DEFAULT 0,
    final_price DECIMAL(10,2) NOT NULL,
    promo_code VARCHAR(50),
    trial_end_date DATE,
    cancellation_date TIMESTAMP,
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_user_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_pet_status ON subscriptions(pet_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_tier ON subscriptions(tier_id);
CREATE INDEX IF NOT EXISTS idx_sub_next_billing ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions(status);

COMMENT ON TABLE subscriptions IS 'Active and historical subscriptions';
COMMENT ON COLUMN subscriptions.status IS 'active, paused, cancelled, expired, trial';

CREATE TABLE IF NOT EXISTS subscription_tiers_config (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_id SMALLINT NOT NULL REFERENCES subscription_tiers_ref(tier_id),
    life_stage_id SMALLINT NOT NULL REFERENCES life_stages_ref(life_stage_id),
    species_id SMALLINT NOT NULL REFERENCES species_ref(species_id),
    category_id SMALLINT NOT NULL REFERENCES service_categories_ref(category_id),
    quota_monthly INT,
    quota_annual INT,
    is_included BOOLEAN DEFAULT FALSE,
    features JSON,
    priority_level INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tier_config_tier_stage_species ON subscription_tiers_config(tier_id, life_stage_id, species_id);
CREATE INDEX IF NOT EXISTS idx_tier_config_tier_cat ON subscription_tiers_config(tier_id, category_id);
CREATE INDEX IF NOT EXISTS idx_tier_config_tier ON subscription_tiers_config(tier_id);

COMMENT ON TABLE subscription_tiers_config IS 'Configuration matrix: what each tier includes per life stage';

CREATE TABLE IF NOT EXISTS subscription_entitlements (
    entitlement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(subscription_id) ON DELETE CASCADE,
    category_id SMALLINT NOT NULL REFERENCES service_categories_ref(category_id),
    quota_total INT,
    quota_used INT DEFAULT 0,
    quota_remaining INT,
    reset_date DATE,
    last_used_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entitle_sub ON subscription_entitlements(subscription_id);
CREATE INDEX IF NOT EXISTS idx_entitle_sub_cat ON subscription_entitlements(subscription_id, category_id);

COMMENT ON TABLE subscription_entitlements IS 'Track service usage per subscription';

CREATE TABLE IF NOT EXISTS subscription_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(subscription_id),
    action VARCHAR(50),
    old_tier_id SMALLINT REFERENCES subscription_tiers_ref(tier_id),
    new_tier_id SMALLINT REFERENCES subscription_tiers_ref(tier_id),
    old_billing_cycle_id SMALLINT REFERENCES billing_cycles_ref(billing_cycle_id),
    new_billing_cycle_id SMALLINT REFERENCES billing_cycles_ref(billing_cycle_id),
    old_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    price_difference DECIMAL(10,2),
    prorated_amount DECIMAL(10,2),
    performed_by UUID NOT NULL REFERENCES users(user_id),
    reason TEXT,
    notes TEXT,
    effective_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_hist_sub ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_hist_created ON subscription_history(created_at);
CREATE INDEX IF NOT EXISTS idx_sub_hist_action ON subscription_history(action);

COMMENT ON TABLE subscription_history IS 'Complete audit trail of subscription changes';
COMMENT ON COLUMN subscription_history.action IS 'created, upgraded, downgraded, paused, resumed, cancelled, renewed, expired';

CREATE TABLE IF NOT EXISTS subscription_reminders (
    reminder_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(subscription_id) ON DELETE CASCADE,
    reminder_type VARCHAR(50),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME DEFAULT '09:00:00',
    sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    delivery_method VARCHAR(20),
    message_content TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_scheduled_sent ON subscription_reminders(scheduled_date, sent);
CREATE INDEX IF NOT EXISTS idx_reminder_sub ON subscription_reminders(subscription_id);

COMMENT ON TABLE subscription_reminders IS 'Automated reminders for subscriptions';
COMMENT ON COLUMN subscription_reminders.reminder_type IS 'renewal, expiry, quota_warning, quota_exhausted, payment_due';

DO $$
BEGIN
    RAISE NOTICE 'Migration 004: Subscription tables created successfully';
END $$;

-- ========================================
-- MIGRATION 005: SERVICES & BOOKINGS
-- Service catalog and booking management
-- ========================================

CREATE TABLE IF NOT EXISTS service_catalog (
    service_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(255) NOT NULL,
    category_id SMALLINT NOT NULL REFERENCES service_categories_ref(category_id),
    description TEXT,
    detailed_description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    duration_minutes INT,
    is_doorstep BOOLEAN DEFAULT TRUE,
    requires_equipment BOOLEAN DEFAULT FALSE,
    equipment_list JSON,
    preparation_instructions TEXT,
    terms_conditions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    icon_url VARCHAR(500),
    banner_image_url VARCHAR(500),
    video_url VARCHAR(500),
    popularity_score INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_category ON service_catalog(category_id);
CREATE INDEX IF NOT EXISTS idx_service_active ON service_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_service_cat_active ON service_catalog(category_id, is_active);

COMMENT ON TABLE service_catalog IS 'Master service catalog';

CREATE TABLE IF NOT EXISTS service_eligibility_config (
    eligibility_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES service_catalog(service_id) ON DELETE CASCADE,
    species_id SMALLINT NOT NULL REFERENCES species_ref(species_id),
    life_stage_id SMALLINT NOT NULL REFERENCES life_stages_ref(life_stage_id),
    tier_id SMALLINT REFERENCES subscription_tiers_ref(tier_id),
    is_included BOOLEAN DEFAULT FALSE,
    price_override DECIMAL(10,2),
    discount_percentage DECIMAL(5,2),
    prerequisites TEXT,
    restrictions TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eligibility_service ON service_eligibility_config(service_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_combo ON service_eligibility_config(service_id, species_id, life_stage_id, tier_id);

COMMENT ON TABLE service_eligibility_config IS 'Service availability matrix by species/life stage/tier';

CREATE TABLE IF NOT EXISTS bookings (
    booking_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(user_id),
    pet_id UUID NOT NULL REFERENCES pets(pet_id),
    service_id UUID NOT NULL REFERENCES service_catalog(service_id),
    subscription_id UUID REFERENCES subscriptions(subscription_id),
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    estimated_duration INT,
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    location_type_id SMALLINT NOT NULL REFERENCES location_types_ref(location_type_id),
    address_id UUID REFERENCES user_addresses(address_id),
    specific_location_notes TEXT,
    status_id SMALLINT NOT NULL REFERENCES booking_statuses_ref(status_id),
    is_subscription_service BOOLEAN DEFAULT FALSE,
    base_amount DECIMAL(10,2) NOT NULL,
    addons_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES users(user_id),
    cancelled_at TIMESTAMP,
    can_reschedule BOOLEAN DEFAULT TRUE,
    reschedule_count INT DEFAULT 0,
    max_reschedules INT DEFAULT 2,
    special_instructions TEXT,
    pet_behavior_notes TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_pet ON bookings(pet_id);
CREATE INDEX IF NOT EXISTS idx_booking_service ON bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_booking_sub ON bookings(subscription_id);
CREATE INDEX IF NOT EXISTS idx_booking_date_status ON bookings(booking_date, status_id);
CREATE INDEX IF NOT EXISTS idx_booking_status ON bookings(status_id);
CREATE INDEX IF NOT EXISTS idx_booking_number ON bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_booking_datetime ON bookings(booking_date, booking_time);

COMMENT ON TABLE bookings IS 'Service bookings from customers';
COMMENT ON COLUMN bookings.payment_status IS 'pending, paid, failed, refunded';

CREATE TABLE IF NOT EXISTS booking_addons (
    addon_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    addon_type VARCHAR(50),
    addon_name VARCHAR(255) NOT NULL,
    addon_description TEXT,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INT DEFAULT 1,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addon_booking ON booking_addons(booking_id);

COMMENT ON TABLE booking_addons IS 'Additional products/services added to bookings';
COMMENT ON COLUMN booking_addons.addon_type IS 'product, service_upgrade, extra_service';

CREATE TABLE IF NOT EXISTS booking_status_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    old_status_id SMALLINT REFERENCES booking_statuses_ref(status_id),
    new_status_id SMALLINT NOT NULL REFERENCES booking_statuses_ref(status_id),
    changed_by UUID NOT NULL REFERENCES users(user_id),
    changed_by_role VARCHAR(30),
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_hist_booking ON booking_status_history(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_hist_created ON booking_status_history(created_at);

COMMENT ON TABLE booking_status_history IS 'Booking status change audit trail';
COMMENT ON COLUMN booking_status_history.changed_by_role IS 'customer, caregiver, admin';

CREATE TABLE IF NOT EXISTS service_availability (
    availability_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES service_catalog(service_id) ON DELETE CASCADE,
    day_of_week INT,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INT DEFAULT 60,
    max_bookings_per_slot INT DEFAULT 5,
    buffer_time_minutes INT DEFAULT 15,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avail_service_day ON service_availability(service_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_avail_service ON service_availability(service_id);

COMMENT ON TABLE service_availability IS 'Service scheduling and slot configuration';
COMMENT ON COLUMN service_availability.day_of_week IS '0=Sunday, 1=Monday, ... 6=Saturday';

CREATE TABLE IF NOT EXISTS service_blackout_dates (
    blackout_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES service_catalog(service_id) ON DELETE CASCADE,
    blackout_date DATE NOT NULL,
    reason VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blackout_service_date ON service_blackout_dates(service_id, blackout_date);

COMMENT ON TABLE service_blackout_dates IS 'Dates when services are unavailable';

DO $$
BEGIN
    RAISE NOTICE 'Migration 005: Services and bookings tables created successfully';
END $$;-- ========================================
-- MIGRATION 006: PAYMENT SYSTEM
-- Payment methods, invoices, payments, refunds
-- ========================================

CREATE TABLE IF NOT EXISTS payment_methods (
    method_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    method_type VARCHAR(30),
    provider VARCHAR(50),
    token VARCHAR(500),
    card_brand VARCHAR(30),
    last_four VARCHAR(4),
    expiry_month VARCHAR(2),
    expiry_year VARCHAR(4),
    cardholder_name VARCHAR(255),
    billing_address_id UUID REFERENCES user_addresses(address_id),
    is_default BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_method_user_default ON payment_methods(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_payment_method_user ON payment_methods(user_id);

COMMENT ON TABLE payment_methods IS 'Saved payment methods for users';

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    subscription_id UUID REFERENCES subscriptions(subscription_id),
    booking_id UUID REFERENCES bookings(booking_id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_type VARCHAR(30),
    subtotal DECIMAL(10,2) NOT NULL,
    tax_percentage DECIMAL(5,2) DEFAULT 18.00,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) NOT NULL,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP,
    payment_link VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_sub ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoice_booking ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status_due ON invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON invoices(status);

COMMENT ON TABLE invoices IS 'Financial invoices for all transactions';

CREATE TABLE IF NOT EXISTS invoice_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    item_type VARCHAR(50),
    description VARCHAR(255) NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    tax_applicable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_item_invoice ON invoice_line_items(invoice_id);

COMMENT ON TABLE invoice_line_items IS 'Itemized breakdown of invoices';

CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    payment_method_id UUID REFERENCES payment_methods(method_id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) NOT NULL,
    payment_gateway VARCHAR(50),
    transaction_id VARCHAR(255) UNIQUE,
    gateway_order_id VARCHAR(255),
    gateway_response JSON,
    failure_reason TEXT,
    payment_method_used VARCHAR(50),
    payment_date TIMESTAMP,
    retry_count INT DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_txn ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_date ON payments(payment_date);

COMMENT ON TABLE payments IS 'Payment transaction records';

CREATE TABLE IF NOT EXISTS refunds (
    refund_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(payment_id),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id),
    booking_id UUID REFERENCES bookings(booking_id),
    refund_amount DECIMAL(10,2) NOT NULL,
    refund_type VARCHAR(30),
    reason VARCHAR(255),
    detailed_reason TEXT,
    status VARCHAR(20),
    refund_method VARCHAR(30),
    refund_transaction_id VARCHAR(255),
    gateway_refund_id VARCHAR(255),
    processing_fee DECIMAL(10,2) DEFAULT 0,
    net_refund_amount DECIMAL(10,2),
    processed_at TIMESTAMP,
    expected_date DATE,
    requested_by UUID NOT NULL REFERENCES users(user_id),
    approved_by UUID REFERENCES users(user_id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refund_invoice ON refunds(invoice_id);
CREATE INDEX IF NOT EXISTS idx_refund_booking ON refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refund_status ON refunds(status);

COMMENT ON TABLE refunds IS 'Refund requests and processing';

DO $$
BEGIN
    RAISE NOTICE 'Migration 006: Payment tables created successfully';
END $$;-- ========================================
-- MIGRATION 007: CAREGIVER SYSTEM
-- Caregivers, assignments, ratings, earnings
-- ========================================

CREATE TABLE IF NOT EXISTS caregivers (
    caregiver_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255),
    photo_url VARCHAR(500),
    date_of_birth DATE,
    gender VARCHAR(10),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(15),
    experience_years INT,
    education VARCHAR(255),
    certifications JSON,
    languages_spoken JSON,
    specializations JSON,
    service_area_pincodes JSON,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_ratings INT DEFAULT 0,
    total_services_completed INT DEFAULT 0,
    total_distance_traveled DECIMAL(10,2) DEFAULT 0,
    background_check_status VARCHAR(30),
    background_check_date DATE,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    suspension_reason TEXT,
    bank_account_number VARCHAR(50),
    ifsc_code VARCHAR(15),
    pan_number VARCHAR(10),
    aadhar_number VARCHAR(12),
    joined_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caregiver_user ON caregivers(user_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_status ON caregivers(status);
CREATE INDEX IF NOT EXISTS idx_caregiver_rating ON caregivers(average_rating);
CREATE INDEX IF NOT EXISTS idx_caregiver_city ON caregivers(city);
CREATE INDEX IF NOT EXISTS idx_caregiver_status_rating ON caregivers(status, average_rating);

COMMENT ON TABLE caregivers IS 'Caregiver profiles with complete details';

CREATE TABLE IF NOT EXISTS caregiver_specializations (
    specialization_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caregiver_id UUID NOT NULL REFERENCES caregivers(caregiver_id) ON DELETE CASCADE,
    category_id SMALLINT NOT NULL REFERENCES service_categories_ref(category_id),
    proficiency_level VARCHAR(20),
    certification_name VARCHAR(255),
    certification_url VARCHAR(500),
    years_experience INT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_special_caregiver ON caregiver_specializations(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_special_caregiver_cat ON caregiver_specializations(caregiver_id, category_id);

COMMENT ON TABLE caregiver_specializations IS 'Caregiver service specializations and certifications';

CREATE TABLE IF NOT EXISTS assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(booking_id),
    caregiver_id UUID NOT NULL REFERENCES caregivers(caregiver_id),
    assigned_by UUID NOT NULL REFERENCES users(user_id),
    assignment_type VARCHAR(30) DEFAULT 'auto',
    status VARCHAR(30),
    rejection_reason TEXT,
    route_details JSON,
    estimated_distance_km DECIMAL(6,2),
    actual_distance_km DECIMAL(6,2),
    estimated_start_time TIMESTAMP,
    actual_start_time TIMESTAMP,
    estimated_end_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    travel_time_minutes INT,
    service_time_minutes INT,
    mileage_reimbursement DECIMAL(10,2),
    service_payment DECIMAL(10,2),
    total_earnings DECIMAL(10,2),
    assigned_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assign_caregiver ON assignments(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_assign_booking ON assignments(booking_id);
CREATE INDEX IF NOT EXISTS idx_assign_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assign_caregiver_status ON assignments(caregiver_id, status);
CREATE INDEX IF NOT EXISTS idx_assign_assigned_at ON assignments(assigned_at);

COMMENT ON TABLE assignments IS 'Caregiver assignments for bookings';

CREATE TABLE IF NOT EXISTS service_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    pre_service_checklist JSON,
    post_service_checklist JSON,
    before_photos JSON,
    after_photos JSON,
    service_notes TEXT,
    pet_behavior_observed TEXT,
    health_observations TEXT,
    concerns_flagged TEXT,
    products_used JSON,
    customer_feedback_immediate TEXT,
    additional_services_recommended TEXT,
    next_visit_suggestions TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_assignment ON service_logs(assignment_id);

COMMENT ON TABLE service_logs IS 'Detailed service execution logs by caregivers';

CREATE TABLE IF NOT EXISTS caregiver_ratings (
    rating_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(booking_id),
    caregiver_id UUID NOT NULL REFERENCES caregivers(caregiver_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    rating_score DECIMAL(2,1) NOT NULL,
    punctuality_rating INT,
    quality_rating INT,
    friendliness_rating INT,
    professionalism_rating INT,
    feedback TEXT,
    positive_aspects JSON,
    negative_aspects JSON,
    would_book_again BOOLEAN,
    is_moderated BOOLEAN DEFAULT FALSE,
    moderation_notes TEXT,
    moderated_by UUID REFERENCES users(user_id),
    moderated_at TIMESTAMP,
    is_visible BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rating_caregiver ON caregiver_ratings(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_rating_booking ON caregiver_ratings(booking_id);
CREATE INDEX IF NOT EXISTS idx_rating_created ON caregiver_ratings(created_at);
CREATE INDEX IF NOT EXISTS idx_rating_caregiver_visible ON caregiver_ratings(caregiver_id, is_visible);

COMMENT ON TABLE caregiver_ratings IS 'Customer ratings and reviews for caregivers';

CREATE TABLE IF NOT EXISTS caregiver_availability (
    availability_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caregiver_id UUID NOT NULL REFERENCES caregivers(caregiver_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    unavailability_reason VARCHAR(50),
    max_bookings INT DEFAULT 8,
    current_bookings INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avail_caregiver_date ON caregiver_availability(caregiver_id, date);
CREATE INDEX IF NOT EXISTS idx_avail_date_available ON caregiver_availability(date, is_available);

COMMENT ON TABLE caregiver_availability IS 'Caregiver schedule and availability';

CREATE TABLE IF NOT EXISTS caregiver_earnings (
    earning_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caregiver_id UUID NOT NULL REFERENCES caregivers(caregiver_id),
    assignment_id UUID REFERENCES assignments(assignment_id),
    earning_type VARCHAR(30),
    amount DECIMAL(10,2) NOT NULL,
    calculation_details JSON,
    earning_date DATE NOT NULL,
    payout_status VARCHAR(20) DEFAULT 'pending',
    payout_batch_id UUID,
    paid_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_earning_caregiver ON caregiver_earnings(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_earning_caregiver_date ON caregiver_earnings(caregiver_id, earning_date);
CREATE INDEX IF NOT EXISTS idx_earning_status ON caregiver_earnings(payout_status);

COMMENT ON TABLE caregiver_earnings IS 'Caregiver earnings tracking';

DO $$
BEGIN
    RAISE NOTICE 'Migration 007: Caregiver tables created successfully';
END $$;-- ========================================
-- MIGRATION 008: CARE MANAGER SYSTEM
-- Care managers for Eternal tier subscriptions
-- ========================================

CREATE TABLE IF NOT EXISTS care_managers (
    care_manager_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    photo_url VARCHAR(500),
    specialization TEXT,
    qualifications TEXT,
    experience_years INT,
    max_pets INT DEFAULT 50,
    current_pets_count INT DEFAULT 0,
    average_satisfaction_score DECIMAL(3,2),
    languages_spoken JSON,
    status VARCHAR(20) DEFAULT 'active',
    joined_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_user ON care_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_cm_status ON care_managers(status);
CREATE INDEX IF NOT EXISTS idx_cm_status_count ON care_managers(status, current_pets_count);

COMMENT ON TABLE care_managers IS 'Dedicated care managers for Eternal tier subscriptions';

CREATE TABLE IF NOT EXISTS care_manager_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    care_manager_id UUID NOT NULL REFERENCES care_managers(care_manager_id),
    subscription_id UUID UNIQUE NOT NULL REFERENCES subscriptions(subscription_id),
    pet_id UUID NOT NULL REFERENCES pets(pet_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    assignment_date DATE DEFAULT CURRENT_DATE,
    onboarding_call_completed BOOLEAN DEFAULT FALSE,
    onboarding_call_date TIMESTAMP,
    care_plan_created BOOLEAN DEFAULT FALSE,
    care_plan_url VARCHAR(500),
    check_in_frequency VARCHAR(20) DEFAULT 'weekly',
    last_check_in_date DATE,
    next_check_in_date DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    unassigned_date DATE,
    unassignment_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_assign_manager ON care_manager_assignments(care_manager_id);
CREATE INDEX IF NOT EXISTS idx_cm_assign_sub ON care_manager_assignments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_cm_assign_pet ON care_manager_assignments(pet_id);
CREATE INDEX IF NOT EXISTS idx_cm_assign_manager_active ON care_manager_assignments(care_manager_id, is_active);

COMMENT ON TABLE care_manager_assignments IS 'Care manager to pet assignments';

CREATE TABLE IF NOT EXISTS care_manager_interactions (
    interaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES care_manager_assignments(assignment_id) ON DELETE CASCADE,
    interaction_type VARCHAR(50),
    interaction_date TIMESTAMP NOT NULL,
    duration_minutes INT,
    summary TEXT,
    action_items JSON,
    next_follow_up_date DATE,
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_interact_assign ON care_manager_interactions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_cm_interact_date ON care_manager_interactions(interaction_date);

COMMENT ON TABLE care_manager_interactions IS 'Log of care manager interactions with pet parents';

DO $$
BEGIN
    RAISE NOTICE 'Migration 008: Care manager tables created successfully';
END $$;-- ========================================
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
END $$;-- ========================================
-- MIGRATION 010: NOTIFICATION SYSTEM
-- Notifications, preferences, templates
-- ========================================

CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'normal',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    rich_content JSON,
    action_type VARCHAR(50),
    action_url VARCHAR(500),
    action_data JSON,
    delivery_method VARCHAR(20),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    is_delivered BOOLEAN DEFAULT FALSE,
    delivered_at TIMESTAMP,
    is_clicked BOOLEAN DEFAULT FALSE,
    clicked_at TIMESTAMP,
    expires_at TIMESTAMP,
    sent_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_user_sent ON notifications(user_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_notif_type ON notifications(notification_type);

COMMENT ON TABLE notifications IS 'All notifications sent to users';

CREATE TABLE IF NOT EXISTS notification_preferences (
    preference_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    booking_confirmations BOOLEAN DEFAULT TRUE,
    booking_reminders BOOLEAN DEFAULT TRUE,
    health_reminders BOOLEAN DEFAULT TRUE,
    vaccination_reminders BOOLEAN DEFAULT TRUE,
    medication_reminders BOOLEAN DEFAULT TRUE,
    subscription_updates BOOLEAN DEFAULT TRUE,
    payment_alerts BOOLEAN DEFAULT TRUE,
    promotional BOOLEAN DEFAULT TRUE,
    community_events BOOLEAN DEFAULT TRUE,
    care_manager_updates BOOLEAN DEFAULT TRUE,
    emergency_alerts BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    whatsapp_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE notification_preferences IS 'Granular notification preferences per user';

CREATE TABLE IF NOT EXISTS notification_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_code VARCHAR(50) UNIQUE NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    delivery_method VARCHAR(20) NOT NULL,
    subject VARCHAR(255),
    body_template TEXT NOT NULL,
    variables JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_code ON notification_templates(template_code);
CREATE INDEX IF NOT EXISTS idx_template_type ON notification_templates(notification_type);

COMMENT ON TABLE notification_templates IS 'Reusable notification templates';

DO $$
BEGIN
    RAISE NOTICE 'Migration 010: Notification tables created successfully';
END $$;-- ========================================
-- MIGRATION 011: COMMUNITY & EVENTS
-- Community events and registrations
-- ========================================

CREATE TABLE IF NOT EXISTS community_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    detailed_description TEXT,
    event_type VARCHAR(50),
    species_id SMALLINT REFERENCES species_ref(species_id),
    life_stages_allowed JSON,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    end_time TIME,
    duration_minutes INT,
    location_name VARCHAR(255),
    location_address TEXT,
    location_latitude DECIMAL(10,8),
    location_longitude DECIMAL(11,8),
    max_participants INT,
    current_participants INT DEFAULT 0,
    min_participants INT DEFAULT 1,
    is_free BOOLEAN DEFAULT TRUE,
    price DECIMAL(10,2),
    subscription_tiers_allowed JSON,
    requirements TEXT,
    what_to_bring TEXT,
    banner_image_url VARCHAR(500),
    gallery_images JSON,
    organizer_name VARCHAR(255),
    organizer_contact VARCHAR(50),
    status VARCHAR(20) DEFAULT 'upcoming',
    cancellation_reason TEXT,
    registration_deadline DATE,
    waitlist_enabled BOOLEAN DEFAULT FALSE,
    waitlist_count INT DEFAULT 0,
    tags JSON,
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_date ON community_events(event_date);
CREATE INDEX IF NOT EXISTS idx_event_status ON community_events(status);
CREATE INDEX IF NOT EXISTS idx_event_date_status ON community_events(event_date, status);
CREATE INDEX IF NOT EXISTS idx_event_type ON community_events(event_type);

COMMENT ON TABLE community_events IS 'Community events and socialization sessions';

CREATE TABLE IF NOT EXISTS event_registrations (
    registration_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES community_events(event_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    pet_id UUID NOT NULL REFERENCES pets(pet_id),
    registration_type VARCHAR(20) DEFAULT 'confirmed',
    status VARCHAR(20) DEFAULT 'registered',
    payment_required BOOLEAN DEFAULT FALSE,
    payment_status VARCHAR(20),
    invoice_id UUID REFERENCES invoices(invoice_id),
    special_requirements TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(15),
    checked_in BOOLEAN DEFAULT FALSE,
    checked_in_at TIMESTAMP,
    feedback_rating INT,
    feedback_text TEXT,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP,
    registered_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_reg_user ON event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_reg_pet ON event_registrations(pet_id);
CREATE INDEX IF NOT EXISTS idx_reg_event_status ON event_registrations(event_id, status);

COMMENT ON TABLE event_registrations IS 'User registrations for community events';

DO $$
BEGIN
    RAISE NOTICE 'Migration 011: Community tables created successfully';
END $$;-- ========================================
-- MIGRATION 012: SUPPORT & ADMIN
-- Support tickets, admin users, audit logs
-- ========================================

CREATE TABLE IF NOT EXISTS admin_users (
    admin_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15),
    photo_url VARCHAR(500),
    role VARCHAR(50),
    department VARCHAR(50),
    permissions JSON,
    can_access_finance BOOLEAN DEFAULT FALSE,
    can_manage_users BOOLEAN DEFAULT FALSE,
    can_manage_caregivers BOOLEAN DEFAULT FALSE,
    can_manage_content BOOLEAN DEFAULT FALSE,
    reporting_to UUID REFERENCES admin_users(admin_id),
    is_active BOOLEAN DEFAULT TRUE,
    joined_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_user ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_active ON admin_users(is_active);

COMMENT ON TABLE admin_users IS 'Admin/staff user accounts';

CREATE TABLE IF NOT EXISTS support_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(user_id),
    booking_id UUID REFERENCES bookings(booking_id),
    subscription_id UUID REFERENCES subscriptions(subscription_id),
    pet_id UUID REFERENCES pets(pet_id),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50),
    subcategory VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    channel VARCHAR(20),
    assigned_to UUID REFERENCES admin_users(admin_id),
    assigned_at TIMESTAMP,
    first_response_at TIMESTAMP,
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP,
    resolution_notes TEXT,
    customer_satisfaction_rating INT,
    customer_feedback TEXT,
    attachments JSON,
    tags JSON,
    internal_notes TEXT,
    escalated BOOLEAN DEFAULT FALSE,
    escalated_to UUID REFERENCES admin_users(admin_id),
    escalated_at TIMESTAMP,
    sla_due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_ticket_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_ticket_status_priority ON support_tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_ticket_assigned ON support_tickets(assigned_to);

COMMENT ON TABLE support_tickets IS 'Customer support ticket management';

CREATE TABLE IF NOT EXISTS ticket_messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(ticket_id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(user_id),
    sender_type VARCHAR(20),
    message TEXT NOT NULL,
    attachments JSON,
    is_internal BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msg_ticket ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_msg_created ON ticket_messages(created_at);

COMMENT ON TABLE ticket_messages IS 'Ticket conversation threads';

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    admin_id UUID REFERENCES admin_users(admin_id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_value JSON,
    new_value JSON,
    changes_summary TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    geolocation JSON,
    request_method VARCHAR(10),
    request_url TEXT,
    response_status INT,
    severity VARCHAR(20) DEFAULT 'info',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity_combo ON audit_logs(entity_type, entity_id);

COMMENT ON TABLE audit_logs IS 'Complete audit trail of all system actions';

DO $$
BEGIN
    RAISE NOTICE 'Migration 012: Support and admin tables created successfully';
END $$;-- ========================================
-- MIGRATION 013: CONFIGURATION TABLES
-- Pricing rules, promo codes, app settings
-- ========================================

CREATE TABLE IF NOT EXISTS pricing_rules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_name VARCHAR(255) NOT NULL,
    service_id UUID REFERENCES service_catalog(service_id),
    tier_id SMALLINT REFERENCES subscription_tiers_ref(tier_id),
    species_id SMALLINT REFERENCES species_ref(species_id),
    life_stage_id SMALLINT REFERENCES life_stages_ref(life_stage_id),
    location_type_id SMALLINT REFERENCES location_types_ref(location_type_id),
    price_modifier DECIMAL(10,2),
    modifier_type VARCHAR(20),
    day_of_week INT,
    time_start TIME,
    time_end TIME,
    min_booking_value DECIMAL(10,2),
    max_booking_value DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0,
    valid_from DATE,
    valid_until DATE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_rule_service_tier ON pricing_rules(service_id, tier_id);
CREATE INDEX IF NOT EXISTS idx_price_rule_validity ON pricing_rules(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_price_rule_active ON pricing_rules(is_active);

COMMENT ON TABLE pricing_rules IS 'Dynamic pricing rules based on multiple factors';

CREATE TABLE IF NOT EXISTS fair_usage_policies (
    policy_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_id SMALLINT NOT NULL REFERENCES subscription_tiers_ref(tier_id),
    category_id SMALLINT NOT NULL REFERENCES service_categories_ref(category_id),
    max_usage_per_month INT,
    max_usage_per_week INT,
    max_usage_per_day INT,
    cooldown_period_days INT,
    cooldown_period_hours INT,
    abuse_threshold INT,
    abuse_action VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fup_tier ON fair_usage_policies(tier_id);
CREATE INDEX IF NOT EXISTS idx_fup_tier_cat ON fair_usage_policies(tier_id, category_id);

COMMENT ON TABLE fair_usage_policies IS 'Fair usage policies for unlimited services';

CREATE TABLE IF NOT EXISTS promo_codes (
    promo_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promo_code VARCHAR(50) UNIQUE NOT NULL,
    promo_name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20),
    discount_value DECIMAL(10,2) NOT NULL,
    max_discount_amount DECIMAL(10,2),
    min_purchase_amount DECIMAL(10,2),
    applicable_to VARCHAR(30),
    tier_ids JSON,
    service_ids JSON,
    max_uses_total INT,
    max_uses_per_user INT DEFAULT 1,
    current_uses INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    created_by UUID REFERENCES admin_users(admin_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(promo_code);
CREATE INDEX IF NOT EXISTS idx_promo_active_validity ON promo_codes(is_active, valid_from, valid_until);

COMMENT ON TABLE promo_codes IS 'Promotional discount codes';

CREATE TABLE IF NOT EXISTS promo_code_usage (
    usage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promo_id UUID NOT NULL REFERENCES promo_codes(promo_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    subscription_id UUID REFERENCES subscriptions(subscription_id),
    booking_id UUID REFERENCES bookings(booking_id),
    invoice_id UUID REFERENCES invoices(invoice_id),
    discount_applied DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_usage_promo ON promo_code_usage(promo_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_user ON promo_code_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_combo ON promo_code_usage(promo_id, user_id);

COMMENT ON TABLE promo_code_usage IS 'Track promo code usage';

CREATE TABLE IF NOT EXISTS app_settings (
    setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20),
    category VARCHAR(50),
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    updated_by UUID REFERENCES admin_users(admin_id),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_setting_key ON app_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_setting_category ON app_settings(category);

COMMENT ON TABLE app_settings IS 'Global app configuration settings';

CREATE TABLE IF NOT EXISTS system_alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20),
    display_location VARCHAR(50),
    target_audience VARCHAR(30),
    is_active BOOLEAN DEFAULT TRUE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    created_by UUID REFERENCES admin_users(admin_id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_active_time ON system_alerts(is_active, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_alert_type ON system_alerts(alert_type);

COMMENT ON TABLE system_alerts IS 'System-wide alerts and announcements';

DO $$
BEGIN
    RAISE NOTICE 'Migration 013: Configuration tables created successfully';
END $$;-- ========================================
-- MIGRATION 014: ANALYTICS & REPORTING
-- User behavior analytics and business metrics
-- ========================================

CREATE TABLE IF NOT EXISTS user_behavior_analytics (
    analytics_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    session_id UUID REFERENCES sessions(session_id),
    event_type VARCHAR(50),
    event_name VARCHAR(100),
    page_url VARCHAR(500),
    referrer_url VARCHAR(500),
    event_data JSON,
    device_type VARCHAR(20),
    browser VARCHAR(50),
    os VARCHAR(50),
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_user ON user_behavior_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON user_behavior_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON user_behavior_analytics(timestamp);

COMMENT ON TABLE user_behavior_analytics IS 'User behavior tracking for analytics';

CREATE TABLE IF NOT EXISTS business_metrics (
    metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date DATE NOT NULL,
    metric_type VARCHAR(50),
    metric_value DECIMAL(15,2) NOT NULL,
    breakdown JSON,
    calculated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_date ON business_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON business_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_type_date ON business_metrics(metric_type, metric_date);

COMMENT ON TABLE business_metrics IS 'Pre-calculated business metrics for reporting';

DO $$
BEGIN
    RAISE NOTICE 'Migration 014: Analytics tables created successfully';
END $$;DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_tier_species_stage_category') THEN
        ALTER TABLE subscription_tiers_config
        ADD CONSTRAINT unique_tier_species_stage_category 
        UNIQUE (tier_id, species_id, life_stage_id, category_id);
    END IF;
END $$;
-- ========================================
-- MIGRATION 016: REFERRAL SYSTEM
-- User referral codes, tracking, and rewards
-- ========================================

-- 1. Add referral_code to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(15) UNIQUE;

-- 2. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- 3. Function to generate a random referral code
CREATE OR REPLACE FUNCTION generate_unique_referral_code() 
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    done BOOLEAN := FALSE;
BEGIN
    WHILE NOT done LOOP
        -- Generate a 8-character alphanumeric code
        new_code := upper(substring(md5(random()::text) from 1 for 8));
        
        -- Check for uniqueness
        IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = new_code) THEN
            done := TRUE;
        END IF;
    END LOOP;
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger to auto-assign referral code to new users
CREATE OR REPLACE FUNCTION trg_set_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_unique_referral_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON users;
CREATE TRIGGER trg_assign_referral_code
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_referral_code();

-- 5. Backfill existing users with referral codes
UPDATE users SET referral_code = generate_unique_referral_code() WHERE referral_code IS NULL;

-- 6. Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
    referral_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES users(user_id),
    referred_id UUID NOT NULL REFERENCES users(user_id) UNIQUE, -- One user can only be referred once
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, reward_issued
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

COMMENT ON TABLE referrals IS 'Tracks user-to-user referral relationships';

-- 7. Referral Rewards Table
CREATE TABLE IF NOT EXISTS referral_rewards (
    reward_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_id UUID NOT NULL REFERENCES referrals(referral_id),
    user_id UUID NOT NULL REFERENCES users(user_id), -- Receiver of the reward
    reward_type VARCHAR(30) NOT NULL, -- e.g., 'wallet_credit', 'subscription_discount', 'promo_code'
    reward_value DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending', -- pending, processed, failed
    promo_id UUID REFERENCES promo_codes(promo_id), -- If reward is a promo code
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ref_rewards_user ON referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_ref_rewards_status ON referral_rewards(status);

COMMENT ON TABLE referral_rewards IS 'Tracks rewards issued for successful referrals';

-- 8. Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 016: Referral system tables created successfully';
END $$;
-- ========================================
-- MIGRATION 017: ENHANCE SERVICE CONFIG
-- Relax eligibility constraints & add location slots
-- ========================================

-- 1. Relax Service Eligibility Constraints (Wildcards)
ALTER TABLE service_eligibility_config 
ALTER COLUMN species_id DROP NOT NULL;

ALTER TABLE service_eligibility_config 
ALTER COLUMN life_stage_id DROP NOT NULL;

-- 2. Add Location-Based Availability
ALTER TABLE service_availability 
ADD COLUMN pincode VARCHAR(10);

-- 3. Index for Location lookups
CREATE INDEX IF NOT EXISTS idx_avail_service_pincode 
ON service_availability(service_id, pincode);

DO $$
BEGIN
    RAISE NOTICE 'Migration 017: Service configuration enhanced successfully';
END $$;
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
-- ========================================
-- MIGRATION 019: SERVICE REQUEST QUEUE & OPTIMIZATION
-- Supply-side optimization with urgency scoring
-- ========================================

-- 1. Service Requests Table (Request Queue)
CREATE TABLE IF NOT EXISTS service_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core References
    user_id UUID NOT NULL REFERENCES users(user_id),
    pet_id UUID NOT NULL REFERENCES pets(pet_id),
    service_id UUID NOT NULL REFERENCES service_catalog(service_id),
    address_id UUID NOT NULL REFERENCES user_addresses(address_id),
    subscription_id UUID REFERENCES subscriptions(subscription_id),
    
    -- Service Type
    service_type VARCHAR(50) NOT NULL, -- 'grooming', 'vet_visit'
    
    -- Location Data (denormalized for clustering performance)
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    address_line1 VARCHAR(255),
    city VARCHAR(100),
    pincode VARCHAR(10),
    
    -- Priority & Urgency
    priority SMALLINT NOT NULL DEFAULT 3, -- 1=Eternal, 2=Plus, 3=Basic
    urgency_score DECIMAL(5,2) DEFAULT 0, -- calculated: days_overdue / ideal_interval * tier_multiplier
    last_service_date DATE, -- last time this pet received this service
    days_since_last_service INT, -- calculated field for transparency
    
    -- Status Tracking
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, scheduled, confirmed, customer_rejected, completed, cancelled
    
    -- Assignment Data (filled by optimizer)
    assigned_date DATE,
    assigned_time TIME,
    assigned_schedule_id UUID REFERENCES van_schedules(schedule_id),
    route_sequence INT, -- position in route
    estimated_arrival_time TIME,
    estimated_departure_time TIME,
    
    -- Customer Response Tracking
    notification_sent_at TIMESTAMP,
    customer_response_deadline TIMESTAMP, -- 24 hours from notification
    customer_responded_at TIMESTAMP,
    customer_response VARCHAR(20), -- 'accepted', 'rejected', 'requested_alternative'
    rejection_count INT DEFAULT 0, -- track how many times customer rejected
    
    -- Metadata
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'scheduled', 'confirmed', 'customer_rejected', 'completed', 'cancelled')),
    CONSTRAINT valid_priority CHECK (priority BETWEEN 1 AND 3),
    CONSTRAINT valid_response CHECK (customer_response IS NULL OR customer_response IN ('accepted', 'rejected', 'requested_alternative'))
);

-- 2. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_service_requests_optimization 
ON service_requests(status, urgency_score DESC, created_at) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_service_requests_location 
ON service_requests(latitude, longitude) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_service_requests_user 
ON service_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_service_requests_pet 
ON service_requests(pet_id, service_type);

CREATE INDEX IF NOT EXISTS idx_service_requests_schedule 
ON service_requests(assigned_schedule_id, route_sequence) 
WHERE assigned_schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_requests_response_deadline 
ON service_requests(customer_response_deadline) 
WHERE status = 'scheduled' AND customer_response IS NULL;

-- 3. Enhance Vans Table
ALTER TABLE vans ADD COLUMN IF NOT EXISTS zone VARCHAR(100) DEFAULT 'Pune Central';
ALTER TABLE vans ADD COLUMN IF NOT EXISTS start_location_lat DECIMAL(10,8) DEFAULT 18.5314;
ALTER TABLE vans ADD COLUMN IF NOT EXISTS start_location_lng DECIMAL(11,8) DEFAULT 73.8446;
ALTER TABLE vans ADD COLUMN IF NOT EXISTS max_stops_per_day INT DEFAULT 6;

-- 4. Route Optimization Metrics Table
CREATE TABLE IF NOT EXISTS route_optimization_metrics (
    metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES van_schedules(schedule_id),
    total_stops INT NOT NULL,
    total_distance_km DECIMAL(10,2),
    total_duration_minutes INT,
    efficiency_score DECIMAL(5,2),
    pending_requests_count INT,
    assigned_requests_count INT,
    high_urgency_assigned INT,
    algorithm_used VARCHAR(50),
    clustering_method VARCHAR(50),
    optimization_time_ms INT,
    optimized_at TIMESTAMP DEFAULT NOW(),
    optimized_by UUID REFERENCES users(user_id),
    notes TEXT
);

-- 5. Triggers for Auto-Calculation
CREATE OR REPLACE FUNCTION update_service_request_urgency()
RETURNS TRIGGER AS $$
DECLARE
    tier_multiplier DECIMAL(3,2);
    ideal_interval INT;
    days_overdue INT;
BEGIN
    tier_multiplier := CASE NEW.priority
        WHEN 1 THEN 1.5  -- Eternal
        WHEN 2 THEN 1.2  -- Plus
        ELSE 1.0         -- Basic
    END;
    
    ideal_interval := CASE NEW.service_type
        WHEN 'grooming' THEN 30
        WHEN 'vet_visit' THEN 
            CASE NEW.priority
                WHEN 1 THEN 30
                WHEN 2 THEN 90
                ELSE 180
            END
        ELSE 30
    END;
    
    IF NEW.last_service_date IS NOT NULL THEN
        NEW.days_since_last_service := CURRENT_DATE - NEW.last_service_date;
        days_overdue := NEW.days_since_last_service;
    ELSE
        NEW.days_since_last_service := ideal_interval;
        days_overdue := ideal_interval;
    END IF;
    
    NEW.urgency_score := (days_overdue::DECIMAL / ideal_interval) * tier_multiplier;
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_service_request_urgency
    BEFORE INSERT OR UPDATE OF last_service_date, priority, service_type
    ON service_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_service_request_urgency();

CREATE OR REPLACE FUNCTION set_customer_response_deadline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'scheduled' AND OLD.status = 'pending' THEN
        NEW.notification_sent_at := NOW();
        NEW.customer_response_deadline := NOW() + INTERVAL '24 hours';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_response_deadline
    BEFORE UPDATE OF status
    ON service_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_customer_response_deadline();

DO $$
BEGIN
    RAISE NOTICE 'Migration 019: Service request queue system created successfully';
END $$;
-- ============================================
-- Add password_hash column to users table
-- For admin authentication
-- ============================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Update existing admin user if exists
-- Default password: admin123
UPDATE users 
SET password_hash = '$2a$10$YourHashedPasswordHere'
WHERE email = 'admin@tailsandtales.com' 
AND password_hash IS NULL;
-- =============================================
-- Migration: Create attachments table for S3 tracking
-- Description: Tracks all S3 uploads to identify and clean up orphan files.
-- =============================================

CREATE TABLE IF NOT EXISTS attachments (
    attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    s3_key VARCHAR(500) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    size BIGINT,
    mimetype VARCHAR(100),
    is_permanent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for cleanup job
CREATE INDEX IF NOT EXISTS idx_attachments_permanent_created ON attachments (is_permanent, created_at) WHERE is_permanent = FALSE;

-- Index for searching by URL (used when marking as permanent)
CREATE INDEX IF NOT EXISTS idx_attachments_url ON attachments (url);

COMMENT ON TABLE attachments IS 'Tracks all uploaded files in S3. Files not marked as permanent within 24h are deleted by cleanup cron.';
DO $$
DECLARE
    -- REPLACE THESE VALUES
    v_phone TEXT := '+918055321309';
    v_email TEXT := 'admin@tailsandtales.com';
    v_name  TEXT := 'System Admin';
    
    -- Variables for IDs
    v_user_id UUID := gen_random_uuid();
    v_admin_id UUID := gen_random_uuid();
    v_role_id SMALLINT;
BEGIN
    -- 1. Get the Role ID for 'super_admin' (or 'admin')
    SELECT role_id INTO v_role_id 
    FROM user_roles_ref 
    WHERE role_code = 'super_admin';

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role super_admin not found in user_roles_ref';
    END IF;

    -- 2. Create the User record
    INSERT INTO users (
        user_id, phone, email, full_name, role_id, status, created_at, updated_at
    ) VALUES (
        v_user_id, v_phone, v_email, v_name, v_role_id, 'active', NOW(), NOW()
    );

    -- 3. Create the Admin Profile
    INSERT INTO admin_users (
        admin_id, user_id, full_name, email, phone, 
        role, permissions, is_active, created_at
    ) VALUES (
        v_admin_id, v_user_id, v_name, v_email, v_phone,
        'super_admin', 
        '{"all": true}'::json, -- Full permissions
        true, 
        NOW()
    );

    RAISE NOTICE 'Admin created successfully!';
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE 'Admin ID: %', v_admin_id;
END $$;-- ========================================
-- SEED DATA: Reference Tables
-- Initial data for lookup/reference tables
-- ========================================

-- Species
INSERT INTO species_ref (species_code, species_name, icon_url, is_active) VALUES
('dog', 'Dog', '/icons/dog.svg', true),
('cat', 'Cat', '/icons/cat.svg', true);

-- Life Stages for Dogs
INSERT INTO life_stages_ref (species_id, life_stage_code, life_stage_name, min_age_months, max_age_months, description) VALUES
(1, 'puppy', 'Puppy (0-12 months)', 0, 12, 'Puppies require special care and training'),
(1, 'developing', 'Developing (1-2 years)', 13, 24, 'Young dogs are energetic and still learning'),
(1, 'adult', 'Adult (3-8 years)', 25, 96, 'Adult dogs are in their prime years'),
(1, 'senior', 'Senior (8+ years)', 97, NULL, 'Senior dogs need extra care and monitoring');

-- Life Stages for Cats
INSERT INTO life_stages_ref (species_id, life_stage_code, life_stage_name, min_age_months, max_age_months, description) VALUES
(2, 'kitten', 'Kitten (0-12 months)', 0, 12, 'Kittens are playful and curious'),
(2, 'young_adult', 'Young Adult (1-3 years)', 13, 36, 'Young cats are active and independent'),
(2, 'adult_cat', 'Adult (3-10 years)', 37, 120, 'Adult cats are settled and mature'),
(2, 'senior_cat', 'Senior (10+ years)', 121, NULL, 'Senior cats need gentle care');

-- Subscription Tiers
INSERT INTO subscription_tiers_ref (tier_code, tier_name, tier_description, marketing_tagline, base_price, display_order, color_hex, is_active) VALUES
('basic', 'Basic Care', 'Essential pet care services', 'Start your journey', 499.00, 1, '#3B82F6', true),
('plus', 'Plus Care', 'Enhanced protection and perks', 'Step up the care', 1999.00, 2, '#8B5CF6', true),
('eternal', 'Eternal Care', 'Premium all-inclusive care', 'The ultimate love', 3999.00, 3, '#F59E0B', true)
ON CONFLICT (tier_code) DO NOTHING;

-- Service Categories
INSERT INTO service_categories_ref (category_id, category_code, category_name, description, display_order, is_active) VALUES
(1, 'grooming', 'Grooming Services', 'Professional pet grooming and hygiene', 1, true),
(2, 'vet_consult', 'Veterinary Care', 'Health checkups and medical services', 2, true),
(3, 'training', 'Training', 'Behavioral training and obedience', 3, true),
(4, 'boarding', 'Boarding & Daycare', 'Pet boarding and daycare services', 4, true),
(5, 'walking', 'Walking & Exercise', 'Daily walks and exercise routines', 5, true),
(6, 'nutrition', 'Nutrition Consulting', 'Diet planning and nutrition advice', 6, true)
ON CONFLICT (category_code) DO NOTHING;

-- Booking Statuses
INSERT INTO booking_statuses_ref (status_code, status_name, status_type, display_color, allow_cancellation, allow_reschedule) VALUES
('pending', 'Pending', 'active', '#FCD34D', true, true),
('confirmed', 'Confirmed', 'active', '#60A5FA', true, true),
('assigned', 'Assigned to Caregiver', 'active', '#A78BFA', true, true),
('in_progress', 'In Progress', 'active', '#34D399', false, false),
('completed', 'Completed', 'completed', '#10B981', false, false),
('cancelled', 'Cancelled', 'cancelled', '#EF4444', false, false),
('rescheduled', 'Rescheduled', 'active', '#F59E0B', true, true),
('no_show', 'No Show', 'cancelled', '#6B7280', false, false);

-- Location Types
INSERT INTO location_types_ref (type_code, type_name, description, is_active) VALUES
('doorstep', 'At Your Doorstep', 'Service provided at customer location', true),
('care_van', 'Care Van Visit', 'Mobile care unit visits your location', true),
('clinic', 'At Our Clinic', 'Visit our facility for service', true);

-- User Roles
INSERT INTO user_roles_ref (role_code, role_name, permissions, is_active) VALUES
('customer', 'Customer', '{"can_book": true, "can_rate": true, "can_manage_pets": true}', true),
('caregiver', 'Caregiver', '{"can_accept_bookings": true, "can_update_status": true, "can_view_schedule": true}', true),
('care_manager', 'Care Manager', '{"can_manage_customers": true, "can_create_care_plans": true, "can_schedule_checkins": true}', true),
('admin', 'Admin', '{"full_access": true}', true),
('super_admin', 'Super Admin', '{"full_access": true, "can_manage_admins": true}', true);

-- Gender
INSERT INTO gender_ref (gender_code, gender_name) VALUES
('male', 'Male'),
('female', 'Female'),
('unknown', 'Unknown');

-- Billing Cycles
INSERT INTO billing_cycles_ref (cycle_code, cycle_name, months, discount_percentage) VALUES
('monthly', 'Monthly', 1, 0),
('quarterly', 'Quarterly', 3, 5.00),
('annual', 'Annual', 12, 15.00);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Reference data seeded successfully';
    RAISE NOTICE 'Species: 2, Life Stages: 8, Tiers: 3, Categories: 6';
END $$;-- ========================================
-- SEED DATA: Initial Configuration
-- App settings and system configuration
-- ========================================

-- App Settings
INSERT INTO app_settings (setting_key, setting_value, setting_type, category, description, is_public) VALUES
('app_name', 'Tails & Tales', 'string', 'general', 'Application name', true),
('app_version', '1.0.0', 'string', 'general', 'Current app version', true),
('support_email', 'support@tailsandtales.com', 'string', 'general', 'Customer support email', true),
('support_phone', '+91-1234567890', 'string', 'general', 'Customer support phone', true),
('currency', 'INR', 'string', 'payment', 'Default currency', true),
('tax_percentage', '18.00', 'number', 'payment', 'GST/Tax percentage', false),
('booking_cancellation_hours', '24', 'number', 'business_rules', 'Hours before booking to allow cancellation', false),
('max_reschedule_count', '2', 'number', 'business_rules', 'Maximum reschedule attempts per booking', false),
('referral_bonus_amount', '500', 'number', 'business_rules', 'Referral bonus amount', false),
('min_order_value', '299', 'number', 'business_rules', 'Minimum order value', false);

-- Location Types (if not already added in reference data)
INSERT INTO location_types_ref (type_code, type_name, description, is_active) 
VALUES ('clinic', 'At Our Clinic', 'Visit our facility for service', true)
ON CONFLICT (type_code) DO NOTHING;

-- Sample service catalog entries
INSERT INTO service_catalog (service_name, category_id, description, base_price, duration_minutes, is_doorstep, is_active) VALUES
('Basic Bath & Brush', (SELECT category_id FROM service_categories_ref WHERE category_code = 'grooming'), 'Complete bath with premium shampoo and brush', 599.00, 60, true, true),
('Premium Grooming Package', (SELECT category_id FROM service_categories_ref WHERE category_code = 'grooming'), 'Bath, haircut, nail trim, ear cleaning', 1299.00, 90, true, true),
('Health Checkup', (SELECT category_id FROM service_categories_ref WHERE category_code = 'vet'), 'Complete health examination by certified vet', 799.00, 45, true, true),
('Vaccination Service', (SELECT category_id FROM service_categories_ref WHERE category_code = 'vet'), 'Vaccination administration with certificate', 499.00, 30, true, true),
('Basic Obedience Training', (SELECT category_id FROM service_categories_ref WHERE category_code = 'training'), '5-session basic training package', 2999.00, 60, true, true),
('Daily Walk (30 min)', (SELECT category_id FROM service_categories_ref WHERE category_code = 'walking'), '30-minute daily exercise walk', 299.00, 30, true, true),
('Pet Daycare (Full Day)', (SELECT category_id FROM service_categories_ref WHERE category_code = 'boarding'), 'Full day care with activities', 999.00, 480, false, true),
('Nutrition Consultation', (SELECT category_id FROM service_categories_ref WHERE category_code = 'nutrition'), 'Personalized diet plan', 699.00, 45, false, true);

-- Notification Templates
INSERT INTO notification_templates (template_code, template_name, notification_type, delivery_method, subject, body_template, variables, is_active) VALUES
('booking_confirmed', 'Booking Confirmation', 'booking_confirmation', 'sms', 'Booking Confirmed', 
'Hi {{user_name}}, your booking #{{booking_number}} for {{service_name}} on {{booking_date}} at {{booking_time}} has been confirmed. Pet: {{pet_name}}', 
'["user_name", "booking_number", "service_name", "booking_date", "booking_time", "pet_name"]'::json, true),

('booking_reminder', 'Booking Reminder', 'booking_reminder', 'push', 'Upcoming Booking', 
'Reminder: {{service_name}} for {{pet_name}} tomorrow at {{booking_time}}. Our caregiver will arrive at your doorstep!', 
'["service_name", "pet_name", "booking_time"]'::json, true),

('vaccination_due', 'Vaccination Due', 'health_reminder', 'push', 'Vaccination Due', 
'{{pet_name}}''s {{vaccine_name}} vaccination is due on {{due_date}}. Book now to keep {{pet_name}} protected!', 
'["pet_name", "vaccine_name", "due_date"]'::json, true),

('payment_success', 'Payment Success', 'payment_alert', 'email', 'Payment Received', 
'Thank you {{user_name}}! We have received your payment of ₹{{amount}} for {{description}}. Invoice: {{invoice_number}}', 
'["user_name", "amount", "description", "invoice_number"]'::json, true),

('subscription_renewal', 'Subscription Renewal', 'subscription_update', 'email', 'Subscription Renewal', 
'Hi {{user_name}}, your {{tier_name}} subscription for {{pet_name}} will renew on {{renewal_date}}. Amount: ₹{{amount}}', 
'["user_name", "tier_name", "pet_name", "renewal_date", "amount"]'::json, true);

-- Comprehensive Subscription Tier Configuration (Applies to ALL Species & Life Stages)

-- 1. Basic Tier (Tier 1): 1 Vet Consult (Cat 2) per month
INSERT INTO subscription_tiers_config (tier_id, species_id, life_stage_id, category_id, quota_monthly, quota_annual, is_included)
SELECT 
    1, s.species_id, ls.life_stage_id, 2, 1, 12, true
FROM species_ref s
JOIN life_stages_ref ls ON s.species_id = ls.species_id
ON CONFLICT DO NOTHING;

-- 2. Plus Tier (Tier 2): 1 Grooming (Cat 1), 2 Vet Consults (Cat 2)
INSERT INTO subscription_tiers_config (tier_id, species_id, life_stage_id, category_id, quota_monthly, quota_annual, is_included)
SELECT 2, s.species_id, ls.life_stage_id, 1, 1, 12, true
FROM species_ref s JOIN life_stages_ref ls ON s.species_id = ls.species_id
ON CONFLICT DO NOTHING;

INSERT INTO subscription_tiers_config (tier_id, species_id, life_stage_id, category_id, quota_monthly, quota_annual, is_included)
SELECT 2, s.species_id, ls.life_stage_id, 2, 2, 24, true
FROM species_ref s JOIN life_stages_ref ls ON s.species_id = ls.species_id
ON CONFLICT DO NOTHING;

-- 3. Eternal Tier (Tier 3): Unlimited Vet (Cat 2), 2 Grooming (Cat 1), 1 Vaccination (Cat 6 - assumes ID from expansion) or from db diagram logic. 
-- Note: In previous step expansion, Vaccination was Cat 3. In 001 seeds, it matches logic.
-- Let's stick to the expanded logic: Cat 2 (Vet), Cat 1 (Grooming).
-- Unlimited Vet:
INSERT INTO subscription_tiers_config (tier_id, species_id, life_stage_id, category_id, quota_monthly, quota_annual, is_included)
SELECT 3, s.species_id, ls.life_stage_id, 2, NULL, NULL, true
FROM species_ref s JOIN life_stages_ref ls ON s.species_id = ls.species_id
ON CONFLICT DO NOTHING;

-- 2 Grooming:
INSERT INTO subscription_tiers_config (tier_id, species_id, life_stage_id, category_id, quota_monthly, quota_annual, is_included)
SELECT 3, s.species_id, ls.life_stage_id, 1, 2, 24, true
FROM species_ref s JOIN life_stages_ref ls ON s.species_id = ls.species_id
ON CONFLICT DO NOTHING;


-- Fair Usage Policies for Eternal tier
INSERT INTO fair_usage_policies (tier_id, category_id, max_usage_per_month, max_usage_per_week, max_usage_per_day, cooldown_period_days, abuse_threshold, abuse_action, description) VALUES
(3, 1, 8, 2, NULL, 7, 10, 'manual_review', 'Unlimited grooming with fair usage: max 8/month, 2/week, 7 days between bookings'),
(3, 2, 4, 1, NULL, 14, 6, 'manual_review', 'Unlimited vet visits: max 4/month, 1/week, 14 days between (unless emergency)'),
(3, 5, NULL, NULL, 1, NULL, 3, 'warn', 'Daily walks: max 1/day'),
(3, 4, 4, 1, NULL, NULL, 5, 'manual_review', 'Boarding: max 4 times/month, 1 week between bookings')
ON CONFLICT DO NOTHING;

-- Promo Codes
INSERT INTO promo_codes (promo_code, promo_name, description, discount_type, discount_value, max_discount_amount, min_purchase_amount, applicable_to, max_uses_total, max_uses_per_user, valid_from, valid_until, is_active) VALUES
('WELCOME50', 'Welcome Discount', 'New user welcome offer', 'percentage', 50.00, 500.00, 299.00, 'all', 1000, 1, CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', true),
('PAWFECT20', 'Monthly Special', '20% off on all services', 'percentage', 20.00, 300.00, 500.00, 'service', 500, 3, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', true),
('FIRSTSUB100', 'First Subscription Discount', '₹100 off on first subscription', 'fixed_amount', 100.00, NULL, 999.00, 'subscription', NULL, 1, CURRENT_DATE, CURRENT_DATE + INTERVAL '180 days', true),
('SUMMER2024', 'Summer Sale', 'Hot summer deals', 'percentage', 20.00, 1000.00, 0, 'all', 1000, 1, NOW(), NOW() + INTERVAL '3 months', true)
ON CONFLICT (promo_code) DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE 'Initial configuration seeded successfully';
    RAISE NOTICE 'Services: 8, Templates: 5, Promo Codes: 3';
END $$;