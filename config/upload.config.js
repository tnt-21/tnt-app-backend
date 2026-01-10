// ============================================
// FILE: config/upload.config.js
// Upload Configuration Settings
// ============================================

module.exports = {
  // Profile photo settings
  imageSize: {
    width: 500,
    height: 500
  },
  
  // Pet photo settings
  petImageSize: {
    width: 800,
    height: 800
  },
  
  // Ticket attachment image settings
  ticketImageSize: {
    width: 2000,
    height: 2000
  },
  
  // JPEG quality (1-100)
  quality: 85,
  
  // File size limits (in bytes)
  limits: {
    profilePhoto: 5 * 1024 * 1024,      // 5MB
    petPhoto: 5 * 1024 * 1024,          // 5MB
    ticketAttachment: 10 * 1024 * 1024  // 10MB
  },
  
  // Allowed MIME types
  allowedTypes: {
    images: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ],
    documents: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  },
  
  // Storage paths
  paths: {
    profilePhotos: 'uploads/profile-photos',
    petPhotos: 'uploads/pet-photos',
    ticketAttachments: 'uploads/ticket-attachments'
  },
  
  // CDN/Base URLs (override in .env)
  baseUrls: {
    profilePhotos: process.env.CDN_BASE_URL || 'http://localhost:3000/uploads/profile-photos',
    petPhotos: process.env.PET_CDN_BASE_URL || 'http://localhost:3000/uploads/pet-photos',
    ticketAttachments: process.env.TICKET_CDN_BASE_URL || 'http://localhost:3000/uploads/ticket-attachments'
  }
};