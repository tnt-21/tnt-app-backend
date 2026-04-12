-- ========================================
-- MIGRATION 022: PRODUCTS MANAGEMENT
-- Products catalog with S3 photo support
-- ========================================

CREATE TABLE IF NOT EXISTS products (
    product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    company_name VARCHAR(255),
    photo_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

COMMENT ON TABLE products IS 'Catalog of third-party products';

DO $$
BEGIN
    RAISE NOTICE 'Migration 022: Products table created successfully';
END $$;
