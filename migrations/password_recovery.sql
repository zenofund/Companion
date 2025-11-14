-- Password Recovery Schema Migration
-- Run this on your production database to enable password reset functionality

-- Add password reset token and expiry columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;

-- Create index on password_reset_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token 
ON users(password_reset_token) 
WHERE password_reset_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.password_reset_token IS 'Temporary token for password reset requests';
COMMENT ON COLUMN users.password_reset_expires IS 'Expiration timestamp for password reset token (1 hour from creation)';
