const { pool } = require("../config/database");
const { AppError } = require("../utils/response.util");
const { v4: uuidv4 } = require("uuid");
const paymentService = require("./payment.service");

class SubscriptionService {
  // ==================== BROWSE TIERS ====================

  async getTiers(speciesId = null, lifeStageId = null) {
    let query = `
      SELECT 
        t.tier_id,
        t.tier_code,
        t.tier_name,
        t.tier_description,
        t.marketing_tagline,
        t.display_order,
        t.icon_url,
        t.color_hex
      FROM subscription_tiers_ref t
      WHERE t.is_active = true
      ORDER BY t.display_order
    `;

    const tiers = await pool.query(query);

    // Get pricing for each tier
    const tiersWithPricing = await Promise.all(
      tiers.rows.map(async (tier) => {
        const pricingQuery = `
          SELECT 
            bc.billing_cycle_id,
            bc.cycle_code,
            bc.cycle_name,
            bc.months,
            bc.discount_percentage,
            CASE 
              WHEN bc.cycle_code = 'monthly' THEN t.base_price
              WHEN bc.cycle_code = 'annual' THEN t.base_price * 12
            END as base_price
          FROM billing_cycles_ref bc
          JOIN subscription_tiers_ref t ON t.tier_id = $1
          WHERE bc.cycle_code IN ('monthly', 'annual')
          ORDER BY bc.months
        `;

        const pricing = await pool.query(pricingQuery, [tier.tier_id]);

        return {
          ...tier,
          pricing_options: pricing.rows.map(p => ({
            ...p,
            final_price: p.base_price * (1 - p.discount_percentage / 100)
          }))
        };
      })
    );

    // Get features if species/life_stage provided
    if (speciesId && lifeStageId) {
      for (let tier of tiersWithPricing) {
        const featuresQuery = `
          SELECT 
            sc.category_name,
            sc.icon_url,
            stc.quota_monthly,
            stc.quota_annual,
            stc.is_included
          FROM subscription_tiers_config stc
          JOIN service_categories_ref sc ON stc.category_id = sc.category_id
          WHERE stc.tier_id = $1 
            AND stc.species_id = $2 
            AND stc.life_stage_id = $3
          ORDER BY sc.display_order
        `;

        const features = await pool.query(featuresQuery, [
          tier.tier_id,
          speciesId,
          lifeStageId
        ]);

        tier.features = features.rows;
      }
    }

    return tiersWithPricing;
  }

  async getTierDetails(tierId, speciesId, lifeStageId) {
    const tierQuery = `
      SELECT * FROM subscription_tiers_ref
      WHERE tier_id = $1 AND is_active = true
    `;

    const tier = await pool.query(tierQuery, [tierId]);

    if (tier.rows.length === 0) {
      throw new AppError("Tier not found", 404, "TIER_NOT_FOUND");
    }

    const tierData = tier.rows[0];

    // Get pricing
    const pricingQuery = `
      SELECT 
        bc.billing_cycle_id,
        bc.cycle_code,
        bc.cycle_name,
        bc.months,
        bc.discount_percentage,
        CASE 
          WHEN bc.cycle_code = 'monthly' THEN t.base_price
          WHEN bc.cycle_code = 'annual' THEN t.base_price * 12
        END as base_price
      FROM billing_cycles_ref bc
      CROSS JOIN subscription_tiers_ref t
      WHERE t.tier_id = $1
    `;

    const pricing = await pool.query(pricingQuery, [tierId]);

    tierData.pricing_options = pricing.rows.map(p => ({
      ...p,
      final_price: p.base_price * (1 - p.discount_percentage / 100)
    }));

    // Get features if provided
    if (speciesId && lifeStageId) {
      const featuresQuery = `
        SELECT 
          sc.category_id,
          sc.category_code,
          sc.category_name,
          sc.description,
          sc.icon_url,
          stc.quota_monthly,
          stc.quota_annual,
          stc.is_included,
          stc.features
        FROM subscription_tiers_config stc
        JOIN service_categories_ref sc ON stc.category_id = sc.category_id
        WHERE stc.tier_id = $1 
          AND stc.species_id = $2 
          AND stc.life_stage_id = $3
        ORDER BY sc.display_order
      `;

      const features = await pool.query(featuresQuery, [
        tierId,
        speciesId,
        lifeStageId
      ]);

      tierData.features = features.rows;
    }

    return tierData;
  }

  // ==================== ADMIN MANAGEMENT ====================

