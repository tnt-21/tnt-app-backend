const { pool } = require('../config/database');
const { AppError } = require('../utils/response.util');
const notificationService = require('./notification.service');

const MAX_BOOKINGS_PER_CLUSTER = 6;

// Day-of-week number for each zone (JS Date: 0=Sun, 1=Mon...6=Sat)
// We use 1=Mon...5=Fri. Sat(6) and Sun(0) are for manual.
const ZONE_DAY_OF_WEEK = {
  A: 1, // Monday
  B: 2, // Tuesday
  C: 3, // Wednesday
  D: 4, // Thursday
  E: 5, // Friday
  SAT: 6, // Saturday
  SUN: 0  // Sunday
};

class ClusterService {
  /**
   * Determine the zone for a given customer address.
   */
  async getZoneForAddress(addressId) {
    const result = await pool.query(
      `SELECT zpm.zone
       FROM user_addresses ua
       JOIN zone_pincode_map zpm ON zpm.pincode = ua.pincode
       WHERE ua.address_id = $1`,
      [addressId]
    );
    return result.rows[0]?.zone || null;
  }

  /**
   * Assigns zones to any pending bookings that lack a zone.
   * Assumes booking table has a 'zone' column. If not, it uses the address_id.
   */
  async assignZonesToPendingBookings() {
    const result = await pool.query(
      `SELECT booking_id, address_id FROM bookings WHERE zone IS NULL AND address_id IS NOT NULL`
    );
    for (const row of result.rows) {
      const zone = await this.getZoneForAddress(row.address_id);
      if (zone) {
        await pool.query(`UPDATE bookings SET zone = $1 WHERE booking_id = $2`, [zone, row.booking_id]);
      }
    }
  }

  /**
   * Find the next specific day of the week for a zone.
   */
  getNextZoneDate(zone) {
    const targetDow = ZONE_DAY_OF_WEEK[zone];
    if (!targetDow) return null; // Saturday/Sunday zones don't auto-assign here if they don't have a targetDow
    
    const candidate = new Date();
    candidate.setHours(0, 0, 0, 0);
    const currentDow = candidate.getDay(); 
    
    let daysAhead = targetDow - currentDow;
    if (daysAhead <= 0) {
      daysAhead += 7; // Next week
    }
    candidate.setDate(candidate.getDate() + daysAhead);
    return candidate.toISOString().split('T')[0];
  }

