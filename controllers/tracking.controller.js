// ============================================
// FILE: controllers/tracking.controller.js
// GPS Tracking Controller
// ============================================

const trackingService = require('../services/tracking.service');
const ResponseUtil = require('../utils/response.util');
const auditUtil = require('../utils/audit.util');

class TrackingController {
  // ==================== TRACKING SESSIONS ====================

  /**
   * Start tracking session (Caregiver only)
   */
  async startSession(req, res, next) {
    try {
      const caregiverId = req.user.user_id; // Assuming caregiver is logged in
      const { booking_id, pet_id, session_type } = req.body;

      const session = await trackingService.startTrackingSession(
        booking_id,
        caregiverId,
        pet_id,
        session_type
      );

      await auditUtil.log({
        user_id: caregiverId,
        action: 'create',
        entity_type: 'tracking_session',
        entity_id: session.session_id,
        new_value: session,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        session,
        'Tracking session started successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update location during tracking
   */
  async updateLocation(req, res, next) {
    try {
      const { session_id } = req.params;
      const locationData = req.body;

      const location = await trackingService.updateLocation(session_id, locationData);

      return ResponseUtil.success(
        res,
        location,
        'Location updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * End tracking session
   */
  async endSession(req, res, next) {
    try {
      const { session_id } = req.params;
      const userId = req.user.user_id;

      const session = await trackingService.endTrackingSession(session_id);

      await auditUtil.log({
        user_id: userId,
        action: 'update',
        entity_type: 'tracking_session',
        entity_id: session_id,
        changes_summary: `Tracking session ended. Distance: ${session.total_distance_km}km`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        session,
        'Tracking session ended successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get active session by booking (Customer view)
   */
  async getActiveSession(req, res, next) {
    try {
      const { booking_id } = req.params;
      const userId = req.user.user_id;

      const session = await trackingService.getActiveSessionByBooking(booking_id);

      if (!session) {
        return ResponseUtil.success(
          res,
          { session: null, message: 'No active tracking session found' },
          'No active session'
        );
      }

      // Get full details
      const details = await trackingService.getSessionDetails(session.session_id, userId);

      return ResponseUtil.success(
        res,
        details,
        'Active tracking session retrieved'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get session details
   */
  async getSessionDetails(req, res, next) {
    try {
      const { session_id } = req.params;
      const userId = req.user.user_id;

      const session = await trackingService.getSessionDetails(session_id, userId);

      return ResponseUtil.success(
        res,
        session,
        'Session details retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get location history for session
   */
  async getLocationHistory(req, res, next) {
    try {
      const { session_id } = req.params;
      const userId = req.user.user_id;
      const { limit = 100 } = req.query;

      const locations = await trackingService.getLocationHistory(
        session_id,
        userId,
        parseInt(limit)
      );

      return ResponseUtil.success(
        res,
        { locations, count: locations.length },
        'Location history retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's tracking sessions
   */
  async getUserSessions(req, res, next) {
    try {
      const userId = req.user.user_id;
      const filters = {
        pet_id: req.query.pet_id,
        is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const result = await trackingService.getUserTrackingSessions(userId, filters);

      return ResponseUtil.success(
        res,
        result,
        'Tracking sessions retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculate ETA to destination
   */
  async calculateETA(req, res, next) {
    try {
      const { session_id } = req.params;
      const { destination_lat, destination_lng } = req.body;

      if (!destination_lat || !destination_lng) {
        return ResponseUtil.validationError(res, {
          destination_lat: 'Destination latitude is required',
          destination_lng: 'Destination longitude is required'
        });
      }

      const eta = await trackingService.calculateETA(
        session_id,
        parseFloat(destination_lat),
        parseFloat(destination_lng)
      );

      if (!eta) {
        return ResponseUtil.error(res, 'Unable to calculate ETA. No location data available.', 400);
      }

      return ResponseUtil.success(
        res,
        eta,
        'ETA calculated successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TrackingController();