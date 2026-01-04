-- ========================================
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
END $$;