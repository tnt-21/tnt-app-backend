-- ========================================
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
END $$;