// ============================================
// FILE: middlewares/upload.middleware.js
// Complete Upload Middleware (Updated)
// ============================================

const multer = require('multer');
const path = require('path');
const { errorResponse } = require('../utils/response.util');

// Configure multer for memory storage
const storage = multer.memoryStorage();

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
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: imageFileFilter
});

const petPhotoUpload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: imageFileFilter
});

const ticketAttachmentUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB for ticket attachments
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
  uploadTicketAttachment  // NEW: Export ticket attachment middleware
};