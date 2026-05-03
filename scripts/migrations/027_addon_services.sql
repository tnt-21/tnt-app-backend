-- ============================================
-- Migration: 027_addon_services.sql
-- Create addon_services table and seed initial data
-- ============================================

CREATE TABLE IF NOT EXISTS addon_services (
    addon_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial addon services
INSERT INTO addon_services (name, category, price) VALUES
-- HEALTH & SKIN TREATMENTS
('Tick & Flea Treatment', 'HEALTH & SKIN TREATMENTS', 1000.00),
('Medicated Bath (anti-tick / anti-fungal / anti-bacterial)', 'HEALTH & SKIN TREATMENTS', 1000.00),
('Skin Infection Treatment (vet-advised)', 'HEALTH & SKIN TREATMENTS', 1000.00),
('Anti-dandruff Treatment', 'HEALTH & SKIN TREATMENTS', 1000.00),
('Hotspot / Itch Relief Care', 'HEALTH & SKIN TREATMENTS', 1000.00),

-- COAT & FUR MANAGEMENT
('De-shedding Treatment', 'COAT & FUR MANAGEMENT', 1000.00),
('De-matting (tangled fur removal)', 'COAT & FUR MANAGEMENT', 1000.00),
('Coat Conditioning / Fur Spa', 'COAT & FUR MANAGEMENT', 1000.00),
('Fur Trimming / Breed-Specific Styling (dogs)', 'COAT & FUR MANAGEMENT', 1000.00),
('Lion Cut / Full Body Trim', 'COAT & FUR MANAGEMENT', 1000.00),

-- PREMIUM / COMFORT SERVICES
('Aromatherapy Bath', 'PREMIUM / COMFORT SERVICES', 1000.00);
