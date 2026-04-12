// ============================================
// FILE: services/product.service.js
// Product Business Logic & Data Access
// ============================================

const { query, pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new product
 */
async function createProduct(productData) {
  const { name, description, price, company_name, photo_url } = productData;
  const productId = uuidv4();

  const sql = `
    INSERT INTO products (
      product_id, name, description, price, company_name, photo_url
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  const result = await query(sql, [productId, name, description, price, company_name, photo_url]);
  return result.rows[0];
}

/**
 * Get all products with pagination and filtering
 */
async function getAllProducts(filters = {}) {
  const { is_active, search, limit = 10, offset = 0 } = filters;
  
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (is_active !== undefined) {
    params.push(is_active);
    sql += ` AND is_active = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (name ILIKE $${params.length} OR company_name ILIKE $${params.length})`;
  }

  // Count total for pagination
  const countSql = `SELECT COUNT(*) FROM (${sql}) as total`;
  const countResult = await query(countSql, params);
  const total = parseInt(countResult.rows[0].count);

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(sql, params);

  return {
    products: result.rows,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      has_more: offset + result.rows.length < total
    }
  };
}

/**
 * Get product by ID
 */
async function getProductById(productId) {
  const sql = 'SELECT * FROM products WHERE product_id = $1';
  const result = await query(sql, [productId]);
  return result.rows[0];
}

/**
 * Update a product
 */
async function updateProduct(productId, updateData) {
  const fields = [];
  const params = [productId];
  let paramIndex = 2;

  for (const [key, value] of Object.entries(updateData)) {
    if (['name', 'description', 'price', 'company_name', 'photo_url', 'is_active'].includes(key)) {
      fields.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return null;

  const sql = `
    UPDATE products 
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE product_id = $1
    RETURNING *;
  `;

  const result = await query(sql, params);
  return result.rows[0];
}

/**
 * Delete a product (soft delete or hard delete based on preference, here hard delete)
 */
async function deleteProduct(productId) {
  const sql = 'DELETE FROM products WHERE product_id = $1 RETURNING *;';
  const result = await query(sql, [productId]);
  return result.rows[0];
}

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
