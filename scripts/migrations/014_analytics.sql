-- ========================================
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
END $$;