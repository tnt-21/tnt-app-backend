// ============================================
// FILE: services/service.service.js
// Service business logic
// ============================================

const { pool } = require('../config/database');
const { AppError } = require('../utils/response.util');
const { v4: uuidv4 } = require('uuid');

class ServiceService {
  // ==================== SERVICE CATALOG ====================

  async getServices(filters = {}) {
    const { category_id, is_active, search } = filters;
    
    let query = `
      SELECT 
        sc.*,
        cr.category_name,
        cr.icon_url as category_icon
      FROM service_catalog sc
      LEFT JOIN service_categories_ref cr ON sc.category_id = cr.category_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (category_id) {
      query += ` AND sc.category_id = $${paramCount}`;
      params.push(category_id);
      paramCount++;
    }

    if (is_active !== undefined) {
      query += ` AND sc.is_active = $${paramCount}`;
      params.push(is_active);
      paramCount++;
    }

    if (search) {
      query += ` AND (sc.service_name ILIKE $${paramCount} OR sc.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY sc.popularity_score DESC, sc.service_name ASC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getServiceById(serviceId, userId = null) {
    const query = `
      SELECT 
        sc.*,
        cr.category_name,
        cr.category_code,
        cr.icon_url as category_icon
      FROM service_catalog sc
      LEFT JOIN service_categories_ref cr ON sc.category_id = cr.category_id
      WHERE sc.service_id = $1
    `;

    const result = await pool.query(query, [serviceId]);

    if (result.rows.length === 0) {
      throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
    }

    return result.rows[0];
  }

  async checkServiceEligibility(serviceId, petId, userId) {
    // Get pet details
    const petQuery = `
      SELECT p.*, sr.species_code, ls.life_stage_code
      FROM pets p
      LEFT JOIN species_ref sr ON p.species_id = sr.species_id
      LEFT JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
      WHERE p.pet_id = $1 AND p.owner_id = $2 AND p.is_active = true
    `;
    
    const petResult = await pool.query(petQuery, [petId, userId]);

    if (petResult.rows.length === 0) {
      throw new AppError('Pet not found', 404, 'PET_NOT_FOUND');
    }

    const pet = petResult.rows[0];

    // Check if pet has active subscription
    const subQuery = `
      SELECT s.*, st.tier_code
      FROM subscriptions s
      LEFT JOIN subscription_tiers_ref st ON s.tier_id = st.tier_id
      WHERE s.pet_id = $1 AND s.status = 'active'
      ORDER BY s.tier_id DESC
      LIMIT 1
    `;

    const subResult = await pool.query(subQuery, [petId]);
    const subscription = subResult.rows[0] || null;

    // Check eligibility config
    const eligQuery = `
      SELECT *
      FROM service_eligibility_config
      WHERE service_id = $1
        AND species_id = $2
        AND life_stage_id = $3
        AND (tier_id = $4 OR tier_id IS NULL)
      ORDER BY tier_id DESC NULLS LAST
      LIMIT 1
    `;

    const eligResult = await pool.query(eligQuery, [
      serviceId,
      pet.species_id,
      pet.life_stage_id,
      subscription?.tier_id || null
    ]);

    if (eligResult.rows.length === 0) {
      return {
        eligible: false,
        reason: 'Service not available for this pet',
        pet_info: {
          species: pet.species_code,
          life_stage: pet.life_stage_code
        }
      };
    }

    const eligibility = eligResult.rows[0];

    // Get service price
    const serviceQuery = await pool.query(
      'SELECT base_price FROM service_catalog WHERE service_id = $1',
      [serviceId]
    );

    const basePrice = serviceQuery.rows[0].base_price;
    const finalPrice = eligibility.price_override || basePrice;
    const discount = eligibility.discount_percentage || 0;
    const discountedPrice = finalPrice * (1 - discount / 100);

    return {
      eligible: true,
      is_included: eligibility.is_included,
      subscription_tier: subscription?.tier_code || null,
      pricing: {
        base_price: parseFloat(basePrice),
        final_price: parseFloat(finalPrice),
        discount_percentage: parseFloat(discount),
        discounted_price: parseFloat(discountedPrice.toFixed(2)),
        is_free: eligibility.is_included && subscription !== null
      },
      prerequisites: eligibility.prerequisites,
      restrictions: eligibility.restrictions,
      pet_info: {
        species: pet.species_code,
        life_stage: pet.life_stage_code
      }
    };
  }

  async getAvailableSlots(serviceId, date, locationTypeId = null) {
    // Check if date is blackout date
    const blackoutQuery = `
      SELECT * FROM service_blackout_dates
      WHERE service_id = $1 
        AND blackout_date = $2 
        AND is_active = true
    `;

    const blackoutResult = await pool.query(blackoutQuery, [serviceId, date]);

    if (blackoutResult.rows.length > 0) {
      throw new AppError(
        `Service unavailable on this date: ${blackoutResult.rows[0].reason}`,
        400,
        'SERVICE_BLACKOUT_DATE'
      );
    }

    // Get day of week (0 = Sunday)
    const dayOfWeek = new Date(date).getDay();

    // Get service availability configuration
    const availQuery = `
      SELECT * FROM service_availability
      WHERE service_id = $1 
        AND day_of_week = $2 
        AND is_active = true
    `;

    const availResult = await pool.query(availQuery, [serviceId, dayOfWeek]);

    if (availResult.rows.length === 0) {
      return [];
    }

    const availability = availResult.rows[0];

    // Generate time slots
    const slots = [];
    const startTime = availability.start_time;
    const endTime = availability.end_time;
    const slotDuration = availability.slot_duration_minutes;
    const bufferTime = availability.buffer_time_minutes;
    const maxBookingsPerSlot = availability.max_bookings_per_slot;

    // Get existing bookings for this date
    const bookingsQuery = `
      SELECT booking_time, COUNT(*) as booking_count
      FROM bookings
      WHERE service_id = $1 
        AND booking_date = $2
        AND status_id NOT IN (
          SELECT status_id FROM booking_statuses_ref 
          WHERE status_code IN ('cancelled', 'completed')
        )
      GROUP BY booking_time
    `;

    const bookingsResult = await pool.query(bookingsQuery, [serviceId, date]);
    const bookingCounts = {};
    
    bookingsResult.rows.forEach(row => {
      bookingCounts[row.booking_time] = parseInt(row.booking_count);
    });

    // Generate slots
    let currentTime = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    while (currentTime + slotDuration <= endMinutes) {
      const slotTime = this.minutesToTime(currentTime);
      const bookingCount = bookingCounts[slotTime] || 0;
      const available = bookingCount < maxBookingsPerSlot;

      slots.push({
        time: slotTime,
        available,
        slots_remaining: maxBookingsPerSlot - bookingCount,
        total_slots: maxBookingsPerSlot
      });

      currentTime += slotDuration + bufferTime;
    }

    return slots;
  }

  // Helper functions for time conversion
  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
  }

  // ==================== BOOKINGS ====================

  async createBooking(userId, bookingData) {
    const {
      pet_id,
      service_id,
      booking_date,
      booking_time,
      location_type_id,
      address_id,
      addons = [],
      special_instructions,
      use_subscription = false
    } = bookingData;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify pet ownership
      const petCheck = await client.query(
        'SELECT * FROM pets WHERE pet_id = $1 AND owner_id = $2 AND is_active = true',
        [pet_id, userId]
      );

      if (petCheck.rows.length === 0) {
        throw new AppError('Pet not found', 404, 'PET_NOT_FOUND');
      }

      const pet = petCheck.rows[0];

      // Check eligibility
      const eligibility = await this.checkServiceEligibility(service_id, pet_id, userId);

      if (!eligibility.eligible) {
        throw new AppError(eligibility.reason, 400, 'SERVICE_NOT_ELIGIBLE');
      }

      // Verify address if doorstep
      if (location_type_id === 1 && address_id) {
        const addressCheck = await client.query(
          'SELECT * FROM user_addresses WHERE address_id = $1 AND user_id = $2 AND is_active = true',
          [address_id, userId]
        );

        if (addressCheck.rows.length === 0) {
          throw new AppError('Address not found', 404, 'ADDRESS_NOT_FOUND');
        }
      }

      // Check slot availability
      const slots = await this.getAvailableSlots(service_id, booking_date, location_type_id);
      const requestedSlot = slots.find(s => s.time === booking_time);

      if (!requestedSlot || !requestedSlot.available) {
        throw new AppError('Selected time slot is not available', 400, 'SLOT_UNAVAILABLE');
      }

      // Calculate pricing
      let baseAmount = eligibility.pricing.discounted_price;
      let addonsAmount = 0;
      let isSubscriptionService = false;
      let subscriptionId = null;

      // Check if using subscription
      if (use_subscription && eligibility.pricing.is_free) {
        const subQuery = await client.query(
          `SELECT s.*, se.*
           FROM subscriptions s
           LEFT JOIN subscription_entitlements se ON s.subscription_id = se.subscription_id
           LEFT JOIN service_catalog sc ON sc.category_id = se.category_id
           WHERE s.pet_id = $1 
             AND s.status = 'active'
             AND sc.service_id = $2
             AND se.quota_remaining > 0`,
          [pet_id, service_id]
        );

        if (subQuery.rows.length > 0) {
          baseAmount = 0;
          isSubscriptionService = true;
          subscriptionId = subQuery.rows[0].subscription_id;
        }
      }

      // Calculate addons
      if (addons && addons.length > 0) {
        addons.forEach(addon => {
          addonsAmount += addon.unit_price * addon.quantity;
        });
      }

      // Calculate tax (18% GST)
      const taxableAmount = baseAmount + addonsAmount;
      const taxAmount = taxableAmount * 0.18;
      const totalAmount = taxableAmount + taxAmount;

      // Generate booking number
      const bookingNumber = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // Get pending status ID
      const statusResult = await client.query(
        "SELECT status_id FROM booking_statuses_ref WHERE status_code = 'pending'"
      );
      const statusId = statusResult.rows[0].status_id;

      // Get service duration
      const serviceResult = await client.query(
        'SELECT duration_minutes FROM service_catalog WHERE service_id = $1',
        [service_id]
      );
      const duration = serviceResult.rows[0].duration_minutes;

      // Create booking
      const bookingQuery = `
        INSERT INTO bookings (
          booking_number, user_id, pet_id, service_id, subscription_id,
          booking_date, booking_time, estimated_duration, location_type_id, address_id,
          status_id, is_subscription_service, base_amount, addons_amount,
          tax_amount, total_amount, special_instructions, payment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `;

      const bookingResult = await client.query(bookingQuery, [
        bookingNumber, userId, pet_id, service_id, subscriptionId,
        booking_date, booking_time, duration, location_type_id, address_id || null,
        statusId, isSubscriptionService, baseAmount, addonsAmount,
        taxAmount, totalAmount, special_instructions || null,
        isSubscriptionService ? 'paid' : 'pending'
      ]);

      const booking = bookingResult.rows[0];

      // Insert addons
      if (addons && addons.length > 0) {
        for (const addon of addons) {
          await client.query(
            `INSERT INTO booking_addons (
              booking_id, addon_type, addon_name, addon_description,
              unit_price, quantity, total_price
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              booking.booking_id,
              addon.addon_type,
              addon.addon_name,
              addon.addon_description || null,
              addon.unit_price,
              addon.quantity,
              addon.unit_price * addon.quantity
            ]
          );
        }
      }

      // Deduct subscription quota if applicable
      if (isSubscriptionService && subscriptionId) {
        await client.query(
          `UPDATE subscription_entitlements 
           SET quota_used = quota_used + 1,
               quota_remaining = quota_remaining - 1,
               last_used_date = CURRENT_DATE
           WHERE subscription_id = $1 
             AND category_id = (
               SELECT category_id FROM service_catalog WHERE service_id = $2
             )`,
          [subscriptionId, service_id]
        );
      }

      // Add to booking history
      await client.query(
        `INSERT INTO booking_status_history (
          booking_id, new_status_id, changed_by, changed_by_role, notes
        ) VALUES ($1, $2, $3, 'customer', 'Booking created')`,
        [booking.booking_id, statusId, userId]
      );

      await client.query('COMMIT');

      // Return booking with details
      return await this.getBookingById(booking.booking_id, userId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getBookings(userId, filters = {}) {
    const { status, pet_id, from_date, to_date, limit = 20, offset = 0 } = filters;

    let query = `
      SELECT 
        b.*,
        sc.service_name,
        sc.category_id,
        scr.category_name,
        p.name as pet_name,
        bs.status_name,
        bs.status_code,
        ua.address_line1,
        ua.city
      FROM bookings b
      LEFT JOIN service_catalog sc ON b.service_id = sc.service_id
      LEFT JOIN service_categories_ref scr ON sc.category_id = scr.category_id
      LEFT JOIN pets p ON b.pet_id = p.pet_id
      LEFT JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
      LEFT JOIN user_addresses ua ON b.address_id = ua.address_id
      WHERE b.user_id = $1
    `;

    const params = [userId];
    let paramCount = 2;

    if (status) {
      query += ` AND bs.status_code = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (pet_id) {
      query += ` AND b.pet_id = $${paramCount}`;
      params.push(pet_id);
      paramCount++;
    }

    if (from_date) {
      query += ` AND b.booking_date >= $${paramCount}`;
      params.push(from_date);
      paramCount++;
    }

    if (to_date) {
      query += ` AND b.booking_date <= $${paramCount}`;
      params.push(to_date);
      paramCount++;
    }

    // Count query - need to build proper count query with necessary joins
    let countQuery = `
      SELECT COUNT(*) as count
      FROM bookings b
      LEFT JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
      WHERE b.user_id = $1
    `;
    
    const countParams = [userId];
    let countParamCount = 2;
    
    if (status) {
      countQuery += ` AND bs.status_code = $${countParamCount}`;
      countParams.push(status);
      countParamCount++;
    }
    
    if (pet_id) {
      countQuery += ` AND b.pet_id = $${countParamCount}`;
      countParams.push(pet_id);
      countParamCount++;
    }
    
    if (from_date) {
      countQuery += ` AND b.booking_date >= $${countParamCount}`;
      countParams.push(from_date);
      countParamCount++;
    }
    
    if (to_date) {
      countQuery += ` AND b.booking_date <= $${countParamCount}`;
      countParams.push(to_date);
      countParamCount++;
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    query += ` ORDER BY b.booking_date DESC, b.booking_time DESC`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return {
      bookings: result.rows,
      total
    };
  }

  async getBookingById(bookingId, userId) {
    const query = `
      SELECT 
        b.*,
        sc.service_name,
        sc.description as service_description,
        sc.category_id,
        scr.category_name,
        p.name as pet_name,
        p.species_id,
        sr.species_name,
        bs.status_name,
        bs.status_code,
        bs.display_color as status_color,
        lt.type_name as location_type,
        ua.address_line1,
        ua.address_line2,
        ua.city,
        ua.state,
        ua.pincode,
        ua.latitude,
        ua.longitude
      FROM bookings b
      LEFT JOIN service_catalog sc ON b.service_id = sc.service_id
      LEFT JOIN service_categories_ref scr ON sc.category_id = scr.category_id
      LEFT JOIN pets p ON b.pet_id = p.pet_id
      LEFT JOIN species_ref sr ON p.species_id = sr.species_id
      LEFT JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
      LEFT JOIN location_types_ref lt ON b.location_type_id = lt.location_type_id
      LEFT JOIN user_addresses ua ON b.address_id = ua.address_id
      WHERE b.booking_id = $1 AND b.user_id = $2
    `;

    const result = await pool.query(query, [bookingId, userId]);

    if (result.rows.length === 0) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    const booking = result.rows[0];

    // Get addons
    const addonsQuery = `
      SELECT * FROM booking_addons WHERE booking_id = $1
    `;
    const addonsResult = await pool.query(addonsQuery, [bookingId]);
    booking.addons = addonsResult.rows;

    return booking;
  }

  async cancelBooking(bookingId, userId, reason) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get booking
      const booking = await this.getBookingById(bookingId, userId);

      // Check if already cancelled
      if (booking.status_code === 'cancelled') {
        throw new AppError('Booking already cancelled', 400, 'ALREADY_CANCELLED');
      }

      // Check if completed
      if (booking.status_code === 'completed') {
        throw new AppError('Cannot cancel completed booking', 400, 'CANNOT_CANCEL_COMPLETED');
      }

      // Calculate refund based on cancellation time
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const hoursUntilBooking = (bookingDateTime - new Date()) / (1000 * 60 * 60);

      let refundPercentage = 0;
      if (hoursUntilBooking >= 24) {
        refundPercentage = 100;
      } else if (hoursUntilBooking >= 12) {
        refundPercentage = 50;
      }

      // Get cancelled status ID
      const statusResult = await client.query(
        "SELECT status_id FROM booking_statuses_ref WHERE status_code = 'cancelled'"
      );
      const cancelledStatusId = statusResult.rows[0].status_id;

      // Update booking
      await client.query(
        `UPDATE bookings 
         SET status_id = $1, 
             cancellation_reason = $2,
             cancelled_by = $3,
             cancelled_at = NOW()
         WHERE booking_id = $4`,
        [cancelledStatusId, reason, userId, bookingId]
      );

      // Add to history
      await client.query(
        `INSERT INTO booking_status_history (
          booking_id, old_status_id, new_status_id, changed_by, changed_by_role, reason
        ) VALUES ($1, $2, $3, $4, 'customer', $5)`,
        [bookingId, booking.status_id, cancelledStatusId, userId, reason]
      );

      // Restore subscription quota if applicable
      if (booking.is_subscription_service && booking.subscription_id) {
        await client.query(
          `UPDATE subscription_entitlements 
           SET quota_used = quota_used - 1,
               quota_remaining = quota_remaining + 1
           WHERE subscription_id = $1 
             AND category_id = $2`,
          [booking.subscription_id, booking.category_id]
        );
      }

      await client.query('COMMIT');

      return {
        booking_id: bookingId,
        status: 'cancelled',
        refund_percentage: refundPercentage,
        refund_amount: (booking.total_amount * refundPercentage / 100).toFixed(2)
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async rescheduleBooking(bookingId, userId, newDate, newTime, reason) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get booking
      const booking = await this.getBookingById(bookingId, userId);

      // Check if can reschedule
      if (!booking.can_reschedule) {
        throw new AppError('Booking cannot be rescheduled', 400, 'CANNOT_RESCHEDULE');
      }

      if (booking.reschedule_count >= booking.max_reschedules) {
        throw new AppError(
          `Maximum ${booking.max_reschedules} reschedules allowed`,
          400,
          'MAX_RESCHEDULES_REACHED'
        );
      }

      // Check if status allows rescheduling
      const allowedStatuses = ['pending', 'confirmed'];
      if (!allowedStatuses.includes(booking.status_code)) {
        throw new AppError('Booking status does not allow rescheduling', 400, 'STATUS_NOT_ALLOWED');
      }

      // Check if new slot is available
      const slots = await this.getAvailableSlots(booking.service_id, newDate);
      const newSlot = slots.find(s => s.time === newTime);

      if (!newSlot || !newSlot.available) {
        throw new AppError('New time slot is not available', 400, 'SLOT_UNAVAILABLE');
      }

      // Check if rescheduling within 12 hours
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const hoursUntilBooking = (bookingDateTime - new Date()) / (1000 * 60 * 60);

      if (hoursUntilBooking < 12) {
        throw new AppError(
          'Cannot reschedule within 12 hours of booking time',
          400,
          'TOO_LATE_TO_RESCHEDULE'
        );
      }

      // Update booking
      await client.query(
        `UPDATE bookings 
         SET booking_date = $1,
             booking_time = $2,
             reschedule_count = reschedule_count + 1,
             updated_at = NOW()
         WHERE booking_id = $3`,
        [newDate, newTime, bookingId]
      );

      // Add to history
      await client.query(
        `INSERT INTO booking_status_history (
          booking_id, old_status_id, new_status_id, changed_by, changed_by_role, reason, notes
        ) VALUES ($1, $2, $2, $3, 'customer', $4, $5)`,
        [
          bookingId,
          booking.status_id,
          userId,
          reason,
          `Rescheduled from ${booking.booking_date} ${booking.booking_time} to ${newDate} ${newTime}`
        ]
      );

      await client.query('COMMIT');

      return await this.getBookingById(bookingId, userId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getBookingHistory(bookingId) {
    const query = `
      SELECT 
        bsh.*,
        old_bs.status_name as old_status_name,
        new_bs.status_name as new_status_name,
        u.full_name as changed_by_name
      FROM booking_status_history bsh
      LEFT JOIN booking_statuses_ref old_bs ON bsh.old_status_id = old_bs.status_id
      LEFT JOIN booking_statuses_ref new_bs ON bsh.new_status_id = new_bs.status_id
      LEFT JOIN users u ON bsh.changed_by = u.user_id
      WHERE bsh.booking_id = $1
      ORDER BY bsh.created_at DESC
    `;

    const result = await pool.query(query, [bookingId]);
    return result.rows;
  }

  async calculateBookingPrice(data) {
    const { service_id, pet_id, userId, addons = [], promo_code } = data;

    // Get eligibility
    const eligibility = await this.checkServiceEligibility(service_id, pet_id, userId);

    if (!eligibility.eligible) {
      throw new AppError(eligibility.reason, 400, 'SERVICE_NOT_ELIGIBLE');
    }

    let baseAmount = eligibility.pricing.discounted_price;
    let addonsAmount = 0;

    // Calculate addons
    if (addons && addons.length > 0) {
      addons.forEach(addon => {
        addonsAmount += addon.unit_price * addon.quantity;
      });
    }

    // Apply promo code if provided
    let promoDiscount = 0;
    let promoDetails = null;

    if (promo_code) {
      const promoQuery = `
        SELECT * FROM promo_codes
        WHERE promo_code = $1
          AND is_active = true
          AND valid_from <= CURRENT_DATE
          AND valid_until >= CURRENT_DATE
          AND (max_uses_total IS NULL OR current_uses < max_uses_total)
      `;

      const promoResult = await pool.query(promoQuery, [promo_code]);

      if (promoResult.rows.length > 0) {
        const promo = promoResult.rows[0];

        // Check if applicable to services
        if (promo.applicable_to === 'service' || promo.applicable_to === 'all') {
          const subtotal = baseAmount + addonsAmount;

          if (promo.discount_type === 'percentage') {
            promoDiscount = subtotal * (promo.discount_value / 100);
            if (promo.max_discount_amount) {
              promoDiscount = Math.min(promoDiscount, promo.max_discount_amount);
            }
          } else if (promo.discount_type === 'fixed_amount') {
            promoDiscount = promo.discount_value;
          }

          promoDetails = {
            promo_code: promo.promo_code,
            promo_name: promo.promo_name,
            discount_type: promo.discount_type,
            discount_value: promo.discount_value,
            discount_applied: promoDiscount
          };
        }
      }
    }

    const subtotal = baseAmount + addonsAmount;
    const discountedSubtotal = subtotal - promoDiscount;
    const taxAmount = discountedSubtotal * 0.18; // 18% GST
    const totalAmount = discountedSubtotal + taxAmount;

    return {
      base_amount: parseFloat(baseAmount.toFixed(2)),
      addons_amount: parseFloat(addonsAmount.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      promo_discount: parseFloat(promoDiscount.toFixed(2)),
      promo_details: promoDetails,
      discounted_subtotal: parseFloat(discountedSubtotal.toFixed(2)),
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      total_amount: parseFloat(totalAmount.toFixed(2)),
      is_free: eligibility.pricing.is_free,
      addons_breakdown: addons
    };
  }

  async getUpcomingBookings(userId, petId = null, limit = 10) {
    let query = `
      SELECT 
        b.*,
        sc.service_name,
        scr.category_name,
        p.name as pet_name,
        bs.status_name,
        bs.status_code,
        bs.display_color as status_color
      FROM bookings b
      LEFT JOIN service_catalog sc ON b.service_id = sc.service_id
      LEFT JOIN service_categories_ref scr ON sc.category_id = scr.category_id
      LEFT JOIN pets p ON b.pet_id = p.pet_id
      LEFT JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
      WHERE b.user_id = $1
        AND b.booking_date >= CURRENT_DATE
        AND bs.status_code NOT IN ('cancelled', 'completed')
    `;

    const params = [userId];

    if (petId) {
      query += ` AND b.pet_id = $2`;
      params.push(petId);
    }

    query += ` ORDER BY b.booking_date ASC, b.booking_time ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getPastBookings(userId, petId = null, limit = 20, offset = 0) {
    let query = `
      SELECT 
        b.*,
        sc.service_name,
        scr.category_name,
        p.name as pet_name,
        bs.status_name,
        bs.status_code
      FROM bookings b
      LEFT JOIN service_catalog sc ON b.service_id = sc.service_id
      LEFT JOIN service_categories_ref scr ON sc.category_id = scr.category_id
      LEFT JOIN pets p ON b.pet_id = p.pet_id
      LEFT JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
      WHERE b.user_id = $1
        AND (
          b.booking_date < CURRENT_DATE
          OR bs.status_code IN ('cancelled', 'completed')
        )
    `;

    const params = [userId];
    let paramCount = 2;

    if (petId) {
      query += ` AND b.pet_id = $${paramCount}`;
      params.push(petId);
      paramCount++;
    }

    // Count query - need to build proper count query with necessary joins
    let countQuery = `
      SELECT COUNT(*) as count
      FROM bookings b
      LEFT JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
      WHERE b.user_id = $1
        AND (
          b.booking_date < CURRENT_DATE
          OR bs.status_code IN ('cancelled', 'completed')
        )
    `;
    
    const countParams = [userId];
    let countParamCount = 2;
    
    if (petId) {
      countQuery += ` AND b.pet_id = $${countParamCount}`;
      countParams.push(petId);
      countParamCount++;
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY b.booking_date DESC, b.booking_time DESC`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return {
      bookings: result.rows,
      total
    };
  }

  // ==================== SERVICE CATEGORIES ====================

  async getServiceCategories() {
    const query = `
      SELECT * FROM service_categories_ref
      WHERE is_active = true
      ORDER BY display_order ASC, category_name ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }
}

module.exports = new ServiceService();