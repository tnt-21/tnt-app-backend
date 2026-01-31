const { upload } = require('../services/s3-upload.service');
const attachmentService = require('../services/attachment.service');
const ResponseUtil = require('../utils/response.util');

class UploadController {
  /**
   * POST /upload/image
   * Upload single image to S3
   */
  uploadImage(req, res, next) {
    const uploadSingle = upload.single('file');

    uploadSingle(req, res, (err) => {
      if (err) {
        console.error('Multer/S3 Upload Error:', err);
        return ResponseUtil.error(res, err.message || 'Upload failed', 400);
      }

      if (!req.file) {
        console.error('Upload Error: No file in request');
        return ResponseUtil.error(res, 'No file uploaded', 400);
      }

      // Record upload in database for tracking/cleanup
      const fileData = {
        s3_key: req.file.key,
        url: req.file.location,
        size: req.file.size,
        mimetype: req.file.mimetype,
      };
      
      attachmentService.recordUpload(fileData).catch(err => {
        console.error('Failed to record upload in DB:', err);
      });

      return ResponseUtil.success(res, fileData, 'File uploaded successfully');
    });
  }

  /**
   * POST /upload/images
   * Upload multiple images to S3
   */
  uploadImages(req, res, next) {
    const uploadMultiple = upload.array('files', 10); // Max 10 files

    uploadMultiple(req, res, (err) => {
      if (err) {
        return ResponseUtil.error(res, err.message, 400);
      }

      if (!req.files || req.files.length === 0) {
        return ResponseUtil.error(res, 'No files uploaded', 400);
      }

      const files = req.files.map(file => ({
        url: file.location,
        key: file.key,
        size: file.size,
        mimetype: file.mimetype,
      }));

      // Record all uploads in database
      Promise.all(files.map(f => attachmentService.recordUpload({
        s3_key: f.key || new URL(f.url).pathname.substring(1),
        url: f.url,
        size: f.size,
        mimetype: f.mimetype
      }))).catch(err => {
        console.error('Failed to record multiple uploads in DB:', err);
      });

      return ResponseUtil.success(res, { files }, 'Files uploaded successfully');
    });
  }
}

module.exports = new UploadController();
