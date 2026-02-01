// ============================================
// FILE: middlewares/upload.middleware.js
// Complete Upload Middleware (S3 Consolidated)
// ============================================

const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { errorResponse } = require('../utils/response.util');

// Configure AWS S3 Client
const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION || 'ap-south-1',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'tnt-app-assets';

/**
 * Configure S3 storage engine
 * @param {string} folderPrefix - The folder within the bucket (e.g., 'profile-photos')
 */
const getS3Storage = (folderPrefix) => multerS3({
  s3: s3,
  bucket: BUCKET_NAME,
  // acl: 'public-read', // Deprecated/disabled on many new buckets. Use bucket policies instead.
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${folderPrefix}/${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

// File filter for profile/pet photos
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'), false);
  }
};

// File filter for ticket attachments (images + documents)
const ticketFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: images, PDF, Word, Excel'), false);
  }
};

// Multer configurations
const profilePhotoUpload = multer({
  storage: getS3Storage('profile-photos'),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: imageFileFilter
});

const petPhotoUpload = multer({
  storage: getS3Storage('pet-photos'),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: imageFileFilter
});

const ticketAttachmentUpload = multer({
  storage: getS3Storage('ticket-attachments'),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: ticketFileFilter
});

// Middleware for profile photo upload
const uploadProfilePhoto = (req, res, next) => {
  const uploadSingle = profilePhotoUpload.single('photo');
  
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return errorResponse(res, 'File size too large. Maximum 5MB allowed.', 400, 'FILE_TOO_LARGE');
      }
      return errorResponse(res, err.message, 400, 'UPLOAD_ERROR');
    } else if (err) {
      return errorResponse(res, err.message, 400, 'UPLOAD_ERROR');
    }
    next();
  });
};

// Middleware for pet photo upload
const uploadPetPhoto = (req, res, next) => {
  const uploadSingle = petPhotoUpload.single('photo');
  
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return errorResponse(res, 'File size too large. Maximum 5MB allowed.', 400, 'FILE_TOO_LARGE');
      }
      return errorResponse(res, err.message, 400, 'UPLOAD_ERROR');
    } else if (err) {
      return errorResponse(res, err.message, 400, 'UPLOAD_ERROR');
    }
    next();
  });
};

// Middleware for ticket attachment upload
const uploadTicketAttachment = (req, res, next) => {
  const uploadSingle = ticketAttachmentUpload.single('attachment');
  
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return errorResponse(res, 'File size too large. Maximum 10MB allowed.', 400, 'FILE_TOO_LARGE');
      }
      return errorResponse(res, err.message, 400, 'UPLOAD_ERROR');
    } else if (err) {
      return errorResponse(res, err.message, 400, 'UPLOAD_ERROR');
    }
    next();
  });
};

module.exports = {
  uploadProfilePhoto,
  uploadPetPhoto,
  uploadTicketAttachment,
  s3 // Exporting s3 instance just in case
};