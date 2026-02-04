// ============================================
// FILE: controllers/van.controller.js
// Van routing and scheduling controller
// ============================================

const vanService = require('../services/van.service');
const ResponseUtil = require('../utils/response.util');

class VanController {
  
  // ============================================
  // SERVICE REQUEST ENDPOINTS
  // ============================================
  
  async createServiceRequest(req, res, next) {
    try {
      const request = await vanService.createServiceRequest(req.body);
      return ResponseUtil.success(
        res,
        request,
        'Service request created successfully. We\'ll confirm your time slot within 24 hours!',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async getPendingRequests(req, res, next) {
    try {
      const { minUrgency, serviceType, priority } = req.query;
      const requests = await vanService.getPendingRequests({
        minUrgency: minUrgency ? parseFloat(minUrgency) : undefined,
        serviceType,
        priority: priority ? parseInt(priority) : undefined
      });
      return ResponseUtil.success(res, { requests, count: requests.length }, 'Pending requests retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async respondToTimeSlot(req, res, next) {
    try {
      const { request_id } = req.params;
      const { action } = req.body; // 'accepted' or 'rejected'
      
      const result = await vanService.handleCustomerResponse(request_id, action);
      
      const message = action === 'accepted' 
        ? 'Time slot confirmed! Your booking has been created.'
        : 'Time slot rejected. We\'ll find you another slot soon.';
      
      return ResponseUtil.success(res, result, message);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // ROUTE OPTIMIZATION ENDPOINTS
  // ============================================

  async generateWeeklyRoutes(req, res, next) {
    try {
      const { start_date, days_ahead } = req.body;
      const startDate = start_date || new Date().toISOString().split('T')[0];
      const daysAhead = days_ahead || 7;
      
      const results = await vanService.generateWeeklyRoutes(startDate, daysAhead);
      
      return ResponseUtil.success(
        res,
        results,
        `Routes generated successfully! ${results.totalRoutes} routes created, ${results.totalRequestsAssigned} requests assigned.`
      );
    } catch (error) {
      next(error);
    }
  }

  async buildRouteForVan(req, res, next) {
    try {
      const { van_id, date } = req.body;
      
      // Get van details
      const vans = await vanService.getVans();
      const van = vans.find(v => v.van_id === van_id);
      if (!van) {
        return ResponseUtil.error(res, 'Van not found', 404);
      }
      
      // Get pending requests
      const pendingRequests = await vanService.getPendingRequests();
      
      // Build route
      const route = await vanService.buildOptimalRoute(van, date, pendingRequests);
      
      if (!route) {
        return ResponseUtil.success(res, null, 'Not enough requests to build a route for this van/date');
      }
      
      return ResponseUtil.success(
        res,
        route,
        `Route built successfully! ${route.assignments.length} stops, ${route.totalDistanceKm.toFixed(1)} km`
      );
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // VAN MANAGEMENT ENDPOINTS
  // ============================================
  
  async createVan(req, res, next) {
    try {
      const van = await vanService.createVan(req.body);
      return ResponseUtil.success(res, van, 'Van created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getVans(req, res, next) {
    try {
      const { date } = req.query;
      const vans = await vanService.getVans(date);
      return ResponseUtil.success(res, { vans }, 'Vans retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createSchedule(req, res, next) {
    try {
      const { van_id, date, start_time, end_time } = req.body;
      const schedule = await vanService.createVanSchedule(van_id, date, start_time, end_time);
      return ResponseUtil.success(res, schedule, 'Van schedule created/updated successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getScheduleAssignments(req, res, next) {
    try {
      const { schedule_id } = req.params;
      const assignments = await vanService.getScheduleAssignments(schedule_id);
      return ResponseUtil.success(res, { assignments }, 'Schedule assignments retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new VanController();
