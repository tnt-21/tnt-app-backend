-- ============================================
-- Add password_hash column to users table
-- For admin authentication
-- ============================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Update existing admin user if exists
-- Default password: admin123
UPDATE users 
SET password_hash = '$2a$10$YourHashedPasswordHere'
WHERE email = 'admin@tailsandtales.com' 
AND password_hash IS NULL;
