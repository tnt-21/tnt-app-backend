// ============================================
// FILE: routes/v1/product.routes.js
// Product API Routes
// ============================================

const express = require('express');
const router = express.Router();
const productController = require('../../controllers/product.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { upload } = require('../../services/s3-upload.service');

/**
 * Public/Protected Routes (depending on roles)
 * Let's assume anyone can view products, but only admin can manage.
 */

// GET all products - anyone can view? (Based on req, admin should be able to add/edit/delete)
// If it's for the admin dashboard, we can keep it protected.
router.get('/', authenticate, productController.getAllProducts);
router.get('/:product_id', authenticate, productController.getProduct);

/**
 * Admin only routes
 */
router.use(authenticate, authorize('admin', 'super_admin'));

// Create a new product
router.post('/', productController.createProduct);

// Update product
router.put('/:product_id', productController.updateProduct);

// Delete product
router.delete('/:product_id', productController.deleteProduct);

module.exports = router;
