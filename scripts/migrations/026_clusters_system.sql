-- ========================================
-- MIGRATION 026: CLUSTER BASED SCHEDULING
-- Replaces Van-based scheduling with Zone-based Clusters
-- ========================================

-- 1. Create service_clusters table
CREATE TABLE IF NOT EXISTS service_clusters (
    cluster_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(10) NOT NULL,
    cluster_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'full', 'completed'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clusters_zone_date ON service_clusters(zone, cluster_date);

COMMENT ON TABLE service_clusters IS 'Groups of up to 6 service requests per zone for a specific day';

-- 2. Add cluster_id to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES service_clusters(cluster_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_cluster ON bookings(cluster_id);

-- Optional: Since we are moving away from vans and schedules, we could drop them or leave them for historical reference.
-- For now we'll just deprecate them by ignoring them. If you prefer to drop, uncomment the following:
-- DROP TABLE IF EXISTS van_schedules CASCADE;
-- DROP TABLE IF EXISTS vans CASCADE;

DO $$
BEGIN
    RAISE NOTICE 'Migration 026: Clusters system implemented successfully';
END $$;
