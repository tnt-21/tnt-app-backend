-- ========================================
-- MIGRATION 006: PAYMENT SYSTEM
-- Payment methods, invoices, payments, refunds
-- ========================================

CREATE TABLE IF NOT EXISTS payment_methods (
    method_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    method_type VARCHAR(30),
    provider VARCHAR(50),
    token VARCHAR(500),
    card_brand VARCHAR(30),
    last_four VARCHAR(4),
    expiry_month VARCHAR(2),
    expiry_year VARCHAR(4),
    cardholder_name VARCHAR(255),
    billing_address_id UUID REFERENCES user_addresses(address_id),
    is_default BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_method_user_default ON payment_methods(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_payment_method_user ON payment_methods(user_id);

COMMENT ON TABLE payment_methods IS 'Saved payment methods for users';

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    subscription_id UUID REFERENCES subscriptions(subscription_id),
    booking_id UUID REFERENCES bookings(booking_id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_type VARCHAR(30),
    subtotal DECIMAL(10,2) NOT NULL,
    tax_percentage DECIMAL(5,2) DEFAULT 18.00,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) NOT NULL,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP,
    payment_link VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_sub ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoice_booking ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status_due ON invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON invoices(status);

COMMENT ON TABLE invoices IS 'Financial invoices for all transactions';

CREATE TABLE IF NOT EXISTS invoice_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    item_type VARCHAR(50),
    description VARCHAR(255) NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    tax_applicable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_item_invoice ON invoice_line_items(invoice_id);

COMMENT ON TABLE invoice_line_items IS 'Itemized breakdown of invoices';

CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    payment_method_id UUID REFERENCES payment_methods(method_id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) NOT NULL,
    payment_gateway VARCHAR(50),
    transaction_id VARCHAR(255) UNIQUE,
    gateway_order_id VARCHAR(255),
    gateway_response JSON,
    failure_reason TEXT,
    payment_method_used VARCHAR(50),
    payment_date TIMESTAMP,
    retry_count INT DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_txn ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_date ON payments(payment_date);

COMMENT ON TABLE payments IS 'Payment transaction records';

CREATE TABLE IF NOT EXISTS refunds (
    refund_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(payment_id),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id),
    booking_id UUID REFERENCES bookings(booking_id),
    refund_amount DECIMAL(10,2) NOT NULL,
    refund_type VARCHAR(30),
    reason VARCHAR(255),
    detailed_reason TEXT,
    status VARCHAR(20),
    refund_method VARCHAR(30),
    refund_transaction_id VARCHAR(255),
    gateway_refund_id VARCHAR(255),
    processing_fee DECIMAL(10,2) DEFAULT 0,
    net_refund_amount DECIMAL(10,2),
    processed_at TIMESTAMP,
    expected_date DATE,
    requested_by UUID NOT NULL REFERENCES users(user_id),
    approved_by UUID REFERENCES users(user_id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refund_invoice ON refunds(invoice_id);
CREATE INDEX IF NOT EXISTS idx_refund_booking ON refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refund_status ON refunds(status);

COMMENT ON TABLE refunds IS 'Refund requests and processing';

DO $$
BEGIN
    RAISE NOTICE 'Migration 006: Payment tables created successfully';
END $$;