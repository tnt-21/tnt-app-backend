-- =============================================
-- Migration: Create attachments table for S3 tracking
-- Description: Tracks all S3 uploads to identify and clean up orphan files.
-- =============================================

CREATE TABLE IF NOT EXISTS attachments (
    attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    s3_key VARCHAR(500) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    size BIGINT,
    mimetype VARCHAR(100),
    is_permanent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for cleanup job
CREATE INDEX IF NOT EXISTS idx_attachments_permanent_created ON attachments (is_permanent, created_at) WHERE is_permanent = FALSE;

-- Index for searching by URL (used when marking as permanent)
CREATE INDEX IF NOT EXISTS idx_attachments_url ON attachments (url);

COMMENT ON TABLE attachments IS 'Tracks all uploaded files in S3. Files not marked as permanent within 24h are deleted by cleanup cron.';
