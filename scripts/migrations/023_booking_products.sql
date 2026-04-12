-- ============================================
-- FILE: migrations/023_booking_products.sql
-- Create booking_products table
-- ============================================

CREATE TABLE IF NOT EXISTS booking_products (
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL,
    total_price NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (booking_id, product_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_booking_products_booking_id ON booking_products(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_products_product_id ON booking_products(product_id);