  /**
   * Calculate distance using Haversine formula in km
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Auto-assign clusters for all zones.
   * overwrite: true => clear existing cluster and remake
   * overwrite: false => fill existing cluster up to 6
   */
  async autoAssignClusters(overwrite = false) {
    await this.assignZonesToPendingBookings();

    const zones = ['A', 'B', 'C', 'D', 'E'];
    const results = [];

    for (const zone of zones) {
      const targetDate = this.getNextZoneDate(zone);
      if (!targetDate) continue;

      // Handle overwrite
      if (overwrite) {
        // Find existing cluster
        const clusterRes = await pool.query(
          `SELECT cluster_id FROM service_clusters WHERE zone = $1 AND cluster_date = $2`,
          [zone, targetDate]
        );
        if (clusterRes.rows.length > 0) {
          const clusterId = clusterRes.rows[0].cluster_id;
          // Unassign bookings
          await pool.query(
            `UPDATE bookings SET cluster_id = NULL, booking_date = NULL WHERE cluster_id = $1`,
            [clusterId]
          );
          // Delete cluster
          await pool.query(`DELETE FROM service_clusters WHERE cluster_id = $1`, [clusterId]);
        }
      }

      // Get or create cluster for the date
      let clusterId = null;
      let existingCount = 0;
      
      const existingClusterRes = await pool.query(
        `SELECT cluster_id FROM service_clusters WHERE zone = $1 AND cluster_date = $2`,
        [zone, targetDate]
      );

      if (existingClusterRes.rows.length > 0) {
        clusterId = existingClusterRes.rows[0].cluster_id;
        const countRes = await pool.query(`SELECT COUNT(*) FROM bookings WHERE cluster_id = $1`, [clusterId]);
        existingCount = parseInt(countRes.rows[0].count);
      } else {
        const newClusterRes = await pool.query(
          `INSERT INTO service_clusters (zone, cluster_date) VALUES ($1, $2) RETURNING cluster_id`,
          [zone, targetDate]
        );
        clusterId = newClusterRes.rows[0].cluster_id;
      }

      const slotsAvailable = MAX_BOOKINGS_PER_CLUSTER - existingCount;
      if (slotsAvailable <= 0) {
        results.push({ zone, targetDate, assigned: 0, reason: 'Cluster full' });
        continue;
      }

      // Get pending bookings for this zone
      const pendingRes = await pool.query(
        `SELECT b.booking_id, ua.latitude, ua.longitude 
         FROM bookings b
         JOIN user_addresses ua ON b.address_id = ua.address_id
         JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
         WHERE b.zone = $1 AND b.cluster_id IS NULL AND bs.status_code NOT IN ('cancelled', 'completed')
         ORDER BY b.created_at ASC`,
        [zone]
      );

      const pendingBookings = pendingRes.rows;
      if (pendingBookings.length === 0) {
        results.push({ zone, targetDate, assigned: 0, reason: 'No pending bookings' });
        continue;
      }

      // We need to pick the 'closest' bookings. 
      // We will pick the first pending booking as the 'center' and find the closest (slotsAvailable - 1) to it.
      const center = pendingBookings[0];
      const others = pendingBookings.slice(1);
      
      others.forEach(b => {
        b.distance = this.calculateDistance(center.latitude, center.longitude, b.latitude, b.longitude);
      });
      
      others.sort((a, b) => a.distance - b.distance);
      
      const selectedBookings = [center, ...others.slice(0, slotsAvailable - 1)];

      // Assign selected bookings
      const bookingIds = selectedBookings.map(b => b.booking_id);
      
      if (bookingIds.length > 0) {
        await pool.query(
          `UPDATE bookings SET cluster_id = $1, booking_date = $2 WHERE booking_id = ANY($3::uuid[])`,
          [clusterId, targetDate, bookingIds]
        );
        
        // Update cluster status to full if it hit 6
        if (existingCount + bookingIds.length >= MAX_BOOKINGS_PER_CLUSTER) {
          await pool.query(`UPDATE service_clusters SET status = 'full' WHERE cluster_id = $1`, [clusterId]);
        }
      }

      results.push({ zone, targetDate, assigned: bookingIds.length });
    }

    return results;
  }

  /**
   * Get all clusters and their bookings
   */
  async getClustersByZone(zone) {
    const result = await pool.query(
      `SELECT sc.cluster_id, sc.zone, sc.cluster_date, sc.status,
              COALESCE(json_agg(
                json_build_object(
                  'booking_id', b.booking_id,
                  'booking_number', b.booking_number,
                  'customer_name', u.full_name,
                  'customer_phone', u.phone,
                  'address', ua.address_line1 || ', ' || ua.city || ', ' || ua.pincode,
                  'service_name', sc_cat.service_name
                )
              ) FILTER (WHERE b.booking_id IS NOT NULL), '[]') as bookings
       FROM service_clusters sc
       LEFT JOIN bookings b ON sc.cluster_id = b.cluster_id
       LEFT JOIN users u ON b.user_id = u.user_id
       LEFT JOIN user_addresses ua ON b.address_id = ua.address_id
       LEFT JOIN service_catalog sc_cat ON b.service_id = sc_cat.service_id
       WHERE sc.zone = $1
       GROUP BY sc.cluster_id
       ORDER BY sc.cluster_date ASC`,
      [zone]
    );
    return result.rows;
  }

