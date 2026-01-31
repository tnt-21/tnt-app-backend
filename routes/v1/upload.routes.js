const express = require('express');
const router = express.Router();
const uploadController = require('../../controllers/upload.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

// Protect all upload routes
router.use(authenticate);

// Upload single image
router.post('/image', uploadController.uploadImage);

// Upload multiple images
router.post('/images', uploadController.uploadImages);

module.exports = router;
