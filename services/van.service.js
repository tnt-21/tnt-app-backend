// ============================================
// FILE: services/van.service.js
// Van routing and scheduling with supply-side optimization
// ============================================

const { pool } = require('../config/database');
const { AppError } = require('../utils/response.util');
const { v4: uuidv4 } = require('uuid');
const {
  radiusBasedClustering,
  dbscanClustering,
  getDensestCluster,
  haversineDistance
} = require('../utils/clustering.util');
const {
  nearestNeighborTSP,
  assignTimeSlots,
  routeFitsTimeWindow,
  calculateRouteDistance
} = require('../utils/tsp-solver.util');

// Configuration Constants
const CONFIG = {
  PUNE_HQ: { lat: 18.5314, lng: 73.8446 },
  SERVICE_INTERVALS: {
    grooming: 30,
    vet_visit_eternal: 30,
    vet_visit_plus: 90,
    vet_visit_basic: 180
  },
  TIER_MULTIPLIERS: {
    1: 1.5, // Eternal
    2: 1.2, // Plus
    3: 1.0  // Basic
  },
  ROUTE: {
    maxStopsPerVan: 6,
    maxRadiusKm: 10,
    minClusterSize: 3,
    avgSpeedKmph: 30,
    bufferMinutes: 10,
    groomingDurationMinutes: 90,
    operatingHours: { start: '09:00:00', end: '18:00:00' }
  }
};

class VanService {
  // ============================================
  // SERVICE REQUEST MANAGEMENT
  // ============================================

  /**
   * Create a new service request (customer submits without date)
   */
  async createServiceRequest(data, externalClient = null) {
    const {
      user_id,
      pet_id,
      service_id,
      address_id,
      subscription_id,
      service_type,
      special_instructions
    } = data;

    const client = externalClient || await pool.connect();
    try {
      if (!externalClient) await client.query('BEGIN');

      // Get address details for location
      const addressResult = await client.query(
        'SELECT latitude, longitude, address_line1, city, pincode FROM user_addresses WHERE address_id = $1',
        [address_id]
      );
      if (addressResult.rows.length === 0) throw new AppError('Address not found', 404);
      const address = addressResult.rows[0];

      // Get subscription tier for priority
      let priority = 3; // Default to Basic
      if (subscription_id) {
        const subResult = await client.query(
          `SELECT st.tier_code FROM subscriptions s
           JOIN subscription_tiers_ref st ON s.tier_id = st.tier_id
           WHERE s.subscription_id = $1`,
          [subscription_id]
        );
        if (subResult.rows.length > 0) {
          const tierCode = subResult.rows[0].tier_code;
          priority = tierCode === 'eternal' ? 1 : tierCode === 'plus' ? 2 : 3;
        }
      }

      // Get last service date for urgency calculation
      const lastServiceResult = await client.query(
        `SELECT MAX(booking_date) as last_date
         FROM bookings b
         JOIN service_catalog sc ON b.service_id = sc.service_id
         WHERE b.pet_id = $1 AND b.status_id IN (
           SELECT status_id FROM booking_statuses_ref WHERE status_code = 'completed'
         ) AND sc.service_name ILIKE $2`,
        [pet_id, `%${service_type}%`]
      );
      const lastServiceDate = lastServiceResult.rows[0]?.last_date || null;

      // Create service request
      const query = `
        INSERT INTO service_requests (
          user_id, pet_id, service_id, address_id, subscription_id,
          service_type, latitude, longitude, address_line1, city, pincode,
          priority, last_service_date, special_instructions
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;
      const result = await client.query(query, [
        user_id, pet_id, service_id, address_id, subscription_id,
        service_type, address.latitude, address.longitude,
        address.address_line1, address.city, address.pincode,
        priority, lastServiceDate, special_instructions
      ]);

      if (!externalClient) await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      if (!externalClient) await client.query('ROLLBACK');
      throw error;
    } finally {
      if (!externalClient) client.release();
    }
  }

  /**
   * Get pending service requests sorted by urgency
   */
  async getPendingRequests(filters = {}, externalClient = null) {
    const { minUrgency, serviceType, priority } = filters;
    
    let query = `
      SELECT 
        sr.*,
        u.full_name as customer_name,
        u.phone as customer_phone,
        p.name as pet_name,
        sc.service_name,
        st.tier_name,
        st.tier_code
      FROM service_requests sr
      JOIN users u ON sr.user_id = u.user_id
      JOIN pets p ON sr.pet_id = p.pet_id
      JOIN service_catalog sc ON sr.service_id = sc.service_id
      LEFT JOIN subscriptions sub ON sr.subscription_id = sub.subscription_id
      LEFT JOIN subscription_tiers_ref st ON sub.tier_id = st.tier_id
      WHERE sr.status = 'pending'
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (minUrgency) {
      query += ` AND sr.urgency_score >= $${paramCount}`;
      params.push(minUrgency);
      paramCount++;
    }
    
    if (serviceType) {
      query += ` AND sr.service_type = $${paramCount}`;
      params.push(serviceType);
      paramCount++;
    }
    
    if (priority) {
      query += ` AND sr.priority = $${paramCount}`;
      params.push(priority);
      paramCount++;
    }
    
    query += ' ORDER BY sr.urgency_score DESC, sr.created_at ASC';
    
    const result = await (externalClient || pool).query(query, params);
    return result.rows;
  }

  // ============================================
  // ROUTE OPTIMIZATION
  // ============================================

  /**
   * Generate weekly routes for all vans
   */
  async generateWeeklyRoutes(startDate, daysAhead = 7) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      console.log(`🚀 Generating routes for ${daysAhead} days starting ${startDate}...`);
      
      const results = {
        totalRoutes: 0,
        totalRequestsAssigned: 0,
        routesByDay: []
      };
      
      // Get all active vans
      const vansResult = await client.query('SELECT * FROM vans WHERE is_active = true');
      const vans = vansResult.rows;
      
      if (vans.length === 0) throw new AppError('No active vans available', 400);
      
      // Get all pending requests
      const pendingRequests = await this.getPendingRequests({}, client);
      
      if (pendingRequests.length === 0) {
        console.log('⚠️  No pending requests to schedule');
        await client.query('COMMIT');
        return results;
      }
      
      console.log(`📋 Found ${pendingRequests.length} pending requests`);
      console.log(`🚐 Found ${vans.length} active vans`);
      
      // Track assigned requests to avoid duplicates
      const assignedRequestIds = new Set();
      
      // Generate routes for each day
      for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + dayOffset);
        const dateStr = date.toISOString().split('T')[0];
        
