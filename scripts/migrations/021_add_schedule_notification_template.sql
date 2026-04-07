-- ============================================
-- Migration: Add Schedule Confirmation Template
-- ============================================

INSERT INTO notification_templates (
    template_id,
    template_code,
    template_name,
    notification_type,
    delivery_method,
    subject,
    body_template,
    variables,
    is_active
) VALUES (
    'f3b4d2e1-a0c1-4d3e-b2e5-f4a6b7c8d9e0',
    'schedule_confirmation',
    'Schedule Confirmation',
    'booking_confirmation',
    'push',
    'Appointment Scheduled 🐾',
    'Hi {{user_name}}, your {{service_name}} for {{pet_name}} has been scheduled for {{date}} at {{time}}. Please confirm or reschedule in the app.',
    '["user_name", "service_name", "pet_name", "date", "time", "request_id"]',
    true
) ON CONFLICT (template_code) DO UPDATE 
SET body_template = EXCLUDED.body_template,
    subject = EXCLUDED.subject,
    variables = EXCLUDED.variables;
