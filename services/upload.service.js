const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs").promises;

class UploadService {
  constructor() {
    // You can configure this for S3/CloudFront later
    this.uploadDir = path.join(__dirname, "..", "uploads", "profile-photos");
    this.baseUrl =
      process.env.CDN_BASE_URL ||
      "http://localhost:3000/uploads/profile-photos";

    // Ensure upload directory exists
    this.ensureUploadDir();
  }

  async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error("Error creating upload directory:", error);
    }
  }

  async uploadProfilePhoto(file, userId) {
    try {
      // Generate unique filename
      const filename = `${userId}-${uuidv4()}.jpg`;
      const filepath = path.join(this.uploadDir, filename);

      // Process image with sharp (resize, compress)
      await sharp(file.buffer)
        .resize(512, 512, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: 85 })
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
}
module.exports = new UploadService();
