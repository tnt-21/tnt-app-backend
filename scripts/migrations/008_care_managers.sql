-- ========================================
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
END $$;