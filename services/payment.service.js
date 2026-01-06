// ============================================
// FILE: services/payment.service.js
// Payment Service - Handles all payment operations
// ============================================

const { pool, transaction } = require('../config/database');
const { AppError } = require('../utils/response.util');
const { v4: uuidv4 } = require('uuid');
const EncryptionUtil = require('../utils/encryption.util');

class PaymentService {
  // ==================== PAYMENT METHODS ====================

  async getPaymentMethods(userId) {
    const query = `
      SELECT 
        pm.method_id,
        pm.method_type,
        pm.provider,
        pm.card_brand,
        pm.last_four,
        pm.expiry_month,
        pm.expiry_year,
        pm.cardholder_name,
        pm.is_default,
        pm.is_verified,
        pm.created_at
      FROM payment_methods pm
      WHERE pm.user_id = $1 AND pm.is_active = true
      ORDER BY pm.is_default DESC, pm.created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async getPaymentMethodById(methodId, userId) {
    const query = `
      SELECT 
        pm.*,
        ua.address_line1,
        ua.city,
        ua.state,
        ua.pincode
      FROM payment_methods pm
      LEFT JOIN user_addresses ua ON pm.billing_address_id = ua.address_id
      WHERE pm.method_id = $1 AND pm.user_id = $2 AND pm.is_active = true
    `;

    const result = await pool.query(query, [methodId, userId]);

    if (result.rows.length === 0) {
      throw new AppError('Payment method not found', 404, 'PAYMENT_METHOD_NOT_FOUND');
    }

    return result.rows[0];
  }

  async addPaymentMethod(userId, methodData) {
    return transaction(async (client) => {
      // Check payment method limit
      const countResult = await client.query(
        'SELECT COUNT(*) as count FROM payment_methods WHERE user_id = $1 AND is_active = true',
        [userId]
      );

      const methodCount = parseInt(countResult.rows[0].count);
      const maxMethods = 5;

      if (methodCount >= maxMethods) {
        throw new AppError(
          `Maximum ${maxMethods} payment methods allowed`,
          400,
          'MAX_PAYMENT_METHODS_REACHED'
        );
      }

      // If this is first method or explicitly set as default, make it default
      const isDefault = methodCount === 0 || methodData.is_default === true;

      // If setting as default, unset other defaults
      if (isDefault) {
        await client.query(
          'UPDATE payment_methods SET is_default = false WHERE user_id = $1',
          [userId]
        );
      }

      // Encrypt token
      const encryptedToken = methodData.token 
        ? await EncryptionUtil.encrypt(methodData.token)
        : null;

      const query = `
        INSERT INTO payment_methods (
          method_id, user_id, method_type, provider, token,
          card_brand, last_four, expiry_month, expiry_year,
          cardholder_name, billing_address_id, is_default, is_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING method_id, method_type, provider, card_brand, last_four, 
                  expiry_month, expiry_year, is_default, is_verified
      `;

      const values = [
        uuidv4(),
        userId,
        methodData.method_type,
        methodData.provider,
        encryptedToken,
        methodData.card_brand || null,
        methodData.last_four || null,
        methodData.expiry_month || null,
        methodData.expiry_year || null,
        methodData.cardholder_name || null,
        methodData.billing_address_id || null,
        isDefault,
        methodData.is_verified || false
      ];

      const result = await client.query(query, values);
      return result.rows[0];
    });
  }

  async setDefaultPaymentMethod(methodId, userId) {
    return transaction(async (client) => {
      // Verify ownership
      await this.getPaymentMethodById(methodId, userId);

      // Unset all defaults
      await client.query(
        'UPDATE payment_methods SET is_default = false WHERE user_id = $1',
        [userId]
      );

      // Set this as default
      const result = await client.query(
        `UPDATE payment_methods 
         SET is_default = true, updated_at = NOW()
         WHERE method_id = $1 AND user_id = $2
         RETURNING *`,
        [methodId, userId]
      );

      return result.rows[0];
    });
  }

  async deletePaymentMethod(methodId, userId) {
    return transaction(async (client) => {
      // Verify ownership
      const method = await this.getPaymentMethodById(methodId, userId);

      // Check if it's the only payment method
      const countResult = await client.query(
        'SELECT COUNT(*) as count FROM payment_methods WHERE user_id = $1 AND is_active = true',
        [userId]
      );

      if (parseInt(countResult.rows[0].count) === 1) {
        throw new AppError(
          'Cannot delete the only payment method',
          400,
          'CANNOT_DELETE_ONLY_METHOD'
        );
      }

      // Soft delete
      await client.query(
        'UPDATE payment_methods SET is_active = false WHERE method_id = $1',
        [methodId]
      );

      // If this was default, set another as default
      if (method.is_default) {
        await client.query(
          `UPDATE payment_methods
           SET is_default = true
           WHERE method_id = (
             SELECT method_id
             FROM payment_methods
             WHERE user_id = $1 AND is_active = true
             ORDER BY created_at DESC
             LIMIT 1
           )`,
          [userId]
        );
      }

      return true;
    });
  }

  // ==================== INVOICES ====================

  async getInvoices(userId, filters = {}) {
    let query = `
      SELECT 
        i.*,
        COALESCE(s.subscription_id, b.booking_id) as related_entity_id,
        CASE 
          WHEN s.subscription_id IS NOT NULL THEN 'subscription'
          WHEN b.booking_id IS NOT NULL THEN 'booking'
          ELSE 'other'
        END as entity_type
      FROM invoices i
      LEFT JOIN subscriptions s ON i.subscription_id = s.subscription_id
      LEFT JOIN bookings b ON i.booking_id = b.booking_id
      WHERE i.user_id = $1
    `;

    const values = [userId];
    let paramCount = 2;

    if (filters.status) {
      query += ` AND i.status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.invoice_type) {
      query += ` AND i.invoice_type = $${paramCount}`;
      values.push(filters.invoice_type);
      paramCount++;
    }

    if (filters.from_date) {
      query += ` AND i.created_at >= $${paramCount}`;
      values.push(filters.from_date);
      paramCount++;
    }

    if (filters.to_date) {
      query += ` AND i.created_at <= $${paramCount}`;
      values.push(filters.to_date);
      paramCount++;
    }

    query += ` ORDER BY i.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
      paramCount++;
    }

    const result = await pool.query(query, values);
    return result.rows;
  }

  async getInvoiceById(invoiceId, userId, client = pool) {
    const query = `
      SELECT 
        i.*,
        json_agg(
          json_build_object(
            'line_item_id', li.line_item_id,
            'item_type', li.item_type,
            'description', li.description,
            'quantity', li.quantity,
            'unit_price', li.unit_price,
            'total_price', li.total_price,
            'tax_applicable', li.tax_applicable
          )
        ) FILTER (WHERE li.line_item_id IS NOT NULL) as line_items
      FROM invoices i
      LEFT JOIN invoice_line_items li ON i.invoice_id = li.invoice_id
      WHERE i.invoice_id = $1 AND i.user_id = $2
      GROUP BY i.invoice_id
    `;

    const result = await client.query(query, [invoiceId, userId]);

    if (result.rows.length === 0) {
      throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    return result.rows[0];
  }

  async createInvoice(invoiceData, client = null) {
    if (client) {
      return this._createInvoiceInternal(client, invoiceData);
    }
    return transaction(async (newClient) => {
      return this._createInvoiceInternal(newClient, invoiceData);
    });
  }

  async _createInvoiceInternal(client, invoiceData) {
      // Generate invoice number
      const invoiceNumber = await this._generateInvoiceNumber(client);

      // Calculate amounts
      const subtotal = invoiceData.line_items.reduce(
        (sum, item) => sum + (item.unit_price * item.quantity),
        0
      );

      const taxAmount = (subtotal * (invoiceData.tax_percentage || 18)) / 100;
      const discountAmount = invoiceData.discount_amount || 0;
      const totalAmount = subtotal + taxAmount - discountAmount;

      // Insert invoice
      const invoiceQuery = `
        INSERT INTO invoices (
          invoice_id, user_id, subscription_id, booking_id,
          invoice_number, invoice_type, subtotal, tax_percentage,
          tax_amount, discount_percentage, discount_amount,
          total_amount, currency, status, due_date, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;

      const invoiceValues = [
        uuidv4(),
        invoiceData.user_id,
        invoiceData.subscription_id || null,
        invoiceData.booking_id || null,
        invoiceNumber,
        invoiceData.invoice_type,
        subtotal,
        invoiceData.tax_percentage || 18,
        taxAmount,
        invoiceData.discount_percentage || 0,
        discountAmount,
        totalAmount,
        'INR',
        'pending',
        invoiceData.due_date || new Date(),
        invoiceData.notes || null
      ];

      const invoiceResult = await client.query(invoiceQuery, invoiceValues);
      const invoice = invoiceResult.rows[0];

      // Insert line items
      for (const item of invoiceData.line_items) {
        await client.query(
          `INSERT INTO invoice_line_items (
            line_item_id, invoice_id, item_type, description,
            quantity, unit_price, total_price, tax_applicable
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            uuidv4(),
            invoice.invoice_id,
            item.item_type,
            item.description,
            item.quantity,
            item.unit_price,
            item.unit_price * item.quantity,
            item.tax_applicable !== false
          ]
        );
      }

      // Fetch complete invoice with line items
      return this.getInvoiceById(invoice.invoice_id, invoiceData.user_id, client);
  }

  async _generateInvoiceNumber(client) {
    const prefix = 'INV';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Get count for this month
    const countResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM invoices 
       WHERE invoice_number LIKE $1`,
      [`${prefix}-${year}${month}%`]
    );

    const count = parseInt(countResult.rows[0].count) + 1;
    const sequence = String(count).padStart(5, '0');

    return `${prefix}-${year}${month}-${sequence}`;
  }

  // ==================== PAYMENTS ====================

  async processPayment(paymentData) {
    return transaction(async (client) => {
      // Get invoice
      const invoiceResult = await client.query(
        'SELECT * FROM invoices WHERE invoice_id = $1 AND user_id = $2',
        [paymentData.invoice_id, paymentData.user_id]
      );

      if (invoiceResult.rows.length === 0) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
      }

      const invoice = invoiceResult.rows[0];

      if (invoice.status === 'paid') {
        throw new AppError('Invoice already paid', 400, 'INVOICE_ALREADY_PAID');
      }

      // Get payment method if provided
      let paymentMethod = null;
      if (paymentData.payment_method_id) {
        const methodResult = await client.query(
          'SELECT * FROM payment_methods WHERE method_id = $1 AND user_id = $2 AND is_active = true',
          [paymentData.payment_method_id, paymentData.user_id]
        );

        if (methodResult.rows.length === 0) {
          throw new AppError('Payment method not found', 404, 'PAYMENT_METHOD_NOT_FOUND');
        }

        paymentMethod = methodResult.rows[0];
      }

      // Initialize payment gateway based on provider
      const gateway = paymentData.payment_gateway || 'razorpay';
      let gatewayResponse;

      try {
        if (gateway === 'razorpay') {
          gatewayResponse = await this._processRazorpayPayment(
            invoice,
            paymentMethod,
            paymentData
          );
        } else if (gateway === 'stripe') {
          gatewayResponse = await this._processStripePayment(
            invoice,
            paymentMethod,
            paymentData
          );
        } else {
          throw new AppError('Unsupported payment gateway', 400, 'UNSUPPORTED_GATEWAY');
        }

        // Create payment record
        const paymentQuery = `
          INSERT INTO payments (
            payment_id, invoice_id, user_id, payment_method_id,
            amount, currency, status, payment_gateway,
            transaction_id, gateway_order_id, gateway_response,
            payment_method_used, payment_date, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING *
        `;

        const paymentValues = [
          uuidv4(),
          invoice.invoice_id,
          paymentData.user_id,
          paymentData.payment_method_id || null,
          invoice.total_amount,
          'INR',
          gatewayResponse.status,
          gateway,
          gatewayResponse.transaction_id,
          gatewayResponse.order_id,
          JSON.stringify(gatewayResponse),
          paymentData.payment_method_used || paymentMethod?.method_type,
          gatewayResponse.status === 'success' ? new Date() : null,
          paymentData.ip_address,
          paymentData.user_agent
        ];

        const paymentResult = await client.query(paymentQuery, paymentValues);

        // Update invoice status if payment successful
        if (gatewayResponse.status === 'success') {
          await client.query(
            `UPDATE invoices 
             SET status = 'paid', paid_at = NOW() 
             WHERE invoice_id = $1`,
            [invoice.invoice_id]
          );

          // Update related booking/subscription if applicable
          if (invoice.booking_id) {
            await client.query(
              `UPDATE bookings 
               SET payment_status = 'paid' 
               WHERE booking_id = $1`,
              [invoice.booking_id]
            );
          }
        }

        return {
          payment: paymentResult.rows[0],
          gateway_response: gatewayResponse
        };

      } catch (error) {
        // Log failed payment attempt
        await client.query(
          `INSERT INTO payments (
            payment_id, invoice_id, user_id, payment_method_id,
            amount, currency, status, payment_gateway,
            failure_reason, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            uuidv4(),
            invoice.invoice_id,
            paymentData.user_id,
            paymentData.payment_method_id || null,
            invoice.total_amount,
            'INR',
            'failed',
            gateway,
            error.message,
            paymentData.ip_address,
            paymentData.user_agent
          ]
        );

        throw new AppError(
          'Payment processing failed: ' + error.message,
          400,
          'PAYMENT_FAILED'
        );
      }
    });
  }

  async _processRazorpayPayment(invoice, paymentMethod, paymentData) {
    // Simulated Razorpay integration
    // In production, use actual Razorpay SDK
    
    // For development/testing
    if (process.env.NODE_ENV !== 'production') {
      return {
        status: 'success',
        transaction_id: `txn_${Date.now()}`,
        order_id: `order_${Date.now()}`,
        amount: invoice.total_amount,
        currency: 'INR',
        method: paymentMethod?.method_type || 'upi'
      };
    }

    // Production Razorpay integration would go here
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create({
      amount: Math.round(invoice.total_amount * 100), // Convert to paise
      currency: 'INR',
      receipt: invoice.invoice_number,
      notes: {
        invoice_id: invoice.invoice_id,
        user_id: invoice.user_id
      }
    });

    return {
      status: 'pending',
      order_id: order.id,
      amount: invoice.total_amount,
      currency: 'INR'
    };
  }

  async _processStripePayment(invoice, paymentMethod, paymentData) {
    // Stripe integration placeholder
    throw new AppError('Stripe integration not implemented', 501, 'NOT_IMPLEMENTED');
  }

  async verifyPayment(paymentId, verificationData) {
    return transaction(async (client) => {
      const payment = await client.query(
        'SELECT * FROM payments WHERE payment_id = $1',
        [paymentId]
      );

      if (payment.rows.length === 0) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }

      const paymentRecord = payment.rows[0];

      // Verify with payment gateway
      let verified = false;

      if (paymentRecord.payment_gateway === 'razorpay') {
        verified = await this._verifyRazorpayPayment(verificationData);
      }

      if (verified) {
        await client.query(
          `UPDATE payments 
           SET status = 'success', payment_date = NOW() 
           WHERE payment_id = $1`,
          [paymentId]
        );

        await client.query(
          `UPDATE invoices 
           SET status = 'paid', paid_at = NOW() 
           WHERE invoice_id = $1`,
          [paymentRecord.invoice_id]
        );

        return { verified: true, status: 'success' };
      }

      return { verified: false, status: 'failed' };
    });
  }

  async _verifyRazorpayPayment(verificationData) {
    // Verify Razorpay payment signature
    const crypto = require('crypto');
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${verificationData.order_id}|${verificationData.payment_id}`)
      .digest('hex');

    return expectedSignature === verificationData.signature;
  }

  // ==================== REFUNDS ====================

  async requestRefund(refundData) {
    return transaction(async (client) => {
      // Get payment
      const paymentResult = await client.query(
        'SELECT * FROM payments WHERE payment_id = $1',
        [refundData.payment_id]
      );

      if (paymentResult.rows.length === 0) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }

      const payment = paymentResult.rows[0];

      if (payment.status !== 'success') {
        throw new AppError('Cannot refund unsuccessful payment', 400, 'INVALID_PAYMENT_STATUS');
      }

      // Check if already refunded
      const existingRefund = await client.query(
        'SELECT * FROM refunds WHERE payment_id = $1 AND status IN ($2, $3)',
        [payment.payment_id, 'approved', 'processed']
      );

      if (existingRefund.rows.length > 0) {
        throw new AppError('Refund already processed', 400, 'REFUND_ALREADY_EXISTS');
      }

      // Validate refund amount
      if (refundData.refund_amount > payment.amount) {
        throw new AppError('Refund amount exceeds payment amount', 400, 'INVALID_REFUND_AMOUNT');
      }

      // Create refund request
      const refundQuery = `
        INSERT INTO refunds (
          refund_id, payment_id, invoice_id, booking_id,
          refund_amount, refund_type, reason, detailed_reason,
          status, refund_method, processing_fee, net_refund_amount,
          requested_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const processingFee = 0; // Calculate based on business rules
      const netRefundAmount = refundData.refund_amount - processingFee;

      const refundValues = [
        uuidv4(),
        payment.payment_id,
        payment.invoice_id,
        refundData.booking_id || null,
        refundData.refund_amount,
        refundData.refund_type || 'full',
        refundData.reason,
        refundData.detailed_reason || null,
        'pending',
        'original_source',
        processingFee,
        netRefundAmount,
        refundData.requested_by
      ];

      const result = await client.query(refundQuery, refundValues);
      return result.rows[0];
    });
  }

  async processRefund(refundId, adminId) {
    return transaction(async (client) => {
      // Get refund
      const refundResult = await client.query(
        'SELECT * FROM refunds WHERE refund_id = $1',
        [refundId]
      );

      if (refundResult.rows.length === 0) {
        throw new AppError('Refund not found', 404, 'REFUND_NOT_FOUND');
      }

      const refund = refundResult.rows[0];

      if (refund.status !== 'approved') {
        throw new AppError('Refund not approved', 400, 'REFUND_NOT_APPROVED');
      }

      // Get payment details
      const payment = await client.query(
        'SELECT * FROM payments WHERE payment_id = $1',
        [refund.payment_id]
      );

      const paymentRecord = payment.rows[0];

      // Process refund through gateway
      let gatewayRefundId;

      try {
        if (paymentRecord.payment_gateway === 'razorpay') {
          gatewayRefundId = await this._processRazorpayRefund(
            paymentRecord.transaction_id,
            refund.net_refund_amount
          );
        }

        // Update refund status
        await client.query(
          `UPDATE refunds 
           SET status = 'processed', 
               gateway_refund_id = $1,
               processed_at = NOW(),
               expected_date = NOW() + INTERVAL '5 days'
           WHERE refund_id = $2`,
          [gatewayRefundId, refundId]
        );

        // Update payment status
        await client.query(
          `UPDATE payments 
           SET status = 'refunded' 
           WHERE payment_id = $1`,
          [refund.payment_id]
        );

        // Update invoice status
        await client.query(
          `UPDATE invoices 
           SET status = 'refunded' 
           WHERE invoice_id = $1`,
          [refund.invoice_id]
        );

        return { success: true, gateway_refund_id: gatewayRefundId };

      } catch (error) {
        await client.query(
          `UPDATE refunds 
           SET status = 'failed', 
               notes = $1
           WHERE refund_id = $2`,
          [error.message, refundId]
        );

        throw new AppError('Refund processing failed', 400, 'REFUND_FAILED');
      }
    });
  }

  async _processRazorpayRefund(transactionId, amount) {
    // Simulated refund for development
    if (process.env.NODE_ENV !== 'production') {
      return `rfnd_${Date.now()}`;
    }

    // Production Razorpay refund
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const refund = await razorpay.payments.refund(transactionId, {
      amount: Math.round(amount * 100) // Convert to paise
    });

    return refund.id;
  }

  async getRefunds(userId, filters = {}) {
    let query = `
      SELECT 
        r.*,
        p.amount as payment_amount,
        p.transaction_id,
        i.invoice_number
      FROM refunds r
      JOIN payments p ON r.payment_id = p.payment_id
      JOIN invoices i ON r.invoice_id = i.invoice_id
      WHERE i.user_id = $1
    `;

    const values = [userId];
    let paramCount = 2;

    if (filters.status) {
      query += ` AND r.status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    query += ` ORDER BY r.created_at DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  }
}

module.exports = new PaymentService();