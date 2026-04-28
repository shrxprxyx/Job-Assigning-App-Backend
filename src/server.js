/**
 * Main Server Entry Point
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const { connectDB } = require('./config/database');
const { initializeFirebase } = require('./config/firebase');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const jobRoutes = require('./routes/job.routes');
const applicationRoutes = require('./routes/application.routes');
const skillPostRoutes = require('./routes/skillPost.routes');
const chatRoutes = require('./routes/chat.routes');

const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// Security
app.use(helmet());
app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:8081', 'http://localhost:19006'];
    callback(null, allowedOrigins.includes(origin) || true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Routes
const API_VERSION = process.env.API_VERSION || 'v1';

app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes);
app.use(`/api/${API_VERSION}/jobs`, jobRoutes);
app.use(`/api/${API_VERSION}/applications`, applicationRoutes);
app.use(`/api/${API_VERSION}/skill-posts`, skillPostRoutes);
app.use(`/api/${API_VERSION}/chat`, chatRoutes);

app.get(`/api/${API_VERSION}`, (req, res) => {
  res.json({
    success: true,
    message: 'Job Assigning App API',
    version: API_VERSION,
    endpoints: {
      auth: `/api/${API_VERSION}/auth`,
      users: `/api/${API_VERSION}/users`,
      jobs: `/api/${API_VERSION}/jobs`,
      applications: `/api/${API_VERSION}/applications`,
      skillPosts: `/api/${API_VERSION}/skill-posts`,
      chat: `/api/${API_VERSION}/chat`,
    },
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Startup
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    console.log('✅ MongoDB connected successfully');

    initializeFirebase();

    app.listen(PORT, () => {
      console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`📍 Local:    http://localhost:${PORT}`);
      console.log(`📍 API Base: http://localhost:${PORT}/api/${API_VERSION}\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

startServer();

module.exports = app;