
const subscriptionService = require('../services/subscription.service');
const adminService = require('../services/admin.service');
const ResponseUtil = require('../utils/response.util');

class AdminController {
  
  async updateTier(req, res, next) {
    try {
      const { tierId } = req.params;
      const updates = req.body;

      // Basic validation
      if (!updates.base_price && !updates.tier_name) {
        // Allow partial updates, but ensure at least something is there
      }

      const updatedTier = await subscriptionService.updateTier(tierId, updates);

      return ResponseUtil.success(
        res,
        updatedTier,
        'Tier updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async updateTierConfig(req, res, next) {
    try {
      const { tierId } = req.params;
      const { species_id, life_stage_id, category_id, quota_monthly, quota_annual, is_included } = req.body;

      if (!species_id || !life_stage_id || !category_id) {
        return ResponseUtil.error(res, 'Missing required fields', 400);
      }

      const config = {
        quota_monthly,
        quota_annual,
        is_included: is_included !== undefined ? is_included : true
      };

      const updatedConfig = await subscriptionService.updateTierConfig(
        tierId,
        species_id,
        life_stage_id,
        category_id,
        config
      );

      return ResponseUtil.success(
        res,
        updatedConfig,
        'Tier configuration updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getTierConfig(req, res, next) {
    try {
      const { tierId } = req.params;
      const config = await subscriptionService.getTierConfigs(tierId);
      return ResponseUtil.success(res, config, 'Tier configuration retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAllSubscriptions(req, res, next) {
    try {
      const result = await subscriptionService.getAllSubscriptions(req.query);
      return ResponseUtil.success(res, result, 'All subscriptions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getFairUsagePolicies(req, res, next) {
    try {
      const { tierId } = req.query;
      const result = await subscriptionService.getFairUsagePolicies(tierId);
      return ResponseUtil.success(res, result, 'Fair usage policies retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateFairUsagePolicy(req, res, next) {
    try {
      const { id } = req.params;
      const result = await subscriptionService.updateFairUsagePolicy(id, req.body);
      return ResponseUtil.success(res, result, 'Fair usage policy updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async createFairUsagePolicy(req, res, next) {
    try {
      const result = await subscriptionService.createFairUsagePolicy(req.body);
      return ResponseUtil.success(res, result, 'Fair usage policy created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==================== CAREGIVER MANAGEMENT ====================

  async createCaregiver(req, res, next) {
    try {
      const { phone, full_name } = req.body;
      
      if (!phone || !full_name) {
        return ResponseUtil.error(res, 'Phone and Full Name are required', 400);
      }

      const result = await adminService.createCaregiver(req.body);

      return ResponseUtil.success(res, result, 'Caregiver created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async promoteUserToCaregiver(req, res, next) {
    try {
      const { userId } = req.params;
      
      const result = await adminService.promoteToCaregiver(userId, req.body);

      return ResponseUtil.success(res, result, 'User promoted to caregiver successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAllCaregivers(req, res, next) {
    try {
      const result = await adminService.getAllCaregivers(req.query);
      return ResponseUtil.success(res, result, 'Caregivers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCaregiverById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.getCaregiverById(id);
      return ResponseUtil.success(res, result, 'Caregiver details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateCaregiver(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.updateCaregiver(id, req.body);
      return ResponseUtil.success(res, result, 'Caregiver updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteCaregiver(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteCaregiver(id);
      return ResponseUtil.success(res, result, 'Caregiver deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== CARE MANAGER MANAGEMENT ====================

  async createCareManager(req, res, next) {
    try {
      const { phone, full_name, email } = req.body;
      
      if (!phone || !full_name || !email) {
        return ResponseUtil.error(res, 'Phone, Email and Full Name are required', 400);
      }

      const result = await adminService.createCareManager(req.body);

      return ResponseUtil.success(res, result, 'Care Manager created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async promoteUserToCareManager(req, res, next) {
    try {
      const { userId } = req.params;
      
      const result = await adminService.promoteToCareManager(userId, req.body);

      return ResponseUtil.success(res, result, 'User promoted to care manager successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAllCareManagers(req, res, next) {
    try {
      const result = await adminService.getAllCareManagers(req.query);
      return ResponseUtil.success(res, result, 'Care Managers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCareManagerById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.getCareManagerById(id);
      return ResponseUtil.success(res, result, 'Care Manager details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateCareManager(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.updateCareManager(id, req.body);
      return ResponseUtil.success(res, result, 'Care Manager updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteCareManager(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteCareManager(id);
      return ResponseUtil.success(res, result, 'Care Manager deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== CARE MANAGER ASSIGNMENTS ====================

  async assignPetToCareManager(req, res, next) {
    try {
      const { id: managerId } = req.params;
      const { subscriptionId, petId, userId } = req.body;

      if (!subscriptionId || !petId || !userId) {
        return ResponseUtil.error(res, 'Subscription ID, Pet ID, and User ID are required', 400);
      }

      const result = await adminService.assignPetToCareManager(managerId, subscriptionId, petId, userId);
      return ResponseUtil.success(res, result, 'Pet assigned to Care Manager successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async unassignPet(req, res, next) {
    try {
      const { assignmentId } = req.params;
      const { reason } = req.body;

      const result = await adminService.unassignPet(assignmentId, reason);
      return ResponseUtil.success(res, result, 'Pet unassigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCareManagerAssignments(req, res, next) {
    try {
      const { id: managerId } = req.params;
      const result = await adminService.getCareManagerAssignments(managerId);
      return ResponseUtil.success(res, result, 'Care Manager assignments retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== CARE MANAGER INTERACTIONS ====================

  async addInteraction(req, res, next) {
    try {
      const { assignmentId } = req.params;
      const userId = req.user.user_id; // Added by auth middleware

      const result = await adminService.addInteraction(assignmentId, userId, req.body);
      return ResponseUtil.success(res, result, 'Interaction logged successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getInteractionHistory(req, res, next) {
    try {
      const { assignmentId } = req.params;
      const result = await adminService.getInteractionHistory(assignmentId);
      return ResponseUtil.success(res, result, 'Interaction history retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getUnassignedEternalSubscriptions(req, res, next) {
    try {
      const result = await adminService.getUnassignedEternalSubscriptions();
      return ResponseUtil.success(res, result, 'Unassigned Eternal subscriptions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== CUSTOMER MANAGEMENT ====================

  async getAllCustomers(req, res, next) {
    try {
      const result = await adminService.getAllCustomers(req.query);
      return ResponseUtil.success(res, result, 'Customers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCustomerById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.getCustomerById(id);
      return ResponseUtil.success(res, result, 'Customer details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== PET MANAGEMENT ====================

  async getAllPets(req, res, next) {
    try {
      const result = await adminService.getAllPetsGlobal(req.query);
      return ResponseUtil.success(res, result, 'Pets retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPetById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.getPetByIdGlobal(id);
      return ResponseUtil.success(res, result, 'Pet details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== BOOKING MANAGEMENT ====================
  
  async getAllBookings(req, res, next) {
    try {
      const result = await adminService.getAllBookingsGlobal(req.query);
      return ResponseUtil.success(res, result, 'All bookings retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getBookingById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.getBookingByIdGlobal(id);
      return ResponseUtil.success(res, result, 'Booking details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateBookingStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status_id, reason } = req.body;
      const userId = req.user.user_id;

      if (!status_id) {
        return ResponseUtil.error(res, 'Status ID is required', 400);
      }

      const result = await adminService.updateBookingStatus(id, status_id, userId, reason);
      return ResponseUtil.success(res, result, 'Booking status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignCaregiver(req, res, next) {
    try {
      const { id: bookingId } = req.params;
      const { caregiver_id } = req.body;
      const userId = req.user.user_id;

      if (!caregiver_id) {
        return ResponseUtil.error(res, 'Caregiver ID is required', 400);
      }

      const result = await adminService.assignCaregiver(bookingId, caregiver_id, userId);
      return ResponseUtil.success(res, result, 'Caregiver assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== PAYMENTS & FINANCIALS ====================

  async getAllInvoices(req, res, next) {
    try {
      const result = await adminService.getAllInvoicesGlobal(req.query);
      return ResponseUtil.success(res, result, 'All invoices retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getInvoiceById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.getInvoiceByIdGlobal(id);
      return ResponseUtil.success(res, result, 'Invoice details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAllPayments(req, res, next) {
    try {
      const result = await adminService.getAllPaymentsGlobal(req.query);
      return ResponseUtil.success(res, result, 'All transactions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAllRefunds(req, res, next) {
    try {
      const result = await adminService.getAllRefundsGlobal(req.query);
      return ResponseUtil.success(res, result, 'All refunds retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPaymentMetrics(req, res, next) {
    try {
      const result = await adminService.getFinancialMetricsGlobal();
      return ResponseUtil.success(res, result, 'Financial metrics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== COMMUNITY MANAGEMENT ====================

  async getAllEvents(req, res, next) {
    try {
      const result = await adminService.getAllEventsGlobal(req.query);
      return ResponseUtil.success(res, result, 'Events retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createEvent(req, res, next) {
    try {
      const createdBy = req.user.user_id;
      const result = await adminService.createEvent(req.body, createdBy);
      return ResponseUtil.success(res, result, 'Event created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateEvent(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.updateEvent(id, req.body);
      return ResponseUtil.success(res, result, 'Event updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async cancelEvent(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason) {
        return ResponseUtil.error(res, 'Cancellation reason is required', 400);
      }
      const result = await adminService.cancelEvent(id, reason);
      return ResponseUtil.success(res, result, 'Event cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  async getEventRegistrations(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.getEventRegistrationsGlobal(id);
      return ResponseUtil.success(res, result, 'Event registrations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateRegistrationStatus(req, res, next) {
    try {
      const { id: registrationId } = req.params;
      const { status } = req.body;
      if (!status) {
        return ResponseUtil.error(res, 'Status is required', 400);
      }
      const result = await adminService.updateRegistrationStatusGlobal(registrationId, status);
      return ResponseUtil.success(res, result, 'Registration status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCommunityMetrics(req, res, next) {
    try {
      const result = await adminService.getCommunityMetricsGlobal();
      return ResponseUtil.success(res, result, 'Community metrics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== SUPPORT TICKET MANAGEMENT ====================

  async getSupportMetrics(req, res, next) {
    try {
      const supportService = require('../services/support.service');
      const result = await supportService.getSupportMetrics();
      return ResponseUtil.success(res, result, 'Support metrics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAllTickets(req, res, next) {
    try {
      const supportService = require('../services/support.service');
      const result = await supportService.getAllTicketsGlobal(req.query);
      return ResponseUtil.success(res, result, 'Tickets retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getTicketDetails(req, res, next) {
    try {
      const { id } = req.params;
      const supportService = require('../services/support.service');
      const ticket = await supportService.getTicketDetailsAdmin(id);
      const messages = await supportService.getAdminMessages(id);
      return ResponseUtil.success(res, { ticket, messages }, 'Ticket details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateTicketStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, resolution_notes } = req.body;
      const adminId = req.user.user_id; // Using user_id for simplicity or link to admin_id if needed
      
      const supportService = require('../services/support.service');
      const result = await supportService.updateTicketStatus(id, status, resolution_notes, adminId);
      
      return ResponseUtil.success(res, result, 'Ticket status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignTicket(req, res, next) {
    try {
      const { id } = req.params;
      const { admin_id } = req.body;
      
      const supportService = require('../services/support.service');
      const result = await supportService.assignTicket(id, admin_id);
      
      return ResponseUtil.success(res, result, 'Ticket assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async addAdminMessage(req, res, next) {
    try {
      const { id } = req.params;
      const { message, attachments, is_internal } = req.body;
      const userId = req.user.user_id;
      
      const supportService = require('../services/support.service');
      const result = await supportService.addAdminMessage(id, null, userId, message, attachments, is_internal);
      
      return ResponseUtil.success(res, result, 'Message added successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==================== ADMIN USER MANAGEMENT ====================

  async getAllAdminUsers(req, res, next) {
    try {
      const result = await adminService.getAllAdminUsers(req.query);
      return ResponseUtil.success(res, result, 'Admin users retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAdminUserById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.getAdminUserById(id);
      return ResponseUtil.success(res, result, 'Admin user retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createAdminUser(req, res, next) {
    try {
      const creatorUserId = req.user.user_id;
      const result = await adminService.createAdminUser(req.body, creatorUserId);
      return ResponseUtil.success(res, result, 'Admin user created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateAdminUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.updateAdminUser(id, req.body);
      return ResponseUtil.success(res, result, 'Admin user updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async toggleAdminUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { is_active } = req.body;
      const result = await adminService.toggleAdminUserStatus(id, is_active);
      return ResponseUtil.success(res, result, 'Admin user status updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();
