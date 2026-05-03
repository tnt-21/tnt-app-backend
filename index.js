// ============================================
// FILE: index.js
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import config
const { testConnection, closePool } = require('./config/database');

// Import routes
const authRoutes = require('./routes/v1/auth.routes');
const userRoutes = require('./routes/v1/user.routes'); // NEW: Import user routes
const petRoutes = require('./routes/v1/pet.routes'); // Import pet routes
const subscriptionRoutes = require('./routes/v1/subscription.routes');
const paymentRoutes = require('./routes/v1/payment.routes');
const adminRoutes = require('./routes/v1/admin.routes');
const serviceRoutes = require('./routes/v1/service.routes'); // Import service routes
const caregiverRoutes = require('./routes/v1/caregiver.routes'); // Import caregiver routes
const careManagerRoutes = require('./routes/v1/careManager.routes'); // Import care manager routes
const trackingRoutes = require('./routes/v1/tracking.routes');
const notificationRoutes = require('./routes/v1/notification.routes');
const communityRoutes = require('./routes/v1/community.routes');
const supportRoutes = require('./routes/v1/support.routes');
const configRoutes = require('./routes/v1/config.routes');
const analyticsRoutes = require('./routes/v1/analytics.routes');
const uploadRoutes = require('./routes/v1/upload.routes'); // Import upload routes
const auditRoutes = require('./routes/v1/audit.routes'); // Import audit routes
const productRoutes = require('./routes/v1/product.routes'); // Import product routes
const clusterRoutes = require('./routes/v1/cluster.routes'); // Import cluster routes
const addonRoutes = require('./routes/v1/addon.routes'); // Import addon routes
const seedRoutes = require('./routes/seed.routes'); // Temporary seed routes

// Import cron jobs
const { initPetLifeStageJob } = require('./cron/pet.cron');
// Import S3 Cleanup Job
const { initCleanupJob } = require('./cron/cleanup.cron');
// Import keep alive cron job for render
const { initKeepAliveJob } = require('./cron/keep_alive.cron');

// Import error handler
const { errorHandler } = require('./middlewares/error.middleware');

const PORT = process.env.PORT || 5000;
const ENV = process.env.NODE_ENV || 'development';
const API_VERSION = process.env.API_VERSION || 'v1';

const app = express();

// Security & Parsing
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (ENV === 'development') {
  app.use(morgan('dev'));
}

// NEW: Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting - General limiter for non-authenticated routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false
});

// Auth-specific rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many auth attempts' },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false
});

// Apply general limiter only to public routes
app.use('/', generalLimiter);

// Routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🐾 Tails & Tales API',
    version: API_VERSION,
    endpoints: { 
      health: '/health', 
      auth: `/api/${API_VERSION}/auth`,
      users: `/api/${API_VERSION}/users`, // NEW: Add users endpoint
      pets: `/api/${API_VERSION}/pets`,
      subscriptions: `/api/${API_VERSION}/subscriptions`,
      payments: `/api/${API_VERSION}/payments`,
      services: `/api/${API_VERSION}/services`,
      caregivers: `/api/${API_VERSION}/caregivers`,
      careManagers: `/api/${API_VERSION}/care-managers`
    }
  });
});

app.get('/health', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    await pool.query('SELECT NOW()');
    res.json({
      success: true,
      status: 'operational',
      database: 'connected',
      uptime: Math.floor(process.uptime()) + 's'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'degraded',
      database: 'disconnected'
    });
  }
});

// API Routes
app.use(`/api/${API_VERSION}/auth`, authLimiter, authRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes); // NEW: Mount user routes (rate limiting is per-route)
app.use(`/api/${API_VERSION}/pets`, petRoutes);
app.use(`/api/${API_VERSION}/subscriptions`, subscriptionRoutes);
app.use(`/api/${API_VERSION}/payments`, paymentRoutes);
app.use(`/api/${API_VERSION}/admin`, adminRoutes);
app.use(`/api/${API_VERSION}/services`, serviceRoutes); // Mount service routes
app.use(`/api/${API_VERSION}/caregivers`, caregiverRoutes); // Mount caregiver routes
app.use(`/api/${API_VERSION}/care-managers`, careManagerRoutes); // Mount care manager routes
app.use(`/api/${API_VERSION}/tracking`, trackingRoutes);
app.use(`/api/${API_VERSION}/notifications`, notificationRoutes);
app.use(`/api/${API_VERSION}/community`, communityRoutes);
app.use(`/api/${API_VERSION}/support`, supportRoutes);
app.use(`/api/${API_VERSION}/config`, configRoutes);
app.use(`/api/${API_VERSION}/analytics`, analyticsRoutes);
app.use(`/api/${API_VERSION}/upload`, uploadRoutes); // Mount upload routes
app.use(`/api/${API_VERSION}/audit`, auditRoutes); // Mount audit routes
app.use(`/api/${API_VERSION}/products`, productRoutes); // Mount product routes
app.use(`/api/${API_VERSION}/clusters`, clusterRoutes); // Mount cluster routes
app.use(`/api/${API_VERSION}/addons`, addonRoutes); // Mount addon routes
app.use(`/api/${API_VERSION}/seed`, seedRoutes); // Temporary seed endpoint

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error Handler
app.use(errorHandler);

// Server
let server;

async function startServer() {
  try {
    console.log('🔍 Testing database connection...');
    await testConnection();
    
    // Initialize Cron Jobs
    initPetLifeStageJob();
    initCleanupJob();
    initKeepAliveJob();
    
    // server = app.listen(PORT, () => {
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════╗
║  🐾 TAILS & TALES API SERVER         ║
║  Port: ${PORT}                           ║
║  Environment: ${ENV}              ║
║  URL: http://localhost:${PORT}           ║
╚═══════════════════════════════════════╝
      `);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n🛑 ${signal} - Shutting down...`);
  if (server) {
    server.close(async () => {
      await closePool();
      console.log('👋 Shutdown complete');
      process.exit(0);
    });
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

startServer();