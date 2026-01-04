-- ========================================
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

