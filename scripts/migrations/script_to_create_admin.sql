DO $$
DECLARE
    -- REPLACE THESE VALUES
    v_phone TEXT := '+918055321309';
    v_email TEXT := 'admin@tailsandtales.com';
    v_name  TEXT := 'System Admin';
    
    -- Variables for IDs
    v_user_id UUID := gen_random_uuid();
    v_admin_id UUID := gen_random_uuid();
    v_role_id SMALLINT;
BEGIN
    -- 1. Get the Role ID for 'super_admin' (or 'admin')
    SELECT role_id INTO v_role_id 
    FROM user_roles_ref 
    WHERE role_code = 'super_admin';

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role super_admin not found in user_roles_ref';
    END IF;

    -- 2. Create the User record
    INSERT INTO users (
        user_id, phone, email, full_name, role_id, status, created_at, updated_at
    ) VALUES (
        v_user_id, v_phone, v_email, v_name, v_role_id, 'active', NOW(), NOW()
    );

    -- 3. Create the Admin Profile
    INSERT INTO admin_users (
        admin_id, user_id, full_name, email, phone, 
        role, permissions, is_active, created_at
    ) VALUES (
        v_admin_id, v_user_id, v_name, v_email, v_phone,
        'super_admin', 
        '{"all": true}'::json, -- Full permissions
        true, 
        NOW()
    );

    RAISE NOTICE 'Admin created successfully!';
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE 'Admin ID: %', v_admin_id;
END $$;