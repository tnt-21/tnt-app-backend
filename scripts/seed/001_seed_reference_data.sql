-- ========================================
-- SEED DATA: Reference Tables
-- Initial data for lookup/reference tables
-- ========================================

-- Species
INSERT INTO species_ref (species_code, species_name, icon_url, is_active) VALUES
('dog', 'Dog', '/icons/dog.svg', true),
('cat', 'Cat', '/icons/cat.svg', true);

-- Life Stages for Dogs
INSERT INTO life_stages_ref (species_id, life_stage_code, life_stage_name, min_age_months, max_age_months, description) VALUES
(1, 'puppy', 'Puppy (0-12 months)', 0, 12, 'Puppies require special care and training'),
(1, 'developing', 'Developing (1-2 years)', 13, 24, 'Young dogs are energetic and still learning'),
(1, 'adult', 'Adult (3-8 years)', 25, 96, 'Adult dogs are in their prime years'),
(1, 'senior', 'Senior (8+ years)', 97, NULL, 'Senior dogs need extra care and monitoring');

-- Life Stages for Cats
INSERT INTO life_stages_ref (species_id, life_stage_code, life_stage_name, min_age_months, max_age_months, description) VALUES
(2, 'kitten', 'Kitten (0-12 months)', 0, 12, 'Kittens are playful and curious'),
(2, 'young_adult', 'Young Adult (1-3 years)', 13, 36, 'Young cats are active and independent'),
(2, 'adult_cat', 'Adult (3-10 years)', 37, 120, 'Adult cats are settled and mature'),
(2, 'senior_cat', 'Senior (10+ years)', 121, NULL, 'Senior cats need gentle care');

-- Subscription Tiers
INSERT INTO subscription_tiers_ref (tier_code, tier_name, tier_description, marketing_tagline, display_order, color_hex, is_active) VALUES
('basic', 'Basic Care', 'Essential pet care services', 'Everything your pet needs', 1, '#3B82F6', true),
('plus', 'Plus Care', 'Enhanced care with priority booking', 'Premium care for your furry friend', 2, '#8B5CF6', true),
('eternal', 'Eternal Care', 'Complete care with dedicated manager', 'Lifetime companion for your companion', 3, '#F59E0B', true);

-- Service Categories
INSERT INTO service_categories_ref (category_code, category_name, description, display_order, is_active) VALUES
('grooming', 'Grooming Services', 'Professional pet grooming and hygiene', 1, true),
('vet', 'Veterinary Care', 'Health checkups and medical services', 2, true),
('training', 'Training', 'Behavioral training and obedience', 3, true),
('boarding', 'Boarding & Daycare', 'Pet boarding and daycare services', 4, true),
('walking', 'Walking & Exercise', 'Daily walks and exercise routines', 5, true),
('nutrition', 'Nutrition Consulting', 'Diet planning and nutrition advice', 6, true);

-- Booking Statuses
INSERT INTO booking_statuses_ref (status_code, status_name, status_type, display_color, allow_cancellation, allow_reschedule) VALUES
('pending', 'Pending', 'active', '#FCD34D', true, true),
('confirmed', 'Confirmed', 'active', '#60A5FA', true, true),
('assigned', 'Assigned to Caregiver', 'active', '#A78BFA', true, true),
('in_progress', 'In Progress', 'active', '#34D399', false, false),
('completed', 'Completed', 'completed', '#10B981', false, false),
('cancelled', 'Cancelled', 'cancelled', '#EF4444', false, false),
('rescheduled', 'Rescheduled', 'active', '#F59E0B', true, true),
('no_show', 'No Show', 'cancelled', '#6B7280', false, false);

-- Location Types
INSERT INTO location_types_ref (type_code, type_name, description, is_active) VALUES
('doorstep', 'At Your Doorstep', 'Service provided at customer location', true),
('care_van', 'Care Van Visit', 'Mobile care unit visits your location', true),
('clinic', 'At Our Clinic', 'Visit our facility for service', true);

-- User Roles
INSERT INTO user_roles_ref (role_code, role_name, permissions, is_active) VALUES
('customer', 'Customer', '{"can_book": true, "can_rate": true, "can_manage_pets": true}', true),
('caregiver', 'Caregiver', '{"can_accept_bookings": true, "can_update_status": true, "can_view_schedule": true}', true),
('care_manager', 'Care Manager', '{"can_manage_customers": true, "can_create_care_plans": true, "can_schedule_checkins": true}', true),
('admin', 'Admin', '{"full_access": true}', true),
('super_admin', 'Super Admin', '{"full_access": true, "can_manage_admins": true}', true);

-- Gender
INSERT INTO gender_ref (gender_code, gender_name) VALUES
('male', 'Male'),
('female', 'Female'),
('unknown', 'Unknown');

-- Billing Cycles
INSERT INTO billing_cycles_ref (cycle_code, cycle_name, months, discount_percentage) VALUES
('monthly', 'Monthly', 1, 0),
('quarterly', 'Quarterly', 3, 5.00),
('annual', 'Annual', 12, 15.00);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Reference data seeded successfully';
    RAISE NOTICE 'Species: 2, Life Stages: 8, Tiers: 3, Categories: 6';
END $$;