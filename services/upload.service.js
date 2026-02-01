// ============================================
// FILE: services/upload.service.js
// S3 Upload Service (Consolidated)
// ============================================

const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3 } = require('../middlewares/upload.middleware'); // Re-use S3 instance from middleware

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'tnt-app-assets';

class UploadService {
  /**
   * Return the S3 URL of the uploaded file.
   * Since we use multer-s3 middleware, the file is already uploaded by the time
   * the controller calls this. We just need to extract the location.
   */
  async uploadProfilePhoto(file, userId) {
    if (!file || !file.location) {
      throw new Error('File upload failed');
    }
    return file.location;
  }

  async uploadPetPhoto(file, petId) {
    if (!file || !file.location) {
      throw new Error('File upload failed');
    }
    return file.location;
  }

  async uploadTicketAttachment(file, userId) {
    if (!file || !file.location) {
      throw new Error('File upload failed');
    }
    return file.location;
  }

  // ==================== DELETION ====================

  /**
   * Delete file from S3
   */
  async deleteFile(fileUrl) {
    try {
      if (!fileUrl) return false;

      // Extract key from URL
      // S3 URL format: https://bucket.s3.region.amazonaws.com/folder/filename
      // or https://s3.region.amazonaws.com/bucket/folder/filename
      
      const url = new URL(fileUrl);
      // Remove leading slash to get key
      const key = url.pathname.substring(1); 

      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3.send(command);
      return true;
    } catch (error) {
      console.error('S3 delete error:', error);
      // Don't throw, just return false, so we don't break the main flow if cleanup fails
      return false;
    }
  }

  // Aliases for compatibility with existing code
  async deleteProfilePhoto(photoUrl) {
    return this.deleteFile(photoUrl);
  }

  async deletePetPhoto(photoUrl) {
    return this.deleteFile(photoUrl);
  }
  
  async deleteTicketAttachment(attachmentUrl) {
    return this.deleteFile(attachmentUrl);
  }

  // ==================== HELPER METHODS ====================

  getFileSizeString(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  }
}

module.exports = new UploadService();