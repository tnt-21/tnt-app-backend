-- ========================================
-- MIGRATION 017: ENHANCE SERVICE CONFIG
-- Relax eligibility constraints & add location slots
-- ========================================

-- 1. Relax Service Eligibility Constraints (Wildcards)
ALTER TABLE service_eligibility_config 
ALTER COLUMN species_id DROP NOT NULL;

ALTER TABLE service_eligibility_config 
ALTER COLUMN life_stage_id DROP NOT NULL;

-- 2. Add Location-Based Availability
ALTER TABLE service_availability 
ADD COLUMN pincode VARCHAR(10);

-- 3. Index for Location lookups
CREATE INDEX IF NOT EXISTS idx_avail_service_pincode 
ON service_availability(service_id, pincode);

DO $$
BEGIN
    RAISE NOTICE 'Migration 017: Service configuration enhanced successfully';
END $$;
