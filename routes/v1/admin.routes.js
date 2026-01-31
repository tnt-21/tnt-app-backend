
const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');
const speciesController = require('../../controllers/species.controller');
const lifeStagesController = require('../../controllers/life-stages.controller');
const subscriptionTiersController = require('../../controllers/subscription-tiers.controller');
const serviceCategoriesController = require('../../controllers/service-categories.controller');
const bookingStatusesController = require('../../controllers/booking-statuses.controller');
const locationTypesController = require('../../controllers/location-types.controller');
const userRolesController = require('../../controllers/user-roles.controller');
const serviceController = require('../../controllers/service.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

// Protect all admin routes
router.use(authenticate, authorize('admin', 'super_admin'));

// Service Catalog Management
router.get('/services', serviceController.getServices);
router.get('/services/:service_id', serviceController.getServiceById);
router.post('/services', serviceController.createService);
router.put('/services/:service_id', serviceController.updateService);
router.delete('/services/:service_id', serviceController.deleteService);

// Service Eligibility & Availability
router.get('/services/:service_id/eligibility', serviceController.getServiceEligibilityRules);
router.post('/services/:service_id/eligibility', serviceController.updateServiceEligibilityRules);
router.get('/services/:service_id/availability', serviceController.getServiceAvailability);
router.post('/services/:service_id/availability', serviceController.updateServiceAvailability);

// Species Management
router.get('/species', speciesController.getAll);
router.get('/species/:id', speciesController.getById);
router.post('/species', speciesController.create);
router.put('/species/:id', speciesController.update);
router.delete('/species/:id', speciesController.delete);
router.patch('/species/:id/status', speciesController.toggleActive);

// Life Stages Management
router.get('/life-stages', lifeStagesController.getAll);
router.get('/life-stages/:id', lifeStagesController.getById);
router.post('/life-stages', lifeStagesController.create);
router.put('/life-stages/:id', lifeStagesController.update);
router.delete('/life-stages/:id', lifeStagesController.delete);
router.patch('/life-stages/:id/status', lifeStagesController.toggleActive);

// Tier Management (Master Data)
router.get('/tiers', subscriptionTiersController.getAll);
router.get('/tiers/:id', subscriptionTiersController.getById);
router.post('/tiers', subscriptionTiersController.create);
router.put('/tiers/:id', subscriptionTiersController.update);
router.delete('/tiers/:id', subscriptionTiersController.delete);
router.patch('/tiers/:id/status', subscriptionTiersController.toggleActive);

// Service Categories Management
router.get('/service-categories', serviceCategoriesController.getAll);
router.get('/service-categories/:id', serviceCategoriesController.getById);
router.post('/service-categories', serviceCategoriesController.create);
router.put('/service-categories/:id', serviceCategoriesController.update);
router.delete('/service-categories/:id', serviceCategoriesController.delete);
router.patch('/service-categories/:id/status', serviceCategoriesController.toggleActive);

// Booking Statuses Management
router.get('/booking-statuses', bookingStatusesController.getAll);
router.get('/booking-statuses/:id', bookingStatusesController.getById);
router.post('/booking-statuses', bookingStatusesController.create);
router.put('/booking-statuses/:id', bookingStatusesController.update);
router.delete('/booking-statuses/:id', bookingStatusesController.delete);
router.patch('/booking-statuses/:id/status', bookingStatusesController.toggleActive);

// Location Types Management
router.get('/location-types', locationTypesController.getAll);
router.get('/location-types/:id', locationTypesController.getById);
router.post('/location-types', locationTypesController.create);
router.put('/location-types/:id', locationTypesController.update);
router.delete('/location-types/:id', locationTypesController.delete);
router.patch('/location-types/:id/status', locationTypesController.toggleActive);

// User Roles Management
router.get('/user-roles', userRolesController.getAll);
router.get('/user-roles/:id', userRolesController.getById);
router.post('/user-roles', userRolesController.create);
router.put('/user-roles/:id', userRolesController.update);
router.delete('/user-roles/:id', userRolesController.delete);
router.patch('/user-roles/:id/status', userRolesController.toggleActive);

// Tier Configuration (Legacy support or handled by tiers routes above)
router.patch('/legacy-tiers/:tierId', adminController.updateTier);
router.get('/tiers/:tierId/config', adminController.getTierConfig);
router.post('/tiers/:tierId/config', adminController.updateTierConfig);

// Subscriptions & Fair Usage
router.get('/subscriptions', adminController.getAllSubscriptions);
router.get('/fup', adminController.getFairUsagePolicies);
router.post('/fup', adminController.createFairUsagePolicy);
router.put('/fup/:id', adminController.updateFairUsagePolicy);

// Customer Management
router.get('/customers', adminController.getAllCustomers);
router.get('/customers/:id', adminController.getCustomerById);

// Pets Management (Global)
router.get('/pets', adminController.getAllPets);
router.get('/pets/:id', adminController.getPetById);

// Caregiver Management
router.post('/caregivers', adminController.createCaregiver);
router.get('/caregivers', adminController.getAllCaregivers);
router.get('/caregivers/:id', adminController.getCaregiverById);
router.put('/caregivers/:id', adminController.updateCaregiver);
router.delete('/caregivers/:id', adminController.deleteCaregiver);
router.post('/caregivers/:userId/promote', adminController.promoteUserToCaregiver);

// Care Manager Assignments & Interactions
router.get('/care-managers/unassigned-subscriptions', adminController.getUnassignedEternalSubscriptions);

// Care Manager Management
router.post('/care-managers', adminController.createCareManager);
router.get('/care-managers', adminController.getAllCareManagers);
router.get('/care-managers/:id', adminController.getCareManagerById);
router.put('/care-managers/:id', adminController.updateCareManager);
router.delete('/care-managers/:id', adminController.deleteCareManager);
router.post('/care-managers/:userId/promote', adminController.promoteUserToCareManager);

router.get('/care-managers/:id/assignments', adminController.getCareManagerAssignments);
router.post('/care-managers/:id/assign', adminController.assignPetToCareManager);
router.post('/care-managers/assignments/:assignmentId/unassign', adminController.unassignPet);
router.get('/care-managers/assignments/:assignmentId/interactions', adminController.getInteractionHistory);
router.post('/care-managers/assignments/:assignmentId/interactions', adminController.addInteraction);

// Booking Management
router.get('/bookings', adminController.getAllBookings);
router.get('/bookings/:id', adminController.getBookingById);
router.patch('/bookings/:id/status', adminController.updateBookingStatus);
router.patch('/bookings/:id/assign', adminController.assignCaregiver);

// Payments & Financials Management
router.get('/payments/metrics', adminController.getPaymentMetrics);
router.get('/payments/invoices', adminController.getAllInvoices);
router.get('/payments/invoices/:id', adminController.getInvoiceById);
router.get('/payments/transactions', adminController.getAllPayments);
router.get('/payments/refunds', adminController.getAllRefunds);

// Community Management
router.get('/community/metrics', adminController.getCommunityMetrics);
router.get('/community/events', adminController.getAllEvents);
router.post('/community/events', adminController.createEvent);
router.patch('/community/events/:id', adminController.updateEvent);
router.delete('/community/events/:id', adminController.cancelEvent);
router.get('/community/events/:id/registrations', adminController.getEventRegistrations);
router.patch('/community/registrations/:id/status', adminController.updateRegistrationStatus);

// Support Ticket Management
router.get('/support/metrics', adminController.getSupportMetrics);
router.get('/support/tickets', adminController.getAllTickets);
router.get('/support/tickets/:id', adminController.getTicketDetails);
router.patch('/support/tickets/:id/assign', adminController.assignTicket);
router.patch('/support/tickets/:id/status', adminController.updateTicketStatus);
router.post('/support/tickets/:id/messages', adminController.addAdminMessage);

// Referral Management
const referralController = require('../../controllers/referral.controller');
router.get('/referrals/stats', referralController.getAdminStats);
router.get('/referrals', referralController.getAllReferrals);

// Admin User Management
router.get('/admin-users', adminController.getAllAdminUsers);
router.get('/admin-users/:id', adminController.getAdminUserById);
router.post('/admin-users', adminController.createAdminUser);
router.put('/admin-users/:id', adminController.updateAdminUser);
router.patch('/admin-users/:id/status', adminController.toggleAdminUserStatus);

module.exports = router;
