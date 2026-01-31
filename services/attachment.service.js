const { pool } = require('../config/database');
const { deleteFile } = require('./s3-upload.service');

class AttachmentService {
  /**
   * Record a new upload in the database
   */
  async recordUpload(data) {
    const { s3_key, url, size, mimetype } = data;
    
    const query = `
      INSERT INTO attachments (s3_key, url, size, mimetype, is_permanent)
      VALUES ($1, $2, $3, $4, FALSE)
      RETURNING *
    `;
    
    const result = await pool.query(query, [s3_key, url, size, mimetype]);
    return result.rows[0];
  }

  /**
   * Mark a file as permanent so it doesn't get cleaned up
   */
  async markPermanent(urls) {
    if (!urls) return;
    
    const urlList = Array.isArray(urls) ? urls : [urls];
    if (urlList.length === 0) return;

    const query = `
      UPDATE attachments 
      SET is_permanent = TRUE, updated_at = NOW()
      WHERE url = ANY($1)
    `;
    
    await pool.query(query, [urlList]);
  }

  /**
   * Cleanup orphan files that are not marked as permanent and are older than 24h
   */
  async cleanupOrphans() {
    // Find files that are NOT permanent and older than 24 hours
    const query = `
      SELECT attachment_id, s3_key, url 
      FROM attachments 
      WHERE is_permanent = FALSE 
      AND created_at < NOW() - INTERVAL '24 hours'
    `;
    
    const result = await pool.query(query);
    const orphans = result.rows;
    
    console.log(`[Cleanup] Found ${orphans.length} orphan attachments to delete.`);
    
    for (const orphan of orphans) {
      try {
        console.log(`[Cleanup] Deleting orphan file: ${orphan.s3_key}`);
        
        // 1. Delete from S3
        await deleteFile(orphan.url);
        
        // 2. Delete from Database
        await pool.query('DELETE FROM attachments WHERE attachment_id = $1', [orphan.attachment_id]);
        
      } catch (error) {
        console.error(`[Cleanup] Failed to delete orphan ${orphan.attachment_id}:`, error);
      }
    }
    
    return {
      deletedCount: orphans.length
    };
  }
}

module.exports = new AttachmentService();
