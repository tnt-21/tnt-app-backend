-- ========================================
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
END $$;