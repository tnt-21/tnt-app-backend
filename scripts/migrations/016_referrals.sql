-- ========================================
-- MIGRATION 016: REFERRAL SYSTEM
-- User referral codes, tracking, and rewards
-- ========================================

-- 1. Add referral_code to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(15) UNIQUE;

-- 2. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- 3. Function to generate a random referral code
CREATE OR REPLACE FUNCTION generate_unique_referral_code() 
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    done BOOLEAN := FALSE;
BEGIN
    WHILE NOT done LOOP
        -- Generate a 8-character alphanumeric code
        new_code := upper(substring(md5(random()::text) from 1 for 8));
        
        -- Check for uniqueness
        IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = new_code) THEN
            done := TRUE;
        END IF;
    END LOOP;
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger to auto-assign referral code to new users
CREATE OR REPLACE FUNCTION trg_set_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_unique_referral_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON users;
CREATE TRIGGER trg_assign_referral_code
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_referral_code();

-- 5. Backfill existing users with referral codes
UPDATE users SET referral_code = generate_unique_referral_code() WHERE referral_code IS NULL;

-- 6. Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
    referral_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES users(user_id),
    referred_id UUID NOT NULL REFERENCES users(user_id) UNIQUE, -- One user can only be referred once
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, reward_issued
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

COMMENT ON TABLE referrals IS 'Tracks user-to-user referral relationships';

-- 7. Referral Rewards Table
CREATE TABLE IF NOT EXISTS referral_rewards (
    reward_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_id UUID NOT NULL REFERENCES referrals(referral_id),
    user_id UUID NOT NULL REFERENCES users(user_id), -- Receiver of the reward
    reward_type VARCHAR(30) NOT NULL, -- e.g., 'wallet_credit', 'subscription_discount', 'promo_code'
    reward_value DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending', -- pending, processed, failed
    promo_id UUID REFERENCES promo_codes(promo_id), -- If reward is a promo code
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ref_rewards_user ON referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_ref_rewards_status ON referral_rewards(status);

COMMENT ON TABLE referral_rewards IS 'Tracks rewards issued for successful referrals';

-- 8. Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 016: Referral system tables created successfully';
END $$;
