const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Render deployment (fixes rate limiter X-Forwarded-For header issue)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration - Safari compatible with multiple origins
const allowedOrigins = [
  'https://mh-automotriz-auditoria.netlify.app', // Production frontend
  'http://localhost:3000', // Local development
  'http://localhost:3001', // Alternative local port
  'http://127.0.0.1:3000', // Alternative localhost
  'http://127.0.0.1:3001'  // Alternative localhost port
];

// Add custom origin from environment if provided
if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log blocked origins for debugging
    console.log(`🚫 CORS blocked origin: ${origin}`);
    console.log(`✅ Allowed origins: ${allowedOrigins.join(', ')}`);
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}));

// Rate limiting - more lenient in development
const isDevelopment = process.env.NODE_ENV !== 'production';
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isDevelopment ? 2000 : 100), // 2000 in dev, 100 in production
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// CORS debugging middleware
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    console.log(`🔍 CORS Preflight request from: ${req.get('Origin') || 'No Origin'}`);
  }
  next();
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Safari-compatible cache control middleware
app.use((req, res, next) => {
  // Add headers to prevent Safari caching issues
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  
  // Safari-specific headers
  if (req.get('User-Agent') && req.get('User-Agent').includes('Safari')) {
    res.set({
      'Vary': 'Accept-Encoding, User-Agent',
      'Last-Modified': new Date().toUTCString()
    });
  }
  
  next();
});

// Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    version: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
    pid: process.pid
  };
  
  res.status(200).json(healthCheck);
});

// Detailed health check (for monitoring systems)
app.get('/health/detailed', async (req, res) => {
  try {
    const googleSheets = require('./services/googleSheets');
    
    // Test Google Sheets connection
    let sheetsStatus = 'unknown';
    try {
      await googleSheets.getSheetData('MonthlySummary');
      sheetsStatus = 'connected';
    } catch (error) {
      sheetsStatus = 'error';
    }
    
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      services: {
        googleSheets: sheetsStatus,
        auth0: process.env.AUTH0_DOMAIN ? 'configured' : 'not_configured'
      },
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      pid: process.pid
    };
    
    res.status(200).json(detailedHealth);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// 404 handler for unmatched routes
app.use('*', notFoundHandler);

// Global error handling middleware (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Security: Helmet, CORS, Rate Limiting enabled`);
  console.log(`📝 Logging: Morgan enabled`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});
