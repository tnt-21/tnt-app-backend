// ============================================
// FILE: index.js
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import config
const { testConnection, closePool } = require('./config/database');

// Import routes
const authRoutes = require('./routes/v1/auth.routes');

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

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many auth attempts' },
  skipSuccessfulRequests: true
});

app.use('/api/', generalLimiter);

// Routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🐾 Tails & Tales API',
    version: API_VERSION,
    endpoints: { health: '/health', auth: `/api/${API_VERSION}/auth` }
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
    
    server = app.listen(PORT, () => {
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