-- Migration: Make booking date and time nullable for admin scheduling
-- Date: 2026-02-13

DO $$
BEGIN
    -- Make booking_date nullable
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'booking_date' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE bookings ALTER COLUMN booking_date DROP NOT NULL;
        RAISE NOTICE 'Changed booking_date to nullable';
    END IF;

    -- Make booking_time nullable
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'booking_time' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE bookings ALTER COLUMN booking_time DROP NOT NULL;
        RAISE NOTICE 'Changed booking_time to nullable';
    END IF;

END $$;
