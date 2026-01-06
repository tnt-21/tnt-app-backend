// ============================================
// FILE: controllers/payment.controller.js
// Payment Controller - Handles payment HTTP requests
// ============================================

const paymentService = require('../services/payment.service');
const ResponseUtil = require('../utils/response.util');
const auditUtil = require('../utils/audit.util');

class PaymentController {
  // ==================== PAYMENT METHODS ====================

  async getPaymentMethods(req, res, next) {
    try {
      const userId = req.user.user_id;
      const methods = await paymentService.getPaymentMethods(userId);

      return ResponseUtil.success(
        res,
        { payment_methods: methods },
        'Payment methods retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getPaymentMethod(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { method_id } = req.params;

      const method = await paymentService.getPaymentMethodById(method_id, userId);

      return ResponseUtil.success(
        res,
        method,
        'Payment method retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async addPaymentMethod(req, res, next) {
    try {
      const userId = req.user.user_id;
      const methodData = { ...req.body, user_id: userId };

      const method = await paymentService.addPaymentMethod(userId, methodData);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: 'create',
        entity_type: 'payment_method',
        entity_id: method.method_id,
        changes_summary: `Added ${method.method_type} payment method`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        method,
        'Payment method added successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async setDefaultPaymentMethod(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { method_id } = req.params;

      const method = await paymentService.setDefaultPaymentMethod(method_id, userId);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: 'update',
        entity_type: 'payment_method',
        entity_id: method_id,
        changes_summary: 'Set as default payment method',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        method,
        'Default payment method updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async deletePaymentMethod(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { method_id } = req.params;

      await paymentService.deletePaymentMethod(method_id, userId);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: 'delete',
        entity_type: 'payment_method',
        entity_id: method_id,
        changes_summary: 'Payment method deleted',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        null,
        'Payment method deleted successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== INVOICES ====================

  async getInvoices(req, res, next) {
    try {
      const userId = req.user.user_id;
      const filters = {
        status: req.query.status,
        invoice_type: req.query.invoice_type,
        from_date: req.query.from_date,
        to_date: req.query.to_date,
        limit: parseInt(req.query.limit) || 50
      };

      const invoices = await paymentService.getInvoices(userId, filters);

      return ResponseUtil.success(
        res,
        { 
          invoices,
          count: invoices.length
        },
        'Invoices retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async createInvoice(req, res, next) {
    try {
      const userId = req.user.user_id;
      const invoiceData = {
        ...req.body,
        user_id: userId
      };

      const invoice = await paymentService.createInvoice(invoiceData);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: 'create',
        entity_type: 'invoice',
        entity_id: invoice.invoice_id,
        changes_summary: `Created invoice for ₹${invoice.total_amount}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        invoice,
        'Invoice created successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async getInvoice(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { invoice_id } = req.params;

      const invoice = await paymentService.getInvoiceById(invoice_id, userId);

      return ResponseUtil.success(
        res,
        invoice,
        'Invoice retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async downloadInvoice(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { invoice_id } = req.params;

      const invoice = await paymentService.getInvoiceById(invoice_id, userId);

      // In production, generate PDF using library like PDFKit or puppeteer
      // For now, return JSON
      return ResponseUtil.success(
        res,
        {
          invoice,
          download_url: `/api/v1/payments/invoices/${invoice_id}/pdf`,
          message: 'PDF generation not implemented in this example'
        },
        'Invoice download prepared'
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== PAYMENTS ====================

  async processPayment(req, res, next) {
    try {
      const userId = req.user.user_id;
      const paymentData = {
        ...req.body,
        user_id: userId,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      };

      const result = await paymentService.processPayment(paymentData);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: 'create',
        entity_type: 'payment',
        entity_id: result.payment.payment_id,
        changes_summary: `Payment of ₹${result.payment.amount} processed`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        result,
        result.payment.status === 'success' 
          ? 'Payment processed successfully' 
          : 'Payment initiated',
        result.payment.status === 'success' ? 200 : 201
      );
    } catch (error) {
      next(error);
    }
  }

  async verifyPayment(req, res, next) {
    try {
      const { payment_id } = req.params;
      const verificationData = req.body;

      const result = await paymentService.verifyPayment(payment_id, verificationData);

      return ResponseUtil.success(
        res,
        result,
        result.verified ? 'Payment verified successfully' : 'Payment verification failed'
      );
    } catch (error) {
      next(error);
    }
  }

  async getPaymentHistory(req, res, next) {
    try {
      const userId = req.user.user_id;
      const filters = {
        status: req.query.status,
        from_date: req.query.from_date,
        to_date: req.query.to_date,
        limit: parseInt(req.query.limit) || 50
      };

      // Get invoices with payment details
      const invoices = await paymentService.getInvoices(userId, filters);

      return ResponseUtil.success(
        res,
        {
          payments: invoices.filter(inv => inv.status === 'paid'),
          count: invoices.filter(inv => inv.status === 'paid').length
        },
        'Payment history retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== REFUNDS ====================

  async requestRefund(req, res, next) {
    try {
      const userId = req.user.user_id;
      const refundData = {
        ...req.body,
        requested_by: userId
      };

      const refund = await paymentService.requestRefund(refundData);

      // Audit log
      await auditUtil.log({
        user_id: userId,
        action: 'create',
        entity_type: 'refund',
        entity_id: refund.refund_id,
        changes_summary: `Refund of ₹${refund.refund_amount} requested`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return ResponseUtil.success(
        res,
        refund,
        'Refund request submitted successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async getRefunds(req, res, next) {
    try {
      const userId = req.user.user_id;
      const filters = {
        status: req.query.status
      };

      const refunds = await paymentService.getRefunds(userId, filters);

      return ResponseUtil.success(
        res,
        {
          refunds,
          count: refunds.length
        },
        'Refunds retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getRefund(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { refund_id } = req.params;

      const refunds = await paymentService.getRefunds(userId, {});
      const refund = refunds.find(r => r.refund_id === refund_id);

      if (!refund) {
        return ResponseUtil.error(res, 'Refund not found', 404);
      }

      return ResponseUtil.success(
        res,
        refund,
        'Refund details retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ==================== PAYMENT GATEWAY WEBHOOKS ====================

  async handleRazorpayWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const payload = req.body;

      // Verify webhook signature
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        return ResponseUtil.error(res, 'Invalid webhook signature', 400);
      }

      // Handle different webhook events
      const { event, payload: eventPayload } = payload;

      switch (event) {
        case 'payment.captured':
          // Handle successful payment
          await this._handlePaymentCaptured(eventPayload.payment.entity);
          break;

        case 'payment.failed':
          // Handle failed payment
          await this._handlePaymentFailed(eventPayload.payment.entity);
          break;

        case 'refund.processed':
          // Handle processed refund
          await this._handleRefundProcessed(eventPayload.refund.entity);
          break;

        default:
          console.log('Unhandled webhook event:', event);
      }

      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      console.error('Webhook error:', error);
      next(error);
    }
  }

  async _handlePaymentCaptured(paymentEntity) {
    // Update payment status in database
    const { pool } = require('../config/database');
    
    await pool.query(
      `UPDATE payments 
       SET status = 'success', payment_date = NOW() 
       WHERE transaction_id = $1`,
      [paymentEntity.id]
    );

    // Update invoice
    const payment = await pool.query(
      'SELECT invoice_id FROM payments WHERE transaction_id = $1',
      [paymentEntity.id]
    );

    if (payment.rows.length > 0) {
      await pool.query(
        `UPDATE invoices 
         SET status = 'paid', paid_at = NOW() 
         WHERE invoice_id = $1`,
        [payment.rows[0].invoice_id]
      );
    }
  }

  async _handlePaymentFailed(paymentEntity) {
    const { pool } = require('../config/database');
    
    await pool.query(
      `UPDATE payments 
       SET status = 'failed', failure_reason = $1 
       WHERE transaction_id = $2`,
      [paymentEntity.error_description, paymentEntity.id]
    );
  }

  async _handleRefundProcessed(refundEntity) {
    const { pool } = require('../config/database');
    
    await pool.query(
      `UPDATE refunds 
       SET status = 'processed', processed_at = NOW() 
       WHERE gateway_refund_id = $1`,
      [refundEntity.id]
    );
  }
}

module.exports = new PaymentController();