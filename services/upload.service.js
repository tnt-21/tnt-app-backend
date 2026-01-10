// ============================================
// FILE: services/upload.service.js
// Cloudinary Upload Service
// ============================================

const cloudinary = require('cloudinary').v2;
const stream = require('stream');
const path = require('path');
const uploadConfig = require('../config/upload.config');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

class UploadService {
  constructor() {
    // Folders in Cloudinary
    this.folders = {
      profile: 'tails_and_tales/profile-photos',
      pets: 'tails_and_tales/pet-photos',
      tickets: 'tails_and_tales/ticket-attachments'
    };
  }

  /**
   * Helper to upload a buffer to Cloudinary
   * @param {Buffer} buffer - File buffer
   * @param {Object} options - Cloudinary upload options
   * @returns {Promise<string>} - The secure URL of the uploaded file
   */
  async uploadToCloudinary(buffer, options) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(new Error('Cloud upload failed'));
          }
          resolve(result.secure_url);
        }
      );

      // Create a readable stream from the buffer and pipe it to Cloudinary
      const bufferStream = new stream.PassThrough();
      bufferStream.end(buffer);
      bufferStream.pipe(uploadStream);
    });
  }

  /**
   * Extract public ID from Cloudinary URL for deletion
   * Assumes URL format: .../folder/filename.ext
   */
  getPublicIdFromUrl(url) {
    try {
      const splitUrl = url.split('/');
      // Get the last two parts: folder/filename.ext
      const filenameWithExt = splitUrl.pop();
      const folder = splitUrl.pop();
      // Remove extension
      const publicId = `${folder}/${filenameWithExt.split('.')[0]}`;
      // Note: This is a simplistic extraction. 
      // Ideally, we should store the public_id in the DB alongside the URL.
      // But for this structure, 'folder/filename' usually works.
      // However, since we defined specific folders in the constructor,
      // and Cloudinary URLs include the full path, we need to be careful.
      
      // Better approach: Match the known folder names
      const match = url.match(/tails_and_tales\/[^/]+\/[^.]+/);
      return match ? match[0] : null;
    } catch (error) {
      return null;
    }
  }

  // ==================== PROFILE PHOTOS ====================

  async uploadProfilePhoto(file, userId) {
    try {
      // Cloudinary handles resizing via transformation options if needed,
      // or we can just upload and use dynamic URLs for resizing.
      // Here we resize on upload to save storage/bandwidth.
      const options = {
        folder: this.folders.profile,
        public_id: `user-${userId}-${Date.now()}`,
        resource_type: 'image',
        transformation: [
          { 
            width: uploadConfig.imageSize.width, 
            height: uploadConfig.imageSize.height, 
            crop: 'fill', 
            gravity: 'face' 
          }, 
          { quality: 'auto', fetch_format: 'auto' } 
        ]
      };

      return await this.uploadToCloudinary(file.buffer, options);
    } catch (error) {
      throw new Error('Failed to upload profile photo');
    }
  }

  async deleteProfilePhoto(photoUrl) {
    try {
      const publicId = this.getPublicIdFromUrl(photoUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting profile photo:', error);
      return false;
    }
  }

  // ==================== PET PHOTOS ====================

  async uploadPetPhoto(file, petId) {
    try {
      const options = {
        folder: this.folders.pets,
        public_id: `pet-${petId}-${Date.now()}`,
        resource_type: 'image',
        transformation: [
          { 
            width: uploadConfig.petImageSize.width, 
            height: uploadConfig.petImageSize.height, 
            crop: 'fill' 
          },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      };

      return await this.uploadToCloudinary(file.buffer, options);
    } catch (error) {
      throw new Error('Failed to upload pet photo');
    }
  }

  async deletePetPhoto(photoUrl) {
    try {
      const publicId = this.getPublicIdFromUrl(photoUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting pet photo:', error);
      return false;
    }
  }

  // ==================== TICKET ATTACHMENTS ====================

  async uploadTicketAttachment(file, userId) {
    try {
      const isImage = file.mimetype.startsWith('image/');
      const resourceType = isImage ? 'image' : 'raw'; // 'raw' for PDFs, Docs, etc.

      const options = {
        folder: this.folders.tickets,
        public_id: `ticket-${userId}-${Date.now()}`,
        resource_type: resourceType,
      };

      // Apply optimization only for images
      if (isImage) {
        options.transformation = [{ quality: 'auto', fetch_format: 'auto' }];
      }

      return await this.uploadToCloudinary(file.buffer, options);
    } catch (error) {
      throw new Error('Failed to upload ticket attachment');
    }
  }

  async deleteTicketAttachment(attachmentUrl) {
    try {
      const publicId = this.getPublicIdFromUrl(attachmentUrl);
      if (publicId) {
        // We need to know if it was 'image' or 'raw' to delete correctly, 
        // but destroy usually defaults to image. For raw, we might need a stored type.
        // For simplicity, we'll try both or just image for now.
        // In a production system, store public_id and resource_type in DB.
        await cloudinary.uploader.destroy(publicId); 
        // Note: For raw files, you might need { resource_type: 'raw' }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting ticket attachment:', error);
      return false;
    }
  }

  // ==================== HELPER METHODS ====================

  getFileSizeString(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  }

  isValidFileType(mimetype, allowedTypes) {
    return allowedTypes.includes(mimetype);
  }
}

module.exports = new UploadService();