        console.log(`\n📅 Processing ${dateStr}...`);
        
        const dayResults = {
          date: dateStr,
          routes: [],
          requestsAssigned: 0
        };
        
        // Get available requests (not yet assigned)
        const availableRequests = pendingRequests.filter(
          r => !assignedRequestIds.has(r.request_id)
        );
        
        if (availableRequests.length === 0) {
          console.log('  No more requests to assign');
          continue;
        }
        
        // Build routes for each van
        for (const van of vans) {
          const route = await this.buildOptimalRoute(
            van,
            dateStr,
            availableRequests,
            CONFIG.ROUTE.maxStopsPerVan,
            client
          );
          
          if (route && route.assignments.length > 0) {
            dayResults.routes.push(route);
            dayResults.requestsAssigned += route.assignments.length;
            results.totalRoutes++;
            
            // Mark requests as assigned
            route.assignments.forEach(a => assignedRequestIds.add(a.request_id));
            
            console.log(`  ✅ Van ${van.van_number}: ${route.assignments.length} stops, ${route.totalDistanceKm.toFixed(1)} km`);
          }
        }
        
        results.routesByDay.push(dayResults);
        results.totalRequestsAssigned += dayResults.requestsAssigned;
      }
      
      await client.query('COMMIT');
      
      console.log(`\n🎉 Route generation complete!`);
      console.log(`   Total routes: ${results.totalRoutes}`);
      console.log(`   Total requests assigned: ${results.totalRequestsAssigned}`);
      
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Build optimal route for one van on one day
   */
  async buildOptimalRoute(van, date, availableRequests, maxStops = 6, externalClient = null) {
    const client = externalClient || await pool.connect();
    try {
      if (!externalClient) await client.query('BEGIN');
      
      const vanBase = {
        lat: van.start_location_lat || CONFIG.PUNE_HQ.lat,
        lng: van.start_location_lng || CONFIG.PUNE_HQ.lng
      };
      
      // Step 1: Geographic clustering
      const clusters = radiusBasedClustering(
        availableRequests,
        vanBase,
        CONFIG.ROUTE.maxRadiusKm,
        maxStops
      );
      
      if (clusters.length === 0 || clusters[0].length < CONFIG.ROUTE.minClusterSize) {
        return null; // Not enough density
      }
      
      // Step 2: Pick densest cluster
      const bestCluster = getDensestCluster(clusters);
      
      if (bestCluster.length < CONFIG.ROUTE.minClusterSize) {
        return null;
      }
      
      // Step 3: Solve TSP for optimal sequence
      const optimizedSequence = nearestNeighborTSP(vanBase, bestCluster);
      
      // Step 4: Assign time slots
      const routeWithTimes = assignTimeSlots({
        startTime: CONFIG.ROUTE.operatingHours.start,
        route: optimizedSequence,
        serviceDurationMinutes: CONFIG.ROUTE.groomingDurationMinutes,
        bufferMinutes: CONFIG.ROUTE.bufferMinutes,
        avgSpeedKmph: CONFIG.ROUTE.avgSpeedKmph,
        startLocation: vanBase
      });
      
      // Step 5: Check if route fits time window
      if (!routeFitsTimeWindow(routeWithTimes, CONFIG.ROUTE.operatingHours.end)) {
        // Remove stops that don't fit
        const fittingStops = [];
        for (const stop of routeWithTimes) {
          if (stop.departureTime <= CONFIG.ROUTE.operatingHours.end) {
            fittingStops.push(stop);
          } else {
            break;
          }
        }
        routeWithTimes.length = 0;
        routeWithTimes.push(...fittingStops);
      }
      
      if (routeWithTimes.length < CONFIG.ROUTE.minClusterSize) {
        return null;
      }
      
      // Step 6: Create van schedule
      const schedule = await this.createVanSchedule(
        van.van_id,
        date,
        CONFIG.ROUTE.operatingHours.start,
        CONFIG.ROUTE.operatingHours.end,
        client
      );
      
      // Step 7: Save assignments and update requests
      const assignments = [];
      for (const stop of routeWithTimes) {
        // Create route assignment
        const assignQuery = `
          INSERT INTO van_route_assignments (
            schedule_id, booking_id, sequence_order,
            estimated_arrival_time, estimated_departure_time,
            travel_time_from_previous
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;
        
        // Note: We'll create actual booking later, for now just track in service_requests
        const assignResult = await client.query(
          `UPDATE service_requests
           SET status = 'scheduled',
               assigned_date = $1,
               assigned_time = $2,
               assigned_schedule_id = $3,
               route_sequence = $4,
               estimated_arrival_time = $5,
               estimated_departure_time = $6
           WHERE request_id = $7
           RETURNING *`,
          [
            date,
            stop.arrivalTime,
            schedule.schedule_id,
            stop.sequence,
            stop.arrivalTime,
            stop.departureTime,
            stop.request_id
          ]
        );
        
        assignments.push(assignResult.rows[0]);
      }
      
      // Step 8: Calculate and save metrics
      const totalDistance = calculateRouteDistance(vanBase, routeWithTimes);
      const efficiencyScore = totalDistance / routeWithTimes.length;
      
      await client.query(
        `INSERT INTO route_optimization_metrics (
          schedule_id, total_stops, total_distance_km, efficiency_score,
          algorithm_used, clustering_method
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          schedule.schedule_id,
          routeWithTimes.length,
          totalDistance,
          efficiencyScore,
          'nearest_neighbor',
          'radius_based'
        ]
      );
      
      if (!externalClient) await client.query('COMMIT');
      
      return {
        schedule,
        assignments,
        totalDistanceKm: totalDistance,
        efficiencyScore
      };
    } catch (error) {
      if (!externalClient) await client.query('ROLLBACK');
      throw error;
    } finally {
      if (!externalClient) client.release();
    }
  }

  // ============================================
  // CUSTOMER RESPONSE HANDLING
  // ============================================

  /**
   * Handle customer response to assigned time slot
   */
  async handleCustomerResponse(requestId, action, externalClient = null) {
    const client = externalClient || await pool.connect();
    try {
      if (!externalClient) await client.query('BEGIN');
      
      const request = await client.query(
        'SELECT * FROM service_requests WHERE request_id = $1',
        [requestId]
      );
      
      if (request.rows.length === 0) throw new AppError('Request not found', 404);
      const req = request.rows[0];
      
      if (action === 'accepted') {
        // Create actual booking
        await this.createBookingFromRequest(req, client);
        
        // Update request status
        await client.query(
          `UPDATE service_requests
           SET status = 'confirmed',
               customer_response = 'accepted',
               customer_responded_at = NOW()
           WHERE request_id = $1`,
          [requestId]
        );
        
      } else if (action === 'rejected') {
        // Return to pending pool with lower priority
        await client.query(
          `UPDATE service_requests
           SET status = 'pending',
               customer_response = 'rejected',
               customer_responded_at = NOW(),
               rejection_count = rejection_count + 1,
               assigned_date = NULL,
               assigned_time = NULL,
               assigned_schedule_id = NULL,
               route_sequence = NULL
           WHERE request_id = $1`,
          [requestId]
        );
      }
      
      if (!externalClient) await client.query('COMMIT');
      return { success: true, action };
    } catch (error) {
      if (!externalClient) await client.query('ROLLBACK');
      throw error;
    } finally {
      if (!externalClient) client.release();
    }
  }

  /**
   * Create booking from confirmed service request
   */
  async createBookingFromRequest(request, externalClient = null) {
    const bookingNumber = `BK${Date.now()}`;
    
    // Get pending status
    const statusResult = await (externalClient || pool).query(
      "SELECT status_id FROM booking_statuses_ref WHERE status_code = 'pending'"
    );
    const statusId = statusResult.rows[0].status_id;
    
    const query = `
      INSERT INTO bookings (
        booking_number, user_id, pet_id, service_id, subscription_id,
        booking_date, booking_time, address_id, location_type_id,
        status_id, scheduling_type, base_amount, total_amount,
        special_instructions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    
    const result = await (externalClient || pool).query(query, [
      bookingNumber,
      request.user_id,
      request.pet_id,
      request.service_id,
      request.subscription_id,
      request.assigned_date,
      request.assigned_time,
      request.address_id,
      2, // care_van location type
      statusId,
      'flexible_van',
      0, // Will be calculated based on service
      0,
      request.special_instructions
    ]);
    
    return result.rows[0];
  }

  // ============================================
  // VAN MANAGEMENT (Keep existing methods)
  // ============================================

  async createVan(data, externalClient = null) {
    const { van_number, van_name, registration_number, zone, start_location_lat, start_location_lng } = data;
    const query = `
      INSERT INTO vans (van_number, van_name, registration_number, zone, start_location_lat, start_location_lng)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await (externalClient || pool).query(query, [
      van_number,
      van_name,
      registration_number,
      zone || 'Pune Central',
      start_location_lat || CONFIG.PUNE_HQ.lat,
      start_location_lng || CONFIG.PUNE_HQ.lng
    ]);
    return result.rows[0];
  }

  async getVans(date, externalClient = null) {
    if (date) {
      const query = `
        SELECT 
          v.*, 
          vs.schedule_id, 
          vs.status as schedule_status, 
          vs.start_time, 
          vs.end_time,
          (SELECT COUNT(*) FROM service_requests WHERE assigned_schedule_id = vs.schedule_id) as assignment_count
        FROM vans v
        LEFT JOIN van_schedules vs ON v.van_id = vs.van_id AND vs.schedule_date = $1
        WHERE v.is_active = true
        ORDER BY v.van_number
      `;
      const result = await (externalClient || pool).query(query, [date]);
      return result.rows;
    }
    const result = await (externalClient || pool).query('SELECT * FROM vans WHERE is_active = true ORDER BY van_number');
    return result.rows;
  }

  async createVanSchedule(vanId, date, startTime = '09:00:00', endTime = '18:00:00', externalClient = null) {
    const query = `
      INSERT INTO van_schedules (van_id, schedule_date, start_time, end_time)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (van_id, schedule_date) DO UPDATE 
      SET start_time = EXCLUDED.start_time, 
          end_time = EXCLUDED.end_time,
          updated_at = NOW()
      RETURNING *
    `;
    const result = await (externalClient || pool).query(query, [vanId, date, startTime, endTime]);
    return result.rows[0];
  }

  async getScheduleAssignments(scheduleId, externalClient = null) {
    const query = `
      SELECT 
        sr.*,
        u.full_name as customer_name,
        u.phone as customer_phone,
        p.name as pet_name,
        sc.service_name
      FROM service_requests sr
      JOIN users u ON sr.user_id = u.user_id
      JOIN pets p ON sr.pet_id = p.pet_id
      JOIN service_catalog sc ON sr.service_id = sc.service_id
      WHERE sr.assigned_schedule_id = $1
      ORDER BY sr.route_sequence ASC
    `;
    const result = await (externalClient || pool).query(query, [scheduleId]);
    return result.rows;
  }
}

module.exports = new VanService();
