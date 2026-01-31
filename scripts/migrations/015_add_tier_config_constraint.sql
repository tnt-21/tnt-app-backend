DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_tier_species_stage_category') THEN
        ALTER TABLE subscription_tiers_config
        ADD CONSTRAINT unique_tier_species_stage_category 
        UNIQUE (tier_id, species_id, life_stage_id, category_id);
    END IF;
END $$;
