-- Dispute Resolution Schema Migration
-- Run this on your production database to enable dispute resolution functionality

-- Add dispute tracking columns to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMP;

-- Add comment for documentation
COMMENT ON COLUMN bookings.dispute_reason IS 'Client-provided reason for disputing booking completion';
COMMENT ON COLUMN bookings.disputed_at IS 'Timestamp when dispute was created';