  /**
   * Get pending bookings by zone
   */
  async getPendingBookings(zone) {
    let query = `
       SELECT b.booking_id, b.booking_number, b.created_at, u.full_name as customer_name, u.phone as customer_phone,
              ua.address_line1 || ', ' || ua.city || ', ' || ua.pincode as address,
              sc_cat.service_name
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       JOIN user_addresses ua ON b.address_id = ua.address_id
       JOIN service_catalog sc_cat ON b.service_id = sc_cat.service_id
       JOIN booking_statuses_ref bs ON b.status_id = bs.status_id
       WHERE b.cluster_id IS NULL AND bs.status_code NOT IN ('cancelled', 'completed')
    `;
    const params = [];

    if (zone !== 'SAT' && zone !== 'SUN') {
      query += ` AND b.zone = $1`;
      params.push(zone);
    }

    query += ` ORDER BY b.created_at ASC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Create an empty manual cluster for SAT/SUN
   */
  async createManualCluster(zone) {
    if (zone !== 'SAT' && zone !== 'SUN') {
      throw new AppError('Manual clusters can only be created for SAT or SUN', 400);
    }
    const targetDate = this.getNextZoneDate(zone);
    if (!targetDate) throw new AppError('Invalid zone date calculation', 400);

    const existing = await pool.query(
      `SELECT cluster_id FROM service_clusters WHERE zone = $1 AND cluster_date = $2`, 
      [zone, targetDate]
    );
    if (existing.rows.length > 0) return { success: true, cluster_id: existing.rows[0].cluster_id };

    const res = await pool.query(
      `INSERT INTO service_clusters (zone, cluster_date) VALUES ($1, $2) RETURNING cluster_id`, 
      [zone, targetDate]
    );
    return { success: true, cluster_id: res.rows[0].cluster_id };
  }

  /**
   * Remove a booking from a cluster (make it pending)
   */
  async removeBookingFromCluster(clusterId, bookingId) {
    await pool.query(
      `UPDATE bookings SET cluster_id = NULL, booking_date = NULL WHERE booking_id = $1 AND cluster_id = $2`,
      [bookingId, clusterId]
    );
    await pool.query(`UPDATE service_clusters SET status = 'open' WHERE cluster_id = $1`, [clusterId]);
    return { success: true };
  }

  /**
   * Add a pending booking to a cluster
   */
  async addBookingToCluster(clusterId, bookingId) {
    // Check capacity
    const clusterRes = await pool.query(`SELECT cluster_date, status FROM service_clusters WHERE cluster_id = $1`, [clusterId]);
    if (clusterRes.rows.length === 0) throw new AppError('Cluster not found', 404);
    
    const countRes = await pool.query(`SELECT COUNT(*) FROM bookings WHERE cluster_id = $1`, [clusterId]);
    const currentCount = parseInt(countRes.rows[0].count);

    if (currentCount >= MAX_BOOKINGS_PER_CLUSTER) {
      throw new AppError('Cluster is full', 400);
    }

    const { cluster_date } = clusterRes.rows[0];
    await pool.query(
      `UPDATE bookings SET cluster_id = $1, booking_date = $2 WHERE booking_id = $3`,
      [clusterId, cluster_date, bookingId]
    );

    if (currentCount + 1 >= MAX_BOOKINGS_PER_CLUSTER) {
      await pool.query(`UPDATE service_clusters SET status = 'full' WHERE cluster_id = $1`, [clusterId]);
    }

    return { success: true };
  }

  /**
   * Swap out an existing booking for a pending one
   */
  async swapBooking(clusterId, removeBookingId, addBookingId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const clusterRes = await client.query(`SELECT cluster_date FROM service_clusters WHERE cluster_id = $1`, [clusterId]);
      if (clusterRes.rows.length === 0) throw new Error('Cluster not found');
      const { cluster_date } = clusterRes.rows[0];

      // Remove
      await client.query(
        `UPDATE bookings SET cluster_id = NULL, booking_date = NULL WHERE booking_id = $1 AND cluster_id = $2`,
        [removeBookingId, clusterId]
      );
      
      // Add
      await client.query(
        `UPDATE bookings SET cluster_id = $1, booking_date = $2 WHERE booking_id = $3`,
        [clusterId, cluster_date, addBookingId]
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw new AppError(err.message, 400);
    } finally {
      client.release();
    }
  }
}

module.exports = new ClusterService();
