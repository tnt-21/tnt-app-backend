-- ========================================
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
END $$;