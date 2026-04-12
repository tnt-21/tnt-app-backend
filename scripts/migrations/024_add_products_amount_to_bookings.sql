-- ============================================
-- FILE: migrations/024_add_products_amount_to_bookings.sql
-- Add products_amount column to bookings table
-- ============================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS products_amount NUMERIC(15, 2) DEFAULT 0.00;
