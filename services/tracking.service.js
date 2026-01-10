// ============================================
// FILE: services/tracking.service.js
// GPS Tracking Service for Services & Continuous Pet Tracking
// ============================================

const { pool, transaction } = require('../config/database');
const { AppError } = require('../utils/response.util');

class TrackingService {
  // ==================== TRACKING SESSIONS ====================

  /**
   * Start a new tracking session
   */
  async startTrackingSession(bookingId, caregiverId, petId, sessionType = 'service_tracking') {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify booking exists and belongs to caregiver
      const bookingCheck = await client.query(
        `SELECT b.booking_id, a.caregiver_id, b.pet_id
         FROM bookings b
         JOIN assignments a ON b.booking_id = a.booking_id
         WHERE b.booking_id = $1 AND a.caregiver_id = $2`,
        [bookingId, caregiverId]
      );

      if (bookingCheck.rows.length === 0) {
        throw new AppError('Booking not found or not assigned to this caregiver', 404, 'BOOKING_NOT_FOUND');
      }

      // Check if there's already an active session
      const existingSession = await client.query(
        `SELECT session_id FROM tracking_sessions
         WHERE booking_id = $1 AND is_active = true`,
        [bookingId]
      );

      if (existingSession.rows.length > 0) {
        throw new AppError('An active tracking session already exists for this booking', 400, 'SESSION_ALREADY_ACTIVE');
      }

      // Create tracking session
      const sessionQuery = `
        INSERT INTO tracking_sessions (
          booking_id, caregiver_id, pet_id, session_type, start_time, is_active
        ) VALUES ($1, $2, $3, $4, NOW(), true)
        RETURNING *
      `;

      const result = await client.query(sessionQuery, [bookingId, caregiverId, petId, sessionType]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update location during tracking session
   */
  async updateLocation(sessionId, locationData) {
    const { latitude, longitude, accuracy, altitude, speed, heading, battery_level } = locationData;

    // Verify session is active
    const sessionCheck = await pool.query(
      'SELECT session_id, is_active FROM tracking_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionCheck.rows.length === 0) {
      throw new AppError('Tracking session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (!sessionCheck.rows[0].is_active) {
      throw new AppError('Tracking session is not active', 400, 'SESSION_NOT_ACTIVE');
    }

    // Insert location point
    const query = `
      INSERT INTO location_tracking (
        session_id, latitude, longitude, accuracy, altitude, speed, heading, battery_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await pool.query(query, [
      sessionId,
      latitude,
      longitude,
      accuracy || null,
      altitude || null,
      speed || null,
      heading || null,
      battery_level || null
    ]);

    return result.rows[0];
  }

  /**
   * End tracking session and calculate metrics
   */
  async endTrackingSession(sessionId) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify session exists and is active
      const sessionCheck = await client.query(
        'SELECT * FROM tracking_sessions WHERE session_id = $1 AND is_active = true',
        [sessionId]
      );

      if (sessionCheck.rows.length === 0) {
        throw new AppError('Active tracking session not found', 404, 'SESSION_NOT_FOUND');
      }

      // Calculate total distance using Haversine formula
      const distanceQuery = `
        WITH locations AS (
          SELECT 
            latitude, 
            longitude,
            LAG(latitude) OVER (ORDER BY timestamp) as prev_lat,
            LAG(longitude) OVER (ORDER BY timestamp) as prev_lon
          FROM location_tracking
          WHERE session_id = $1
          ORDER BY timestamp
        ),
        distances AS (
          SELECT
            (6371 * acos(
              cos(radians(prev_lat)) * cos(radians(latitude)) *
              cos(radians(longitude) - radians(prev_lon)) +
              sin(radians(prev_lat)) * sin(radians(latitude))
            )) as distance_km
          FROM locations
          WHERE prev_lat IS NOT NULL
        )
        SELECT COALESCE(SUM(distance_km), 0) as total_distance FROM distances
      `;

      const distanceResult = await client.query(distanceQuery, [sessionId]);
      const totalDistance = parseFloat(distanceResult.rows[0].total_distance);

      // Calculate average speed
      const speedQuery = `
        SELECT AVG(speed) as avg_speed
        FROM location_tracking
        WHERE session_id = $1 AND speed IS NOT NULL
      `;

      const speedResult = await client.query(speedQuery, [sessionId]);
      const avgSpeed = speedResult.rows[0].avg_speed ? parseFloat(speedResult.rows[0].avg_speed) : null;

      // Update session
      const updateQuery = `
        UPDATE tracking_sessions
        SET 
          is_active = false,
          end_time = NOW(),
          total_distance_km = $2,
          average_speed = $3
        WHERE session_id = $1
        RETURNING *
      `;

      const result = await client.query(updateQuery, [sessionId, totalDistance, avgSpeed]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active tracking session for booking
   */
  async getActiveSessionByBooking(bookingId) {
    const query = `
      SELECT * FROM tracking_sessions
      WHERE booking_id = $1 AND is_active = true
    `;

    const result = await pool.query(query, [bookingId]);
    return result.rows[0] || null;
  }

  /**
   * Get tracking session details with latest location
   */
  async getSessionDetails(sessionId, userId = null) {
    const query = `
      SELECT 
        ts.*,
        p.name as pet_name,
        c.full_name as caregiver_name,
        c.phone as caregiver_phone,
        b.booking_number,
        b.booking_date,
        (
          SELECT json_build_object(
            'latitude', latitude,
            'longitude', longitude,
            'accuracy', accuracy,
            'speed', speed,
            'timestamp', timestamp
          )
          FROM location_tracking
          WHERE session_id = ts.session_id
          ORDER BY timestamp DESC
          LIMIT 1
        ) as latest_location
      FROM tracking_sessions ts
      JOIN pets p ON ts.pet_id = p.pet_id
      JOIN caregivers c ON ts.caregiver_id = c.caregiver_id
      JOIN bookings b ON ts.booking_id = b.booking_id
      WHERE ts.session_id = $1
    `;

    const result = await pool.query(query, [sessionId]);

    if (result.rows.length === 0) {
      throw new AppError('Tracking session not found', 404, 'SESSION_NOT_FOUND');
    }

    const session = result.rows[0];

    // If userId provided, verify ownership
    if (userId) {
      const ownerCheck = await pool.query(
        'SELECT user_id FROM pets WHERE pet_id = $1',
        [session.pet_id]
      );

      if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== userId) {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }
    }

    return session;
  }

  /**
   * Get location history for a tracking session
   */
  async getLocationHistory(sessionId, userId = null, limit = 100) {
    // Verify session and ownership
    await this.getSessionDetails(sessionId, userId);

    const query = `
      SELECT *
      FROM location_tracking
      WHERE session_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [sessionId, limit]);
    return result.rows;
  }

  /**
   * Get tracking sessions for a user's pets
   */
  async getUserTrackingSessions(userId, filters = {}) {
    const { pet_id, is_active, limit = 20, offset = 0 } = filters;

    let query = `
      SELECT 
        ts.*,
        p.name as pet_name,
        c.full_name as caregiver_name,
        b.booking_number,
        b.booking_date,
        (
          SELECT COUNT(*)
          FROM location_tracking
          WHERE session_id = ts.session_id
        ) as location_points
      FROM tracking_sessions ts
      JOIN pets p ON ts.pet_id = p.pet_id
      JOIN caregivers c ON ts.caregiver_id = c.caregiver_id
      JOIN bookings b ON ts.booking_id = b.booking_id
      WHERE p.owner_id = $1
    `;

    const params = [userId];
    let paramCount = 2;

    if (pet_id) {
      query += ` AND ts.pet_id = $${paramCount}`;
      params.push(pet_id);
      paramCount++;
    }

    if (is_active !== undefined) {
      query += ` AND ts.is_active = $${paramCount}`;
      params.push(is_active);
      paramCount++;
    }

    query += ` ORDER BY ts.start_time DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM tracking_sessions ts
      JOIN pets p ON ts.pet_id = p.pet_id
      WHERE p.owner_id = $1
    `;

    const countParams = [userId];
    if (pet_id) {
      countQuery += ` AND ts.pet_id = $2`;
      countParams.push(pet_id);
    }
    if (is_active !== undefined) {
      countQuery += ` AND ts.is_active = $${countParams.length + 1}`;
      countParams.push(is_active);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return {
      sessions: result.rows,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get real-time ETA based on current location and destination
   */
  async calculateETA(sessionId, destinationLat, destinationLng) {
    // Get latest location
    const locationQuery = `
      SELECT latitude, longitude, speed
      FROM location_tracking
      WHERE session_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const result = await pool.query(locationQuery, [sessionId]);

    if (result.rows.length === 0) {
      return null;
    }

    const { latitude, longitude, speed } = result.rows[0];

    // Calculate distance using Haversine formula
    const distance = this.calculateDistance(latitude, longitude, destinationLat, destinationLng);

    // Calculate ETA (in minutes)
    const avgSpeed = speed || 30; // Default 30 km/h if no speed data
    const eta = (distance / avgSpeed) * 60;

    return {
      distance_km: distance,
      eta_minutes: Math.round(eta),
      current_location: { latitude, longitude },
      destination: { latitude: destinationLat, longitude: destinationLng }
    };
  }

  /**
   * Helper: Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
}

module.exports = new TrackingService();