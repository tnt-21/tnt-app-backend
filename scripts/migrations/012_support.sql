-- ========================================
-- MIGRATION 012: SUPPORT & ADMIN
-- Support tickets, admin users, audit logs
-- ========================================

CREATE TABLE IF NOT EXISTS admin_users (
    admin_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15),
    photo_url VARCHAR(500),
    role VARCHAR(50),
    department VARCHAR(50),
    permissions JSON,
    can_access_finance BOOLEAN DEFAULT FALSE,
    can_manage_users BOOLEAN DEFAULT FALSE,
    can_manage_caregivers BOOLEAN DEFAULT FALSE,
    can_manage_content BOOLEAN DEFAULT FALSE,
    reporting_to UUID REFERENCES admin_users(admin_id),
    is_active BOOLEAN DEFAULT TRUE,
    joined_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_user ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_active ON admin_users(is_active);

COMMENT ON TABLE admin_users IS 'Admin/staff user accounts';

CREATE TABLE IF NOT EXISTS support_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(user_id),
    booking_id UUID REFERENCES bookings(booking_id),
    subscription_id UUID REFERENCES subscriptions(subscription_id),
    pet_id UUID REFERENCES pets(pet_id),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50),
    subcategory VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    channel VARCHAR(20),
    assigned_to UUID REFERENCES admin_users(admin_id),
    assigned_at TIMESTAMP,
    first_response_at TIMESTAMP,
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP,
    resolution_notes TEXT,
    customer_satisfaction_rating INT,
    customer_feedback TEXT,
    attachments JSON,
    tags JSON,
    internal_notes TEXT,
    escalated BOOLEAN DEFAULT FALSE,
    escalated_to UUID REFERENCES admin_users(admin_id),
    escalated_at TIMESTAMP,
    sla_due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_ticket_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_ticket_status_priority ON support_tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_ticket_assigned ON support_tickets(assigned_to);

COMMENT ON TABLE support_tickets IS 'Customer support ticket management';

CREATE TABLE IF NOT EXISTS ticket_messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(ticket_id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(user_id),
    sender_type VARCHAR(20),
    message TEXT NOT NULL,
    attachments JSON,
    is_internal BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msg_ticket ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_msg_created ON ticket_messages(created_at);

COMMENT ON TABLE ticket_messages IS 'Ticket conversation threads';

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    admin_id UUID REFERENCES admin_users(admin_id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_value JSON,
    new_value JSON,
    changes_summary TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    geolocation JSON,
    request_method VARCHAR(10),
    request_url TEXT,
    response_status INT,
    severity VARCHAR(20) DEFAULT 'info',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity_combo ON audit_logs(entity_type, entity_id);

COMMENT ON TABLE audit_logs IS 'Complete audit trail of all system actions';

DO $$
BEGIN
    RAISE NOTICE 'Migration 012: Support and admin tables created successfully';
END $$;