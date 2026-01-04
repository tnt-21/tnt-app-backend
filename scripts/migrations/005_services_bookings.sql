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
END $$;