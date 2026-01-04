-- ========================================
-- SEED DATA: Initial Configuration
-- App settings and system configuration
-- ========================================

-- App Settings
INSERT INTO app_settings (setting_key, setting_value, setting_type, category, description, is_public) VALUES
('app_name', 'Tails & Tales', 'string', 'general', 'Application name', true),
('app_version', '1.0.0', 'string', 'general', 'Current app version', true),
('support_email', 'support@tailsandtales.com', 'string', 'general', 'Customer support email', true),
('support_phone', '+91-1234567890', 'string', 'general', 'Customer support phone', true),
('currency', 'INR', 'string', 'payment', 'Default currency', true),
('tax_percentage', '18.00', 'number', 'payment', 'GST/Tax percentage', false),
('booking_cancellation_hours', '24', 'number', 'business_rules', 'Hours before booking to allow cancellation', false),
('max_reschedule_count', '2', 'number', 'business_rules', 'Maximum reschedule attempts per booking', false),
('referral_bonus_amount', '500', 'number', 'business_rules', 'Referral bonus amount', false),
('min_order_value', '299', 'number', 'business_rules', 'Minimum order value', false);

-- Location Types (if not already added in reference data)
INSERT INTO location_types_ref (type_code, type_name, description, is_active) 
VALUES ('clinic', 'At Our Clinic', 'Visit our facility for service', true)
ON CONFLICT (type_code) DO NOTHING;

-- Sample service catalog entries
INSERT INTO service_catalog (service_name, category_id, description, base_price, duration_minutes, is_doorstep, is_active) VALUES
('Basic Bath & Brush', (SELECT category_id FROM service_categories_ref WHERE category_code = 'grooming'), 'Complete bath with premium shampoo and brush', 599.00, 60, true, true),
('Premium Grooming Package', (SELECT category_id FROM service_categories_ref WHERE category_code = 'grooming'), 'Bath, haircut, nail trim, ear cleaning', 1299.00, 90, true, true),
('Health Checkup', (SELECT category_id FROM service_categories_ref WHERE category_code = 'vet'), 'Complete health examination by certified vet', 799.00, 45, true, true),
('Vaccination Service', (SELECT category_id FROM service_categories_ref WHERE category_code = 'vet'), 'Vaccination administration with certificate', 499.00, 30, true, true),
('Basic Obedience Training', (SELECT category_id FROM service_categories_ref WHERE category_code = 'training'), '5-session basic training package', 2999.00, 60, true, true),
('Daily Walk (30 min)', (SELECT category_id FROM service_categories_ref WHERE category_code = 'walking'), '30-minute daily exercise walk', 299.00, 30, true, true),
('Pet Daycare (Full Day)', (SELECT category_id FROM service_categories_ref WHERE category_code = 'boarding'), 'Full day care with activities', 999.00, 480, false, true),
('Nutrition Consultation', (SELECT category_id FROM service_categories_ref WHERE category_code = 'nutrition'), 'Personalized diet plan', 699.00, 45, false, true);

-- Notification Templates
INSERT INTO notification_templates (template_code, template_name, notification_type, delivery_method, subject, body_template, variables, is_active) VALUES
('booking_confirmed', 'Booking Confirmation', 'booking_confirmation', 'sms', 'Booking Confirmed', 
'Hi {{user_name}}, your booking #{{booking_number}} for {{service_name}} on {{booking_date}} at {{booking_time}} has been confirmed. Pet: {{pet_name}}', 
'["user_name", "booking_number", "service_name", "booking_date", "booking_time", "pet_name"]'::json, true),

('booking_reminder', 'Booking Reminder', 'booking_reminder', 'push', 'Upcoming Booking', 
'Reminder: {{service_name}} for {{pet_name}} tomorrow at {{booking_time}}. Our caregiver will arrive at your doorstep!', 
'["service_name", "pet_name", "booking_time"]'::json, true),

('vaccination_due', 'Vaccination Due', 'health_reminder', 'push', 'Vaccination Due', 
'{{pet_name}}''s {{vaccine_name}} vaccination is due on {{due_date}}. Book now to keep {{pet_name}} protected!', 
'["pet_name", "vaccine_name", "due_date"]'::json, true),

