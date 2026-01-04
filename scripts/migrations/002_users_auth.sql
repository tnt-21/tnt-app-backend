-- ========================================
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
    otp VARCHAR(6) NOT NULL,
    purpose VARCHAR(30) DEFAULT 'login',
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_created ON otp_verifications(phone, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);

COMMENT ON TABLE otp_verifications IS 'OTP verification for authentication';
COMMENT ON COLUMN otp_verifications.purpose IS 'login, registration, password_reset';

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
END $$;