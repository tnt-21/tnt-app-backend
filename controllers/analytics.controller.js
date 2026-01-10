// ============================================
// FILE: controllers/analytics.controller.js
// Analytics & Reporting Controller
// ============================================

const analyticsService = require('../services/analytics.service');
const ResponseUtil = require('../utils/response.util');

class AnalyticsController {
  // ==================== EVENT TRACKING ====================

  async trackEvent(req, res, next) {
    try {
      const userId = req.user?.user_id;
      const sessionId = req.auth?.session_id;

      const eventData = {
        user_id: userId,
        session_id: sessionId,
        event_type: req.body.event_type,
        event_name: req.body.event_name,
        page_url: req.body.page_url,
        referrer_url: req.body.referrer_url,
        event_data: req.body.event_data,
        device_type: req.body.device_type || req.useragent?.isMobile ? 'mobile' : 'desktop',
        browser: req.useragent?.browser,
        os: req.useragent?.os
      };

      await analyticsService.trackEvent(eventData);
      return ResponseUtil.success(res, null, 'Event tracked successfully');
    } catch (error) {
      // Don't fail requests if analytics fails
      console.error('Analytics tracking error:', error);
      return ResponseUtil.success(res, null, 'Event received');
    }
  }

  async getUserEvents(req, res, next) {
    try {
      const userId = req.params.user_id || req.user.user_id;

      const filters = {
        event_type: req.query.event_type,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        limit: parseInt(req.query.limit) || 100
      };

      const events = await analyticsService.getUserEvents(userId, filters);
      return ResponseUtil.success(res, { events }, 'User events retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getEventStats(req, res, next) {
    try {
      const filters = {
        event_type: req.query.event_type,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const stats = await analyticsService.getEventStats(filters);
      return ResponseUtil.success(res, { stats }, 'Event statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== BUSINESS METRICS ====================

  async getMetrics(req, res, next) {
    try {
      const filters = {
        metric_type: req.query.metric_type,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const metrics = await analyticsService.getMetrics(filters);
      return ResponseUtil.success(res, { metrics }, 'Metrics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getDashboard(req, res, next) {
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const dashboard = await analyticsService.getDashboardMetrics(filters);
      return ResponseUtil.success(res, dashboard, 'Dashboard metrics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async calculateDailyMetrics(req, res, next) {
    try {
      const date = req.query.date || new Date().toISOString().split('T')[0];

      const [revenue, subscriptions, bookings] = await Promise.all([
        analyticsService.calculateDailyRevenue(date),
        analyticsService.calculateActiveSubscriptions(date),
        analyticsService.calculateBookingsCount(date)
      ]);

      return ResponseUtil.success(res, {
        date,
        revenue,
        subscriptions,
        bookings
      }, 'Daily metrics calculated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getSubscriptionMetrics(req, res, next) {
    try {
      const metrics = await analyticsService.getSubscriptionMetrics();
      return ResponseUtil.success(res, { metrics }, 'Subscription metrics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getRevenueBreakdown(req, res, next) {
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const breakdown = await analyticsService.getRevenueBreakdown(filters);
      return ResponseUtil.success(res, { breakdown }, 'Revenue breakdown retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCaregiverPerformance(req, res, next) {
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        limit: parseInt(req.query.limit) || 20
      };

      const performance = await analyticsService.getCaregiverPerformance(filters);
      return ResponseUtil.success(res, { caregivers: performance }, 'Caregiver performance retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getReports(req, res, next) {
    try {
      const reportType = req.query.type;
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      let reportData;

      switch (reportType) {
        case 'revenue':
          reportData = await analyticsService.getRevenueBreakdown(filters);
          break;
        case 'subscriptions':
          reportData = await analyticsService.getSubscriptionMetrics();
          break;
        case 'caregivers':
          reportData = await analyticsService.getCaregiverPerformance(filters);
          break;
        case 'bookings':
          reportData = await analyticsService.getMetrics({ 
            metric_type: 'bookings_count', 
            ...filters 
          });
          break;
        default:
          reportData = await analyticsService.getDashboardMetrics(filters);
      }

      return ResponseUtil.success(res, { report_type: reportType, data: reportData }, 'Report generated successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnalyticsController();