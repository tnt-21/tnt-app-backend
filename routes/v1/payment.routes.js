// ============================================
// FILE: routes/v1/payment.routes.js
// Payment Routes - API endpoints for payments
// ============================================

const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/payment.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { rateLimitMiddleware } = require('../../middlewares/rateLimit.middleware');

// Validation schemas
const {
  addPaymentMethodSchema,
  processPaymentSchema,
  verifyPaymentSchema,
  requestRefundSchema,
  createInvoiceSchema
} = require('../../utils/validation.util');

// ==================== PAYMENT METHODS ====================
// All payment method routes require authentication
router.use('/methods', authMiddleware.authenticate);

router.get(
  '/methods',
  rateLimitMiddleware(30, 60),
  paymentController.getPaymentMethods
);

router.get(
  '/methods/:method_id',
  rateLimitMiddleware(30, 60),
  paymentController.getPaymentMethod
);

router.post(
  '/methods',
  rateLimitMiddleware(10, 60),
  validate(addPaymentMethodSchema),
  paymentController.addPaymentMethod
);

router.put(
  '/methods/:method_id/set-default',
  rateLimitMiddleware(20, 60),
  paymentController.setDefaultPaymentMethod
);

router.delete(
  '/methods/:method_id',
  rateLimitMiddleware(20, 60),
  paymentController.deletePaymentMethod
);

// ==================== INVOICES ====================
router.use('/invoices', authMiddleware.authenticate);

router.post(
  '/invoices',
  rateLimitMiddleware(10, 60),
  validate(createInvoiceSchema),
  paymentController.createInvoice
);

router.get(
  '/invoices',
  rateLimitMiddleware(30, 60),
  paymentController.getInvoices
);

router.get(
  '/invoices/:invoice_id',
  rateLimitMiddleware(30, 60),
  paymentController.getInvoice
);

router.get(
  '/invoices/:invoice_id/download',
  rateLimitMiddleware(10, 60),
  paymentController.downloadInvoice
);

// ==================== PAYMENTS ====================
router.post(
  '/process',
  authMiddleware.authenticate,
  rateLimitMiddleware(10, 60),
  validate(processPaymentSchema),
  paymentController.processPayment
);

router.post(
  '/verify/:payment_id',
  authMiddleware.authenticate,
  rateLimitMiddleware(20, 60),
  validate(verifyPaymentSchema),
  paymentController.verifyPayment
);

router.get(
  '/history',
  authMiddleware.authenticate,
  rateLimitMiddleware(30, 60),
  paymentController.getPaymentHistory
);

// ==================== REFUNDS ====================
router.post(
  '/refunds',
  authMiddleware.authenticate,
  rateLimitMiddleware(5, 60),
  validate(requestRefundSchema),
  paymentController.requestRefund
);

router.get(
  '/refunds',
  authMiddleware.authenticate,
  rateLimitMiddleware(30, 60),
  paymentController.getRefunds
);

router.get(
  '/refunds/:refund_id',
  authMiddleware.authenticate,
  rateLimitMiddleware(30, 60),
  paymentController.getRefund
);

// ==================== WEBHOOKS ====================
// Webhooks don't require authentication (verified via signature)
router.post(
  '/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  rateLimitMiddleware(100, 60),
  paymentController.handleRazorpayWebhook
);

module.exports = router;