  async updateTier(tierId, updates) {
    const allowedFields = ['base_price', 'tier_name', 'tier_description', 'marketing_tagline', 'is_active'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new AppError('No valid fields to update', 400, 'INVALID_UPDATE_FIELDS');
    }

    const setClause = fields.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [tierId, ...fields.map(key => updates[key])];

    const query = `
      UPDATE subscription_tiers_ref 
      SET ${setClause}
      WHERE tier_id = $1
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError('Tier not found', 404, 'TIER_NOT_FOUND');
    }

    return result.rows[0];
  }

  async updateTierConfig(tierId, speciesId, lifeStageId, categoryId, config) {
    const { quota_monthly, quota_annual, is_included } = config;
    
    const query = `
      INSERT INTO subscription_tiers_config (
        tier_id, species_id, life_stage_id, category_id, 
        quota_monthly, quota_annual, is_included
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tier_id, species_id, life_stage_id, category_id)
      DO UPDATE SET
        quota_monthly = EXCLUDED.quota_monthly,
        quota_annual = EXCLUDED.quota_annual,
        is_included = EXCLUDED.is_included
      RETURNING *
    `;

    const result = await pool.query(query, [
      tierId, speciesId, lifeStageId, categoryId,
      quota_monthly, quota_annual, is_included
    ]);

    return result.rows[0];
  }

  async getTierConfigs(tierId) {
    const query = `
      SELECT 
        stc.*,
        sr.species_name,
        lsr.life_stage_name,
        sc.category_name
      FROM subscription_tiers_config stc
      JOIN species_ref sr ON stc.species_id = sr.species_id
      JOIN life_stages_ref lsr ON stc.life_stage_id = lsr.life_stage_id
      JOIN service_categories_ref sc ON stc.category_id = sc.category_id
      WHERE stc.tier_id = $1
      ORDER BY sr.species_name, lsr.life_stage_name, sc.category_name
    `;
    const result = await pool.query(query, [tierId]);
    return result.rows;
  }

  // ==================== GLOBAL ADMIN ACTIONS ====================

  async getAllSubscriptions(filters = {}) {
    let query = `
      SELECT 
        s.subscription_id,
        s.user_id,
        u.full_name as customer_name,
        u.phone as customer_phone,
        s.pet_id,
        p.name as pet_name,
        p.photo_url as pet_photo,
        sp.species_name,
        ls.life_stage_name,
        t.tier_name,
        t.tier_code,
        t.color_hex,
        bc.cycle_name,
        s.start_date,
        s.end_date,
        s.status,
        s.current_period_end,
        s.next_billing_date,
        s.final_price,
        s.created_at
      FROM subscriptions s
      JOIN users u ON s.user_id = u.user_id
      JOIN pets p ON s.pet_id = p.pet_id
      JOIN species_ref sp ON p.species_id = sp.species_id
      JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
      JOIN subscription_tiers_ref t ON s.tier_id = t.tier_id
      JOIN billing_cycles_ref bc ON s.billing_cycle_id = bc.billing_cycle_id
      WHERE 1=1
    `;

    const params = [];
    let paramIdx = 1;

    if (filters.status) {
      query += ` AND s.status = $${paramIdx++}`;
      params.push(filters.status);
    }

    if (filters.tierId) {
      query += ` AND s.tier_id = $${paramIdx++}`;
      params.push(filters.tierId);
    }

    if (filters.search) {
      query += ` AND (u.full_name ILIKE $${paramIdx} OR u.phone ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx})`;
      params.push(`%${filters.search}%`);
      paramIdx++;
    }

    query += ` ORDER BY s.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getFairUsagePolicies(tierId = null) {
    let query = `
      SELECT fup.*, t.tier_name, sc.category_name, sc.icon_url
      FROM fair_usage_policies fup
      JOIN subscription_tiers_ref t ON fup.tier_id = t.tier_id
      JOIN service_categories_ref sc ON fup.category_id = sc.category_id
      WHERE 1=1
    `;
    const params = [];
    if (tierId) {
      query += ` AND fup.tier_id = $1`;
      params.push(tierId);
    }
    query += ` ORDER BY t.display_order, sc.display_order`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async updateFairUsagePolicy(policyId, updates) {
    const allowedFields = [
      'max_usage_per_month', 'max_usage_per_week', 'max_usage_per_day',
      'cooldown_period_days', 'cooldown_period_hours', 'abuse_threshold',
      'abuse_action', 'is_active', 'description'
    ];
    
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    if (fields.length === 0) return null;

    const setClause = fields.map((key, idx) => `${key} = $${idx + 2}`).join(', ');
    const values = [policyId, ...fields.map(key => updates[key])];

    const result = await pool.query(`
      UPDATE fair_usage_policies
      SET ${setClause}, updated_at = NOW()
      WHERE policy_id = $1
      RETURNING *
    `, values);

    return result.rows[0];
  }

  async createFairUsagePolicy(data) {
    const { 
      tier_id, category_id, max_usage_per_month, max_usage_per_week, 
      max_usage_per_day, cooldown_period_days, cooldown_period_hours, 
      abuse_threshold, abuse_action, description 
    } = data;

    const result = await pool.query(`
      INSERT INTO fair_usage_policies (
        tier_id, category_id, max_usage_per_month, max_usage_per_week, 
        max_usage_per_day, cooldown_period_days, cooldown_period_hours, 
        abuse_threshold, abuse_action, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      tier_id, category_id, max_usage_per_month, max_usage_per_week, 
      max_usage_per_day, cooldown_period_days, cooldown_period_hours, 
      abuse_threshold, abuse_action, description
    ]);

    return result.rows[0];
  }

  // ==================== USER SUBSCRIPTIONS ====================

  async getUserSubscriptions(userId, status = null) {
    let query = `
      SELECT 
        s.subscription_id,
        s.pet_id,
        p.name as pet_name,
        p.photo_url as pet_photo,
        sp.species_name,
        ls.life_stage_name,
        t.tier_name,
        t.tier_code,
        t.color_hex,
        bc.cycle_name,
        s.start_date,
        s.end_date,
        s.current_period_start,
        s.current_period_end,
        s.next_billing_date,
        s.status,
        s.auto_renew,
        s.final_price,
        s.created_at
      FROM subscriptions s
      JOIN pets p ON s.pet_id = p.pet_id
      JOIN species_ref sp ON p.species_id = sp.species_id
      JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
      JOIN subscription_tiers_ref t ON s.tier_id = t.tier_id
      JOIN billing_cycles_ref bc ON s.billing_cycle_id = bc.billing_cycle_id
      WHERE s.user_id = $1
    `;

    const params = [userId];

    if (status) {
      query += ` AND s.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY s.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getSubscriptionById(subscriptionId, userId) {
    const query = `
      SELECT 
        s.*,
        p.name as pet_name,
        p.photo_url as pet_photo,
        sp.species_name,
        ls.life_stage_name,
        t.tier_name,
        t.tier_code,
        t.tier_description,
        t.color_hex,
        bc.cycle_name,
        bc.months
      FROM subscriptions s
      JOIN pets p ON s.pet_id = p.pet_id
      JOIN species_ref sp ON p.species_id = sp.species_id
      JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
      JOIN subscription_tiers_ref t ON s.tier_id = t.tier_id
      JOIN billing_cycles_ref bc ON s.billing_cycle_id = bc.billing_cycle_id
      WHERE s.subscription_id = $1 AND s.user_id = $2
    `;

    const result = await pool.query(query, [subscriptionId, userId]);

    if (result.rows.length === 0) {
      throw new AppError("Subscription not found", 404, "SUBSCRIPTION_NOT_FOUND");
    }

    return result.rows[0];
  }

  async getEntitlements(subscriptionId, userId) {
    // Verify ownership
    await this.getSubscriptionById(subscriptionId, userId);

    const query = `
      SELECT 
        e.entitlement_id,
        sc.category_name,
        sc.category_code,
        sc.icon_url,
        e.quota_total,
        e.quota_used,
        e.quota_remaining,
        e.reset_date,
        e.last_used_date
      FROM subscription_entitlements e
      JOIN service_categories_ref sc ON e.category_id = sc.category_id
      WHERE e.subscription_id = $1
      ORDER BY sc.display_order
    `;

    const result = await pool.query(query, [subscriptionId]);
    return result.rows;
  }

  // ==================== CREATE SUBSCRIPTION ====================

  async createSubscription(userId, data) {
    const { pet_id, tier_id, billing_cycle_id, promo_code } = data;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verify pet ownership
      const petCheck = await client.query(
        `SELECT p.*, sp.species_id, ls.life_stage_id 
         FROM pets p
         JOIN species_ref sp ON p.species_id = sp.species_id
         JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
         WHERE p.pet_id = $1 AND p.owner_id = $2 AND p.is_active = true`,
        [pet_id, userId]
      );

      if (petCheck.rows.length === 0) {
        throw new AppError("Pet not found", 404, "PET_NOT_FOUND");
      }

      const pet = petCheck.rows[0];

      // Check for existing active subscription
      const existingSubscription = await client.query(
        `SELECT subscription_id FROM subscriptions 
         WHERE pet_id = $1 AND status IN ('active', 'trial')`,
        [pet_id]
      );

      if (existingSubscription.rows.length > 0) {
        throw new AppError(
          "Pet already has an active subscription",
          409,
          "ACTIVE_SUBSCRIPTION_EXISTS"
        );
      }

      // Get pricing
      const pricing = await this.calculatePrice(
        tier_id,
        billing_cycle_id,
        promo_code,
        userId
      );

      // Get billing cycle details
      const billingCycle = await client.query(
        "SELECT * FROM billing_cycles_ref WHERE billing_cycle_id = $1",
        [billing_cycle_id]
      );

      const cycle = billingCycle.rows[0];

      // Calculate dates
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + cycle.months);

      const subscriptionId = uuidv4();

      // Create subscription
      const insertQuery = `
        INSERT INTO subscriptions (
          subscription_id, user_id, pet_id, tier_id, billing_cycle_id,
          start_date, end_date, current_period_start, current_period_end,
          next_billing_date, status, base_price, discount_applied,
          final_price, promo_code, auto_renew
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;

      const subscription = await client.query(insertQuery, [
        subscriptionId,
        userId,
        pet_id,
        tier_id,
        billing_cycle_id,
        startDate,
        endDate,
        startDate,
        endDate,
        endDate,
        "active",
        pricing.base_price,
        pricing.discount_amount,
        pricing.final_price,
        promo_code || null,
        true
      ]);

      // Initialize entitlements
      await this.initializeEntitlements(
        client,
        subscriptionId,
        tier_id,
        pet.species_id,
        pet.life_stage_id,
        billing_cycle_id,
        endDate
      );

      // Record promo code usage if applicable
      if (promo_code && pricing.promo_id) {
        await client.query(
          `INSERT INTO promo_code_usage (promo_id, user_id, subscription_id, discount_applied)
           VALUES ($1, $2, $3, $4)`,
          [pricing.promo_id, userId, subscriptionId, pricing.discount_amount]
        );

        // Update promo code usage count
        await client.query(
          "UPDATE promo_codes SET current_uses = current_uses + 1 WHERE promo_id = $1",
          [pricing.promo_id]
        );
      }

      // Create subscription history
      await client.query(
        `INSERT INTO subscription_history (
          subscription_id, action, new_tier_id, new_billing_cycle_id,
          new_price, performed_by, effective_date
        ) VALUES ($1, 'created', $2, $3, $4, $5, $6)`,
        [subscriptionId, tier_id, billing_cycle_id, pricing.final_price, userId, startDate]
      );

      // GENERATE INVOICE
      await paymentService.createInvoice({
        user_id: userId,
        subscription_id: subscriptionId,
        invoice_type: 'subscription',
        line_items: [
          {
            item_type: 'subscription',
            description: `${pricing.tier_name} Plan - ${cycle.cycle_name}`,
            quantity: 1,
            unit_price: parseFloat(pricing.base_price),
            tax_applicable: true
          }
        ],
        tax_percentage: 18,
        discount_amount: parseFloat(pricing.discount_amount),
        due_date: new Date() // Due immediately
      }, client);

      await client.query("COMMIT");

      return subscription.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async initializeEntitlements(client, subscriptionId, tierId, speciesId, lifeStageId, billingCycleId, resetDate) {
    // Get tier configuration
    const config = await client.query(
      `SELECT * FROM subscription_tiers_config
       WHERE tier_id = $1 AND species_id = $2 AND life_stage_id = $3`,
      [tierId, speciesId, lifeStageId]
    );

    // Determine quota based on billing cycle
    const isAnnual = billingCycleId === 2; // Assuming 2 is annual

    for (const item of config.rows) {
      if (item.is_included) {
        const quotaTotal = isAnnual ? item.quota_annual : item.quota_monthly;

        await client.query(
          `INSERT INTO subscription_entitlements (
            subscription_id, category_id, quota_total, quota_used,
            quota_remaining, reset_date
          ) VALUES ($1, $2, $3, 0, $4, $5)`,
          [subscriptionId, item.category_id, quotaTotal, quotaTotal, resetDate]
        );
      }
    }
  }

  // ==================== UPGRADE SUBSCRIPTION ====================

  async upgradeSubscription(subscriptionId, userId, newTierId, newBillingCycleId = null) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get current subscription
      const current = await this.getSubscriptionById(subscriptionId, userId);

      if (current.status !== "active") {
        throw new AppError(
          "Can only upgrade active subscriptions",
          400,
          "INVALID_SUBSCRIPTION_STATUS"
        );
      }

      // Validate upgrade (new tier must be higher)
      const tierComparison = await this.compareTiers(current.tier_id, newTierId);
      if (tierComparison <= 0) {
        throw new AppError(
          "New tier must be higher than current tier",
          400,
          "INVALID_UPGRADE"
        );
      }

      const billingCycleId = newBillingCycleId || current.billing_cycle_id;

      // Calculate prorated charge
      const proration = await this.calculateProration(
        subscriptionId,
        newTierId,
        billingCycleId
      );

      // Update subscription
      await client.query(
        `UPDATE subscriptions 
         SET tier_id = $1, billing_cycle_id = $2, base_price = $3,
             final_price = $4, updated_at = NOW()
         WHERE subscription_id = $5`,
        [newTierId, billingCycleId, proration.new_price, proration.new_price, subscriptionId]
      );

      // Reset entitlements with new tier quotas
      await client.query(
        "DELETE FROM subscription_entitlements WHERE subscription_id = $1",
        [subscriptionId]
      );

      const pet = await client.query(
        "SELECT species_id, life_stage_id FROM pets WHERE pet_id = $1",
        [current.pet_id]
      );

      await this.initializeEntitlements(
        client,
        subscriptionId,
        newTierId,
        pet.rows[0].species_id,
        pet.rows[0].life_stage_id,
        billingCycleId,
        current.current_period_end
      );

      // Record history
      await client.query(
        `INSERT INTO subscription_history (
          subscription_id, action, old_tier_id, new_tier_id,
          old_billing_cycle_id, new_billing_cycle_id,
          old_price, new_price, price_difference, prorated_amount,
          performed_by, effective_date
        ) VALUES ($1, 'upgraded', $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          subscriptionId,
          current.tier_id,
          newTierId,
          current.billing_cycle_id,
          billingCycleId,
          current.final_price,
          proration.new_price,
          proration.price_difference,
          proration.prorated_charge,
          userId
        ]
      );

      await client.query("COMMIT");

      return {
        subscription_id: subscriptionId,
        prorated_charge: proration.prorated_charge,
        new_price: proration.new_price,
        message: "Subscription upgraded successfully. Prorated amount will be charged."
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async compareTiers(currentTierId, newTierId) {
    const tierOrder = { 1: 1, 2: 2, 3: 3 }; // basic, plus, eternal
    return tierOrder[newTierId] - tierOrder[currentTierId];
  }

  async calculateProration(subscriptionId, newTierId, newBillingCycleId) {
    const subscription = await pool.query(
      "SELECT * FROM subscriptions WHERE subscription_id = $1",
      [subscriptionId]
    );

    const current = subscription.rows[0];

    // Calculate remaining days
    const now = new Date();
    const periodEnd = new Date(current.current_period_end);
    const remainingDays = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
    const totalDays = Math.ceil(
      (periodEnd - new Date(current.current_period_start)) / (1000 * 60 * 60 * 24)
    );

    // Get new pricing
    const newPrice = 1999.00; // Simplified - should calculate based on tier

    // Calculate prorated amounts
    const unusedAmount = (current.final_price * remainingDays) / totalDays;
    const newPeriodAmount = (newPrice * remainingDays) / totalDays;
    const proratedCharge = newPeriodAmount - unusedAmount;

    return {
      new_price: newPrice,
      prorated_charge: Math.max(0, proratedCharge),
      price_difference: newPrice - current.final_price,
      remaining_days: remainingDays
    };
  }

  // ==================== DOWNGRADE SUBSCRIPTION ====================

  async downgradeSubscription(subscriptionId, userId, newTierId, newBillingCycleId = null) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const current = await this.getSubscriptionById(subscriptionId, userId);

      if (current.status !== "active") {
        throw new AppError(
          "Can only downgrade active subscriptions",
          400,
          "INVALID_SUBSCRIPTION_STATUS"
        );
      }

      // Validate downgrade
      const tierComparison = await this.compareTiers(current.tier_id, newTierId);
      if (tierComparison >= 0) {
        throw new AppError(
          "New tier must be lower than current tier",
          400,
          "INVALID_DOWNGRADE"
        );
      }

      const billingCycleId = newBillingCycleId || current.billing_cycle_id;
      const newPrice = 999.00; // Simplified

      // Schedule downgrade for next billing cycle
      await client.query(
        `INSERT INTO subscription_history (
          subscription_id, action, old_tier_id, new_tier_id,
          old_billing_cycle_id, new_billing_cycle_id,
          old_price, new_price, performed_by, effective_date, notes
        ) VALUES ($1, 'downgraded', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          subscriptionId,
          current.tier_id,
          newTierId,
          current.billing_cycle_id,
          billingCycleId,
          current.final_price,
          newPrice,
          userId,
          current.next_billing_date,
          "Scheduled for next billing cycle"
        ]
      );

      await client.query("COMMIT");

      return {
        subscription_id: subscriptionId,
        effective_date: current.next_billing_date,
        new_price: newPrice,
        message: "Downgrade scheduled for next billing cycle"
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== PAUSE/RESUME ====================

  async pauseSubscription(subscriptionId, userId, reason, resumeDate) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const current = await this.getSubscriptionById(subscriptionId, userId);

      if (current.status !== "active") {
        throw new AppError(
          "Can only pause active subscriptions",
          400,
          "INVALID_SUBSCRIPTION_STATUS"
        );
      }

      // Validate resume date (max 3 months)
      const maxPauseDays = 90;
      const pauseDays = Math.ceil(
        (new Date(resumeDate) - new Date()) / (1000 * 60 * 60 * 24)
      );

      if (pauseDays > maxPauseDays) {
        throw new AppError(
          `Cannot pause for more than ${maxPauseDays} days`,
          400,
          "MAX_PAUSE_EXCEEDED"
        );
      }

      await client.query(
        `UPDATE subscriptions 
         SET status = 'paused', pause_reason = $1, paused_at = NOW(),
             resume_date = $2, updated_at = NOW()
         WHERE subscription_id = $3`,
        [reason, resumeDate, subscriptionId]
      );

      // Record history
      await client.query(
        `INSERT INTO subscription_history (
          subscription_id, action, performed_by, reason, effective_date
        ) VALUES ($1, 'paused', $2, $3, NOW())`,
        [subscriptionId, userId, reason]
      );

      await client.query("COMMIT");

      return await this.getSubscriptionById(subscriptionId, userId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async resumeSubscription(subscriptionId, userId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const current = await this.getSubscriptionById(subscriptionId, userId);

      if (current.status !== "paused") {
        throw new AppError(
          "Can only resume paused subscriptions",
          400,
          "INVALID_SUBSCRIPTION_STATUS"
        );
      }

      await client.query(
        `UPDATE subscriptions 
         SET status = 'active', resume_date = NULL, paused_at = NULL,
             pause_reason = NULL, updated_at = NOW()
         WHERE subscription_id = $1`,
        [subscriptionId]
      );

      // Record history
      await client.query(
        `INSERT INTO subscription_history (
          subscription_id, action, performed_by, effective_date
        ) VALUES ($1, 'resumed', $2, NOW())`,
        [subscriptionId, userId]
      );

      await client.query("COMMIT");

      return await this.getSubscriptionById(subscriptionId, userId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== CANCEL ====================

  async cancelSubscription(subscriptionId, userId, reason, immediate = false) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const current = await this.getSubscriptionById(subscriptionId, userId);

      if (!["active", "paused"].includes(current.status)) {
        throw new AppError(
          "Cannot cancel subscription in current status",
          400,
          "INVALID_SUBSCRIPTION_STATUS"
        );
      }

      let refundAmount = 0;
      let message = "Subscription cancelled";

      if (immediate) {
        // Calculate prorated refund
        const now = new Date();
        const periodEnd = new Date(current.current_period_end);
        const remainingDays = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
        const totalDays = Math.ceil(
          (periodEnd - new Date(current.current_period_start)) / (1000 * 60 * 60 * 24)
        );

        refundAmount = (current.final_price * remainingDays) / totalDays;

        await client.query(
          `UPDATE subscriptions 
           SET status = 'cancelled', cancellation_date = NOW(),
               cancellation_reason = $1, cancelled_by = $2,
               end_date = NOW(), updated_at = NOW()
           WHERE subscription_id = $3`,
          [reason, userId, subscriptionId]
        );

        message = `Subscription cancelled immediately. Refund of ₹${refundAmount.toFixed(2)} will be processed.`;
      } else {
        await client.query(
          `UPDATE subscriptions 
           SET status = 'cancelled', cancellation_date = NOW(),
               cancellation_reason = $1, cancelled_by = $2,
               auto_renew = false, updated_at = NOW()
           WHERE subscription_id = $3`,
          [reason, userId, subscriptionId]
        );

        message = "Subscription cancelled. Access will continue until end of current period.";
      }

      // Record history
      await client.query(
        `INSERT INTO subscription_history (
          subscription_id, action, performed_by, reason,
          prorated_amount, effective_date
        ) VALUES ($1, 'cancelled', $2, $3, $4, NOW())`,
        [subscriptionId, userId, reason, immediate ? refundAmount : 0]
      );

      await client.query("COMMIT");

      return {
        subscription_id: subscriptionId,
        refund_amount: refundAmount,
        access_until: immediate ? new Date() : current.current_period_end,
        message
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== AUTO-RENEWAL ====================

  async toggleAutoRenewal(subscriptionId, userId, autoRenew) {
    await this.getSubscriptionById(subscriptionId, userId);

    const result = await pool.query(
      `UPDATE subscriptions 
       SET auto_renew = $1, updated_at = NOW()
       WHERE subscription_id = $2
       RETURNING *`,
      [autoRenew, subscriptionId]
    );

    return result.rows[0];
  }

  // ==================== HISTORY ====================

  async getSubscriptionHistory(subscriptionId, userId) {
    await this.getSubscriptionById(subscriptionId, userId);

    const query = `
      SELECT 
        h.*,
        ot.tier_name as old_tier_name,
        nt.tier_name as new_tier_name,
        obc.cycle_name as old_cycle_name,
        nbc.cycle_name as new_cycle_name
      FROM subscription_history h
      LEFT JOIN subscription_tiers_ref ot ON h.old_tier_id = ot.tier_id
      LEFT JOIN subscription_tiers_ref nt ON h.new_tier_id = nt.tier_id
      LEFT JOIN billing_cycles_ref obc ON h.old_billing_cycle_id = obc.billing_cycle_id
      LEFT JOIN billing_cycles_ref nbc ON h.new_billing_cycle_id = nbc.billing_cycle_id
      WHERE h.subscription_id = $1
      ORDER BY h.created_at DESC
    `;

    const result = await pool.query(query, [subscriptionId]);
    return result.rows;
  }

  // ==================== PROMO CODE ====================

  async validatePromoCode(promoCode, userId, tierId, billingCycleId) {
    const query = `
      SELECT * FROM promo_codes
      WHERE promo_code = $1
        AND is_active = true
        AND valid_from <= NOW()
        AND valid_until >= NOW()
        AND (max_uses_total IS NULL OR current_uses < max_uses_total)
    `;

    const promo = await pool.query(query, [promoCode]);

    if (promo.rows.length === 0) {
      throw new AppError("Invalid or expired promo code", 400, "INVALID_PROMO_CODE");
    }

    const promoData = promo.rows[0];

    // Check user usage
    const usageCheck = await pool.query(
      `SELECT COUNT(*) as usage_count FROM promo_code_usage
       WHERE promo_id = $1 AND user_id = $2`,
      [promoData.promo_id, userId]
    );

    if (parseInt(usageCheck.rows[0].usage_count) >= promoData.max_uses_per_user) {
      throw new AppError(
        "Promo code usage limit reached",
        400,
        "PROMO_LIMIT_REACHED"
      );
    }

    // Check applicability
    if (promoData.tier_ids && !promoData.tier_ids.includes(tierId)) {
      throw new AppError(
        "Promo code not applicable to this tier",
        400,
        "PROMO_NOT_APPLICABLE"
      );
    }

    return {
      is_valid: true,
      promo_id: promoData.promo_id,
      discount_type: promoData.discount_type,
      discount_value: promoData.discount_value,
      max_discount_amount: promoData.max_discount_amount
    };
  }

  // ==================== PRICING ====================

  async calculatePrice(tierId, billingCycleId, promoCode = null, userId = null) {
    // Get base pricing
    const billingCycle = await pool.query(
      "SELECT * FROM billing_cycles_ref WHERE billing_cycle_id = $1",
      [billingCycleId]
    );

    if (billingCycle.rows.length === 0) {
      throw new AppError("Invalid billing cycle", 400, "INVALID_BILLING_CYCLE");
    }

    const cycle = billingCycle.rows[0];

  // Get base price from DB
  const tierResult = await pool.query(
    "SELECT base_price FROM subscription_tiers_ref WHERE tier_id = $1",
    [tierId]
  );

  if (tierResult.rows.length === 0) {
    throw new AppError("Invalid tier", 400, "INVALID_TIER");
  }

  let basePrice = parseFloat(tierResult.rows[0].base_price);

  // Apply billing cycle multiplier
  if (cycle.months === 12) {
    basePrice = basePrice * 12;
  }

    // Apply billing cycle discount
    const cycleDiscount = basePrice * (cycle.discount_percentage / 100);
    let subtotal = basePrice - cycleDiscount;

    // Apply promo code if provided
    let promoDiscount = 0;
    let promoId = null;

    if (promoCode && userId) {
      const promo = await this.validatePromoCode(
        promoCode,
        userId,
        tierId,
        billingCycleId
      );

      if (promo.discount_type === "percentage") {
        promoDiscount = subtotal * (promo.discount_value / 100);
        if (promo.max_discount_amount) {
          promoDiscount = Math.min(promoDiscount, promo.max_discount_amount);
        }
      } else {
        promoDiscount = promo.discount_value;
      }

      promoId = promo.promo_id;
    }

    const finalPrice = subtotal - promoDiscount;

    // Calculate tax (18% GST)
    const taxAmount = finalPrice * 0.18;
    const totalAmount = finalPrice + taxAmount;

    return {
      tier_id: tierId,
      billing_cycle_id: billingCycleId,
      base_price: basePrice,
      cycle_discount: cycleDiscount,
      subtotal: subtotal,
      promo_code: promoCode,
      promo_id: promoId,
      discount_amount: promoDiscount,
      final_price: finalPrice,
      tax_percentage: 18,
      tax_amount: taxAmount,
      total_amount: totalAmount
    };
  }

  // ==================== RENEWAL PREVIEW ====================

  async previewRenewal(subscriptionId, userId) {
    const subscription = await this.getSubscriptionById(subscriptionId, userId);

    if (subscription.status !== "active") {
      throw new AppError(
        "Subscription is not active",
        400,
        "INVALID_SUBSCRIPTION_STATUS"
      );
    }

    if (!subscription.auto_renew) {
      return {
        will_renew: false,
        message: "Auto-renewal is disabled"
      };
    }

    const pricing = await this.calculatePrice(
      subscription.tier_id,
      subscription.billing_cycle_id,
      null,
      userId
    );

    return {
      will_renew: true,
      renewal_date: subscription.next_billing_date,
      tier_name: subscription.tier_name,
      billing_cycle: subscription.cycle_name,
      amount_to_charge: pricing.total_amount,
      pricing_breakdown: pricing
    };
  }

  // ==================== HELPER: USE ENTITLEMENT ====================

  async useEntitlement(subscriptionId, categoryId, quantity = 1) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get entitlement
      const entitlement = await client.query(
        `SELECT * FROM subscription_entitlements
         WHERE subscription_id = $1 AND category_id = $2`,
        [subscriptionId, categoryId]
      );

      if (entitlement.rows.length === 0) {
        throw new AppError(
          "Service not included in subscription",
          400,
          "SERVICE_NOT_INCLUDED"
        );
      }

      const ent = entitlement.rows[0];

      // Check if unlimited (null quota_total)
      if (ent.quota_total === null) {
        // Unlimited - just track usage
        await client.query(
          `UPDATE subscription_entitlements
           SET quota_used = quota_used + $1, last_used_date = NOW()
           WHERE entitlement_id = $2`,
          [quantity, ent.entitlement_id]
        );
      } else {
        // Check remaining quota
        if (ent.quota_remaining < quantity) {
          throw new AppError(
            "Insufficient quota remaining",
            400,
            "QUOTA_EXCEEDED"
          );
        }

        // Deduct from quota
        await client.query(
          `UPDATE subscription_entitlements
           SET quota_used = quota_used + $1,
               quota_remaining = quota_remaining - $2,
               last_used_date = NOW()
           WHERE entitlement_id = $3`,
          [quantity, quantity, ent.entitlement_id]
        );
      }

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== HELPER: CHECK ENTITLEMENT ====================

  async checkEntitlement(subscriptionId, categoryId, quantity = 1) {
    const entitlement = await pool.query(
      `SELECT * FROM subscription_entitlements
       WHERE subscription_id = $1 AND category_id = $2`,
      [subscriptionId, categoryId]
    );

    if (entitlement.rows.length === 0) {
      return {
        has_access: false,
        is_included: false
      };
    }

    const ent = entitlement.rows[0];

    if (ent.quota_total === null) {
      return {
        has_access: true,
        is_included: true,
        is_unlimited: true,
        quota_used: ent.quota_used
      };
    }

    return {
      has_access: ent.quota_remaining >= quantity,
      is_included: true,
      is_unlimited: false,
      quota_total: ent.quota_total,
      quota_used: ent.quota_used,
      quota_remaining: ent.quota_remaining
    };
  }
}

module.exports = new SubscriptionService();