('payment_success', 'Payment Success', 'payment_alert', 'email', 'Payment Received', 
'Thank you {{user_name}}! We have received your payment of ₹{{amount}} for {{description}}. Invoice: {{invoice_number}}', 
'["user_name", "amount", "description", "invoice_number"]'::json, true),

('subscription_renewal', 'Subscription Renewal', 'subscription_update', 'email', 'Subscription Renewal', 
'Hi {{user_name}}, your {{tier_name}} subscription for {{pet_name}} will renew on {{renewal_date}}. Amount: ₹{{amount}}', 
'["user_name", "tier_name", "pet_name", "renewal_date", "amount"]'::json, true);

-- Sample subscription tier configurations
INSERT INTO subscription_tiers_config (tier_id, life_stage_id, species_id, category_id, quota_monthly, is_included, priority_level) VALUES
-- Basic tier - Dog Puppy
(1, 1, 1, 1, 1, true, 1), -- Grooming: 1/month included
(1, 1, 1, 2, 1, true, 2), -- Vet: 1/month included
(1, 1, 1, 5, 4, true, 1), -- Walking: 4/month included

-- Plus tier - Dog Puppy  
(2, 1, 1, 1, 2, true, 2), -- Grooming: 2/month included
(2, 1, 1, 2, 2, true, 2), -- Vet: 2/month included
(2, 1, 1, 3, 1, true, 2), -- Training: 1/month included
(2, 1, 1, 5, 8, true, 2), -- Walking: 8/month included

-- Eternal tier - All unlimited (represented by NULL quota)
(3, 1, 1, 1, NULL, true, 3), -- Grooming: unlimited
(3, 1, 1, 2, NULL, true, 3), -- Vet: unlimited
(3, 1, 1, 3, NULL, true, 3), -- Training: unlimited
(3, 1, 1, 4, NULL, true, 3), -- Boarding: unlimited
(3, 1, 1, 5, NULL, true, 3), -- Walking: unlimited
(3, 1, 1, 6, NULL, true, 3); -- Nutrition: unlimited

-- Fair Usage Policies for Eternal tier
INSERT INTO fair_usage_policies (tier_id, category_id, max_usage_per_month, max_usage_per_week, max_usage_per_day, cooldown_period_days, abuse_threshold, abuse_action, description) VALUES
(3, 1, 8, 2, NULL, 7, 10, 'manual_review', 'Unlimited grooming with fair usage: max 8/month, 2/week, 7 days between bookings'),
(3, 2, 4, 1, NULL, 14, 6, 'manual_review', 'Unlimited vet visits: max 4/month, 1/week, 14 days between (unless emergency)'),
(3, 5, NULL, NULL, 1, NULL, 3, 'warn', 'Daily walks: max 1/day'),
(3, 4, 4, 1, NULL, NULL, 5, 'manual_review', 'Boarding: max 4 times/month, 1 week between bookings');

-- Sample promo codes
INSERT INTO promo_codes (promo_code, promo_name, description, discount_type, discount_value, max_discount_amount, min_purchase_amount, applicable_to, max_uses_total, max_uses_per_user, valid_from, valid_until, is_active) VALUES
('WELCOME50', 'Welcome Discount', 'New user welcome offer', 'percentage', 50.00, 500.00, 299.00, 'all', 1000, 1, CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', true),
('PAWFECT20', 'Monthly Special', '20% off on all services', 'percentage', 20.00, 300.00, 500.00, 'service', 500, 3, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', true),
('FIRSTSUB100', 'First Subscription Discount', '₹100 off on first subscription', 'fixed_amount', 100.00, NULL, 999.00, 'subscription', NULL, 1, CURRENT_DATE, CURRENT_DATE + INTERVAL '180 days', true);

DO $$
BEGIN
    RAISE NOTICE 'Initial configuration seeded successfully';
    RAISE NOTICE 'Services: 8, Templates: 5, Promo Codes: 3';
END $$;