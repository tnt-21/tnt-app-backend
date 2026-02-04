-- ========================================
-- MIGRATION 019: SERVICE REQUEST QUEUE & OPTIMIZATION
-- Supply-side optimization with urgency scoring
-- ========================================

-- 1. Service Requests Table (Request Queue)
CREATE TABLE IF NOT EXISTS service_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core References
    user_id UUID NOT NULL REFERENCES users(user_id),
    pet_id UUID NOT NULL REFERENCES pets(pet_id),
    service_id UUID NOT NULL REFERENCES service_catalog(service_id),
    address_id UUID NOT NULL REFERENCES user_addresses(address_id),
    subscription_id UUID REFERENCES subscriptions(subscription_id),
    
    -- Service Type
    service_type VARCHAR(50) NOT NULL, -- 'grooming', 'vet_visit'
    
    -- Location Data (denormalized for clustering performance)
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    address_line1 VARCHAR(255),
    city VARCHAR(100),
    pincode VARCHAR(10),
    
    -- Priority & Urgency
    priority SMALLINT NOT NULL DEFAULT 3, -- 1=Eternal, 2=Plus, 3=Basic
    urgency_score DECIMAL(5,2) DEFAULT 0, -- calculated: days_overdue / ideal_interval * tier_multiplier
    last_service_date DATE, -- last time this pet received this service
    days_since_last_service INT, -- calculated field for transparency
    
    -- Status Tracking
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, scheduled, confirmed, customer_rejected, completed, cancelled
    
    -- Assignment Data (filled by optimizer)
    assigned_date DATE,
    assigned_time TIME,
    assigned_schedule_id UUID REFERENCES van_schedules(schedule_id),
    route_sequence INT, -- position in route
    estimated_arrival_time TIME,
    estimated_departure_time TIME,
    
    -- Customer Response Tracking
    notification_sent_at TIMESTAMP,
    customer_response_deadline TIMESTAMP, -- 24 hours from notification
    customer_responded_at TIMESTAMP,
    customer_response VARCHAR(20), -- 'accepted', 'rejected', 'requested_alternative'
    rejection_count INT DEFAULT 0, -- track how many times customer rejected
    
    -- Metadata
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'scheduled', 'confirmed', 'customer_rejected', 'completed', 'cancelled')),
    CONSTRAINT valid_priority CHECK (priority BETWEEN 1 AND 3),
    CONSTRAINT valid_response CHECK (customer_response IS NULL OR customer_response IN ('accepted', 'rejected', 'requested_alternative'))
);

-- 2. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_service_requests_optimization 
ON service_requests(status, urgency_score DESC, created_at) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_service_requests_location 
ON service_requests(latitude, longitude) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_service_requests_user 
ON service_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_service_requests_pet 
ON service_requests(pet_id, service_type);

CREATE INDEX IF NOT EXISTS idx_service_requests_schedule 
ON service_requests(assigned_schedule_id, route_sequence) 
WHERE assigned_schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_requests_response_deadline 
ON service_requests(customer_response_deadline) 
WHERE status = 'scheduled' AND customer_response IS NULL;

-- 3. Enhance Vans Table
ALTER TABLE vans ADD COLUMN IF NOT EXISTS zone VARCHAR(100) DEFAULT 'Pune Central';
ALTER TABLE vans ADD COLUMN IF NOT EXISTS start_location_lat DECIMAL(10,8) DEFAULT 18.5314;
ALTER TABLE vans ADD COLUMN IF NOT EXISTS start_location_lng DECIMAL(11,8) DEFAULT 73.8446;
ALTER TABLE vans ADD COLUMN IF NOT EXISTS max_stops_per_day INT DEFAULT 6;

-- 4. Route Optimization Metrics Table
CREATE TABLE IF NOT EXISTS route_optimization_metrics (
    metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES van_schedules(schedule_id),
    total_stops INT NOT NULL,
    total_distance_km DECIMAL(10,2),
    total_duration_minutes INT,
    efficiency_score DECIMAL(5,2),
    pending_requests_count INT,
    assigned_requests_count INT,
    high_urgency_assigned INT,
    algorithm_used VARCHAR(50),
    clustering_method VARCHAR(50),
    optimization_time_ms INT,
    optimized_at TIMESTAMP DEFAULT NOW(),
    optimized_by UUID REFERENCES users(user_id),
    notes TEXT
);

-- 5. Triggers for Auto-Calculation
CREATE OR REPLACE FUNCTION update_service_request_urgency()
RETURNS TRIGGER AS $$
DECLARE
    tier_multiplier DECIMAL(3,2);
    ideal_interval INT;
    days_overdue INT;
BEGIN
    tier_multiplier := CASE NEW.priority
        WHEN 1 THEN 1.5  -- Eternal
        WHEN 2 THEN 1.2  -- Plus
        ELSE 1.0         -- Basic
    END;
    
    ideal_interval := CASE NEW.service_type
        WHEN 'grooming' THEN 30
        WHEN 'vet_visit' THEN 
            CASE NEW.priority
                WHEN 1 THEN 30
                WHEN 2 THEN 90
                ELSE 180
            END
        ELSE 30
    END;
    
    IF NEW.last_service_date IS NOT NULL THEN
        NEW.days_since_last_service := CURRENT_DATE - NEW.last_service_date;
        days_overdue := NEW.days_since_last_service;
    ELSE
        NEW.days_since_last_service := ideal_interval;
        days_overdue := ideal_interval;
    END IF;
    
    NEW.urgency_score := (days_overdue::DECIMAL / ideal_interval) * tier_multiplier;
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_service_request_urgency
    BEFORE INSERT OR UPDATE OF last_service_date, priority, service_type
    ON service_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_service_request_urgency();

CREATE OR REPLACE FUNCTION set_customer_response_deadline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'scheduled' AND OLD.status = 'pending' THEN
        NEW.notification_sent_at := NOW();
        NEW.customer_response_deadline := NOW() + INTERVAL '24 hours';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_response_deadline
    BEFORE UPDATE OF status
    ON service_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_customer_response_deadline();

DO $$
BEGIN
    RAISE NOTICE 'Migration 019: Service request queue system created successfully';
END $$;
