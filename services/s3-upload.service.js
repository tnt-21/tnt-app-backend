// ============================================
// FILE: services/s3-upload.service.js
// AWS S3 File Upload Service (AWS SDK v3)
// ============================================

const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure AWS S3 Client (v3)
const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION || 'ap-south-1',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'tnt-app-assets';

/**
 * Multer S3 storage configuration
 */
const storage = multerS3({
  s3: s3,
  bucket: BUCKET_NAME,
  acl: 'public-read', // Make files publicly readable
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    // Generate unique filename
    const folder = req.body.folder || 'uploads';
    const ext = path.extname(file.originalname);
    const filename = `${folder}/${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

/**
 * File filter - only allow images
 */
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, svg, webp)'));
  }
};

/**
 * Multer upload middleware
 */
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

/**
 * Delete file from S3
 */
async function deleteFile(fileUrl) {
  try {
    // Extract key from URL
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove leading slash

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3.send(command);

    return { success: true, message: 'File deleted successfully' };
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error('Failed to delete file from S3');
  }
}

module.exports = {
  upload,
  deleteFile,
  s3,
  BUCKET_NAME,
};
