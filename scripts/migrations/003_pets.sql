-- ========================================
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
END $$;