// middlewares/upload.middleware
const multer = require('multer');
const path = require('path');
const { errorResponse } = require('../utils/response.util');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'), false);
  }
};

// Multer upload configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

// Middleware for profile photo upload
const uploadProfilePhoto = (req, res, next) => {
  const uploadSingle = upload.single('photo');
  
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

// Middleware for pet photo upload (uses same logic as profile photo for now)
const uploadPetPhoto = (req, res, next) => {
  const uploadSingle = upload.single('photo');
  
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

module.exports = {
  uploadProfilePhoto,
  uploadPetPhoto
};