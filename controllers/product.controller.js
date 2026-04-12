// ============================================
// FILE: controllers/product.controller.js
// Product HTTP Request Handler
// ============================================

const productService = require('../services/product.service');
const ResponseUtil = require('../utils/response.util');
const auditUtil = require('../utils/audit.util');
const { upload } = require('../services/s3-upload.service');

class ProductController {
  /**
   * Get all products
   */
  async getAllProducts(req, res, next) {
    try {
      const { is_active, search, limit, offset } = req.query;
      const result = await productService.getAllProducts({ is_active, search, limit, offset });
      return ResponseUtil.success(res, result, 'Products retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product by ID
   */
  async getProduct(req, res, next) {
    try {
      const { product_id } = req.params;
      const product = await productService.getProductById(product_id);
      
      if (!product) {
        return ResponseUtil.error(res, 'Product not found', 404);
      }

      return ResponseUtil.success(res, product, 'Product retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new product
   */
  async createProduct(req, res, next) {
    try {
      const productData = req.body;
      
      // If a file was uploaded, add its URL to productData
      if (req.file) {
        productData.photo_url = req.file.location;
      }

      const product = await productService.createProduct(productData);

      await auditUtil.log({
        user_id: req.user.user_id,
        action: 'create',
        entity_type: 'product',
        entity_id: product.product_id,
        new_value: product,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      return ResponseUtil.success(res, product, 'Product created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a product
   */
  async updateProduct(req, res, next) {
    try {
      const { product_id } = req.params;
      const updateData = req.body;

      // If a new file was uploaded, add its URL to updateData
      if (req.file) {
        updateData.photo_url = req.file.location;
      }

      const product = await productService.updateProduct(product_id, updateData);

      if (!product) {
        return ResponseUtil.error(res, 'Product not found', 404);
      }

      await auditUtil.log({
        user_id: req.user.user_id,
        action: 'update',
        entity_type: 'product',
        entity_id: product_id,
        new_value: product,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      return ResponseUtil.success(res, product, 'Product updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a product
   */
  async deleteProduct(req, res, next) {
    try {
      const { product_id } = req.params;
      const product = await productService.deleteProduct(product_id);

      if (!product) {
        return ResponseUtil.error(res, 'Product not found', 404);
      }

      await auditUtil.log({
        user_id: req.user.user_id,
        action: 'delete',
        entity_type: 'product',
        entity_id: product_id,
        changes_summary: 'Product deleted',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      return ResponseUtil.success(res, null, 'Product deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
