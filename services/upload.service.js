// ============================================
// FILE: services/upload.service.js
// Complete Upload Service (Updated)
// ============================================

const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs").promises;
const uploadConfig = require("../config/upload.config");

class UploadService {
  constructor() {
    // Directory paths
    this.uploadDir = path.join(__dirname, "..", "uploads", "profile-photos");
    this.petUploadDir = path.join(__dirname, "..", "uploads", "pet-photos");
    this.ticketUploadDir = path.join(__dirname, "..", "uploads", "ticket-attachments");

    // Base URLs for accessing files
    this.baseUrl =
      process.env.CDN_BASE_URL ||
      "http://localhost:3000/uploads/profile-photos";
    this.petBaseUrl =
      process.env.PET_CDN_BASE_URL ||
      "http://localhost:3000/uploads/pet-photos";
    this.ticketBaseUrl =
      process.env.TICKET_CDN_BASE_URL ||
      "http://localhost:3000/uploads/ticket-attachments";

    // Ensure upload directories exist
    this.ensureUploadDir();
  }

  async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.petUploadDir, { recursive: true });
      await fs.mkdir(this.ticketUploadDir, { recursive: true });
    } catch (error) {
      console.error("Error creating upload directory:", error);
    }
  }

  // ==================== PROFILE PHOTOS ====================

  async uploadProfilePhoto(file, userId) {
    try {
      // Generate unique filename
      const filename = `${userId}-${uuidv4()}.jpg`;
      const filepath = path.join(this.uploadDir, filename);

      // Process image with sharp (resize, compress)
      await sharp(file.buffer)
        .resize(uploadConfig.imageSize.width, uploadConfig.imageSize.height, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: uploadConfig.quality })
        .toFile(filepath);

      // Return public URL
      const photoUrl = `${this.baseUrl}/${filename}`;
      return photoUrl;
    } catch (error) {
      console.error("Error uploading profile photo:", error);
      throw new Error("Failed to upload profile photo");
    }
  }

  async deleteProfilePhoto(photoUrl) {
    try {
      // Extract filename from URL
      const filename = photoUrl.split("/").pop();
      const filepath = path.join(this.uploadDir, filename);
      // Delete file
      await fs.unlink(filepath);
      return true;
    } catch (error) {
      console.error("Error deleting profile photo:", error);
      // Don't throw error, just log
      return false;
    }
  }

  // ==================== PET PHOTOS ====================

  async uploadPetPhoto(file, petId) {
    try {
      // Generate unique filename
      const filename = `pet-${petId}-${uuidv4()}.jpg`;
      const filepath = path.join(this.petUploadDir, filename);

      // Process image with sharp (resize, compress)
      await sharp(file.buffer)
        .resize(
          uploadConfig.petImageSize.width,
          uploadConfig.petImageSize.height,
          {
            fit: "cover",
            position: "center",
          }
        )
        .jpeg({ quality: uploadConfig.quality })
        .toFile(filepath);

      // Return public URL
      const photoUrl = `${this.petBaseUrl}/${filename}`;
      return photoUrl;
    } catch (error) {
      console.error("Error uploading pet photo:", error);
      throw new Error("Failed to upload pet photo");
    }
  }

  async deletePetPhoto(photoUrl) {
    try {
      // Extract filename from URL
      const filename = photoUrl.split("/").pop();
      const filepath = path.join(this.petUploadDir, filename);
      // Delete file
      await fs.unlink(filepath);
      return true;
    } catch (error) {
      console.error("Error deleting pet photo:", error);
      // Don't throw error, just log
      return false;
    }
  }

  // ==================== TICKET ATTACHMENTS (NEW) ====================

  async uploadTicketAttachment(file, userId) {
    try {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      const filename = `ticket-${userId}-${uuidv4()}${fileExtension}`;
      const filepath = path.join(this.ticketUploadDir, filename);

      // Check if file is an image
      const isImage = file.mimetype.startsWith("image/");

      if (isImage) {
        // Process images: resize and compress
        await sharp(file.buffer)
          .resize(2000, 2000, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toFile(filepath);
      } else {
        // For non-images (PDF, Word, Excel), save as-is
        await fs.writeFile(filepath, file.buffer);
      }

      // Return public URL
      const attachmentUrl = `${this.ticketBaseUrl}/${filename}`;
      return attachmentUrl;
    } catch (error) {
      console.error("Error uploading ticket attachment:", error);
      throw new Error("Failed to upload ticket attachment");
    }
  }

  async deleteTicketAttachment(attachmentUrl) {
    try {
      // Extract filename from URL
      const filename = attachmentUrl.split("/").pop();
      const filepath = path.join(this.ticketUploadDir, filename);
      // Delete file
      await fs.unlink(filepath);
      return true;
    } catch (error) {
      console.error("Error deleting ticket attachment:", error);
      // Don't throw error, just log
      return false;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get file size in a human-readable format
   */
  getFileSizeString(bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
  }

  /**
   * Validate file type
   */
  isValidFileType(mimetype, allowedTypes) {
    return allowedTypes.includes(mimetype);
  }

  /**
   * Clean up old files (can be run as a cron job)
   */
  async cleanupOldFiles(directory, daysOld = 90) {
    try {
      const files = await fs.readdir(directory);
      const now = Date.now();
      const maxAge = daysOld * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filepath = path.join(directory, file);
        const stats = await fs.stat(filepath);
        const age = now - stats.mtime.getTime();

        if (age > maxAge) {
          await fs.unlink(filepath);
          console.log(`Deleted old file: ${file}`);
        }
      }

      return true;
    } catch (error) {
      console.error("Error cleaning up old files:", error);
      return false;
    }
  }
}

module.exports = new UploadService();