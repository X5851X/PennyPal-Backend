import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables first
dotenv.config();

// Validate configuration early
try {
  const { validateConfiguration } = await import('./utils/configChecker.js');
  validateConfiguration();
} catch (error) {
  console.warn('⚠️  Config checker not found, skipping validation');
}

// Import local modules with error handling
import connectDB from './database/db.js';
import passport from './passport/index.js';

// FIXED: Better import handling for routes with proper error handling
let authRoutes, ocrRoutes, currencyRoutes, transactionRoutes, savingsRoutes, billsRoutes, groupsRoutes, friendsRoutes, aiAssistantRoutes, dashboardRoutes, ocrService;

// Auth routes
try {
  console.log('🔍 Loading Auth routes...');
  const authModule = await import('./routes/auth.js');
  authRoutes = authModule.default;
  if (authRoutes && typeof authRoutes === 'function') {
    console.log('✅ Auth routes loaded successfully');
  } else {
    throw new Error('Auth routes module has invalid export');
  }
} catch (error) {
  console.error('❌ Auth routes failed to load:', error.message);
  authRoutes = express.Router();
  authRoutes.all('*', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Authentication service unavailable',
      message: 'Auth routes failed to load properly'
    });
  });
}

// OCR routes - FIXED
try {
  console.log('🔍 Loading OCR routes from: ./routes/ocr.js');
  const ocrModule = await import('./routes/ocr.js');
  ocrRoutes = ocrModule.default;
  
  if (!ocrRoutes) {
    throw new Error('OCR routes module has no default export');
  }
  
  if (typeof ocrRoutes !== 'function') {
    throw new Error('OCR routes export is not a valid Express router');
  }
  
  // Check if router has routes (this is optional, just for debugging)
  if (ocrRoutes.stack) {
    console.log(`✅ OCR routes loaded successfully with ${ocrRoutes.stack.length} routes`);
  } else {
    console.log('✅ OCR routes loaded successfully');
  }
  
} catch (error) {
  console.error('❌ OCR routes failed to load:', error.message);
  console.error('   Make sure ./routes/ocr.js exists and exports a router properly');
  
  // Create fallback router
  ocrRoutes = express.Router();
  ocrRoutes.all('*', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'OCR service unavailable',
      message: `OCR routes failed to load: ${error.message}`
    });
  });
}

// Currency routes
try {
  console.log('🔍 Loading Currency routes...');
  const currencyModule = await import('./routes/currency.js');
  currencyRoutes = currencyModule.default;
  if (currencyRoutes) {
    console.log('✅ Currency routes loaded successfully');
  } else {
    throw new Error('Currency routes module has no default export');
  }
} catch (error) {
  console.error('❌ Currency routes failed to load:', error.message);
  currencyRoutes = express.Router();
  currencyRoutes.all('*', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Currency service unavailable',
      message: 'Currency routes failed to load properly'
    });
  });
}

// Transaction routes
try {
  console.log('🔍 Loading Transaction routes...');
  const transactionModule = await import('./routes/transaction.js');
  transactionRoutes = transactionModule.default;
  if (transactionRoutes) {
    console.log('✅ Transaction routes loaded successfully');
  } else {
    throw new Error('Transaction routes module has no default export');
  }
} catch (error) {
  console.error('❌ Transaction routes failed to load:', error.message);
  transactionRoutes = express.Router();
  transactionRoutes.all('*', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Transaction service unavailable',
      message: 'Transaction routes failed to load properly'
    });
  });
}

// Savings routes
try {
  console.log('🔍 Loading Savings routes...');
  const savingsModule = await import('./routes/savings.js');
  savingsRoutes = savingsModule.default;
  if (savingsRoutes) {
    console.log('✅ Savings routes loaded successfully');
  } else {
    throw new Error('Savings routes module has no default export');
  }
} catch (error) {
  console.error('❌ Savings routes failed to load:', error.message);
  savingsRoutes = express.Router();
  savingsRoutes.all('*', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Savings service unavailable',
      message: 'Savings routes failed to load properly'
    });
  });
}

// Bills routes
try {
  console.log('🔍 Loading Bills routes...');
  const billsModule = await import('./routes/bills.js');
  billsRoutes = billsModule.default;
  if (billsRoutes) {
    console.log('✅ Bills routes loaded successfully');
  } else {
    throw new Error('Bills routes module has no default export');
  }
} catch (error) {
  console.error('❌ Bills routes failed to load:', error.message);
  billsRoutes = express.Router();
  billsRoutes.all('*', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Bills service unavailable',
      message: 'Bills routes failed to load properly'
    });
  });
}

// Groups routes
try {
  console.log('🔍 Loading Groups routes...');
  const groupsModule = await import('./routes/groups.js');
  groupsRoutes = groupsModule.default;
  if (groupsRoutes) {
    console.log('✅ Groups routes loaded successfully');
  } else {
    throw new Error('Groups routes module has no default export');
  }
} catch (error) {
  console.error('❌ Groups routes failed to load:', error.message);
  groupsRoutes = express.Router();
  groupsRoutes.all('*', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Groups service unavailable',
      message: 'Groups routes failed to load properly'
    });
  });
}

// Friends routes
try {
  console.log('🔍 Loading Friends routes...');
  const friendsModule = await import('./routes/friends.js');
  friendsRoutes = friendsModule.default;
  if (friendsRoutes) {
    console.log('✅ Friends routes loaded successfully');
  } else {
    throw new Error('Friends routes module has no default export');
  }
} catch (error) {
  console.error('❌ Friends routes failed to load:', error.message);
  friendsRoutes = express.Router();
  friendsRoutes.all('*', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Friends service unavailable',
      message: 'Friends routes failed to load properly'
    });
  });
}



// AI Assistant routes
try {
  console.log('🔍 Loading AI Assistant routes...');
  const aiAssistantModule = await import('./routes/ai-assistant.js');
  aiAssistantRoutes = aiAssistantModule.default;
  if (aiAssistantRoutes) {
    console.log('✅ AI Assistant routes loaded successfully');
  } else {
    throw new Error('AI Assistant routes module has no default export');
  }
} catch (error) {
  console.error('❌ AI Assistant routes failed to load:', error.message);
  aiAssistantRoutes = express.Router();
  aiAssistantRoutes.all('*', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'AI Assistant service unavailable',
      message: 'AI Assistant routes failed to load properly'
    });
  });
}

// Dashboard routes
try {
  console.log('🔍 Loading Dashboard routes...');
  const dashboardModule = await import('./routes/dashboard.js');
  dashboardRoutes = dashboardModule.default;
  if (dashboardRoutes) {
    console.log('✅ Dashboard routes loaded successfully');
  } else {
    throw new Error('Dashboard routes module has no default export');
  }
} catch (error) {
  console.error('❌ Dashboard routes failed to load:', error.message);
  dashboardRoutes = express.Router();
  dashboardRoutes.all('*', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Dashboard service unavailable',
      message: 'Dashboard routes failed to load properly'
    });
  });
}

// OCR Service
try {
  console.log('🔍 Loading OCR service...');
  const ocrServiceModule = await import('./services/ocr.js');
  ocrService = ocrServiceModule.default;
  if (ocrService) {
    console.log('✅ OCR service loaded successfully');
  } else {
    console.warn('⚠️  OCR service module loaded but no default export found');
  }
} catch (error) {
  console.warn('⚠️  OCR service not found, graceful shutdown for OCR disabled:', error.message);
  ocrService = null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Get allowed origins from environment variables
    const allowedOrigins = [
      process.env.FRONTEND,
      process.env.BACKEND
    ].filter(Boolean);
    
    // Add default development origins if in development mode
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push(
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:4173'
      );
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'development') {
      // In development, allow any localhost origin (but not 127.0.0.1 to avoid confusion)
      if (origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked origin: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    } else {
      console.warn(`⚠️  CORS blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['set-cookie']
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable if you have issues with frontend
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === 'production'
}));

// Custom logging format
const logFormat = process.env.NODE_ENV === 'production' 
  ? 'combined' 
  : ':method :url :status :response-time ms - :res[content-length]';

app.use(morgan(logFormat));
app.use(cors(corsOptions));

// Trust proxy in production (for proper IP detection)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf, encoding) => {
    // Basic JSON validation
    try {
      JSON.parse(buf);
    } catch (e) {
      const error = new Error('Invalid JSON');
      error.status = 400;
      throw error;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Session configuration with better security
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: process.env.SESSION_COOKIE_NAME || process.env.SESSION_NAME || 'pennypal.sid',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Request logging middleware for debugging
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });
}

// Health check route (before other routes)
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    services: {
      auth: !!authRoutes,
      ocr: !!ocrRoutes && !!ocrService,
      currency: !!currencyRoutes,
      transactions: !!transactionRoutes,
      savings: !!savingsRoutes,
      bills: !!billsRoutes,
      groups: !!groupsRoutes,
      friends: !!friendsRoutes,
      aiAssistant: !!aiAssistantRoutes,
      dashboard: !!dashboardRoutes
    }
  };
  
  res.json(healthCheck);
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to PennyPal Backend!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// FIXED: Direct route mounting without problematic middleware
console.log('🔗 Mounting routes...');

app.use('/auth', authRoutes);
app.use('/ocr', ocrRoutes);  // FIXED: Direct mounting
app.use('/currency', currencyRoutes);
app.use('/transaction', transactionRoutes);
app.use('/savings', savingsRoutes);
app.use('/bills', billsRoutes);
app.use('/groups', groupsRoutes);
app.use('/friends', friendsRoutes);
app.use('/ai', aiAssistantRoutes);
app.use('/dashboard', dashboardRoutes);

console.log('✅ All routes mounted successfully');

// API version endpoint
app.get('/api', (req, res) => {
  res.json({
    api_version: '1.0.0',
    endpoints: {
      '/auth': 'Authentication and user management',
      '/ocr': 'Optical Character Recognition for receipts',
      '/currency': 'Currency exchange rates',
      '/transaction': 'Transaction management',
      '/savings': 'Savings goals management',
      '/bills': 'Bill tracking and reminders',
      '/groups': 'Group expense sharing',
      '/friends': 'Friend management and requests',
      '/ai': 'AI financial assistant and smart categorization',
      '/dashboard': 'Dashboard summary and analytics'
    }
  });
});

// Test route for debugging
app.get('/test-ocr-direct', (req, res) => {
  res.json({ 
    message: 'Direct OCR test route works', 
    timestamp: new Date().toISOString(),
    ocrService: !!ocrService
  });
});

// Catch-all route for undefined endpoints
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    suggestion: 'Check the available routes at GET /',
    availableRoutes: {
      '/': 'API documentation',
      '/health': 'Health check',
      '/api': 'API version info',
      '/auth': 'Authentication',
      '/ocr': 'OCR services',
      '/currency': 'Currency rates',
      '/transaction': 'Transactions',
      '/savings': 'Savings goals',
      '/bills': 'Bill management',
      '/groups': 'Group expenses',
      '/friends': 'Friend management',
      '/ai': 'AI Assistant',
      '/dashboard': 'Dashboard summary'
    }
  });
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  console.error(`❌ Server error [${errorId}]:`, {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: error.message,
      errorId
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      message: 'The provided ID is not valid',
      errorId
    });
  }
  
  // Don't send error details in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(error.status || 500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Something went wrong on our end',
      errorId
    });
  }
  
  res.status(error.status || 500).json({ 
    success: false,
    error: 'Internal server error',
    message: error.message,
    stack: error.stack,
    errorId
  });
});

// Graceful shutdown with better error handling
const gracefulShutdown = async (signal) => {
  console.log(`\n🔄 Received ${signal}. Shutting down gracefully...`);
  
  try {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('✅ Database connection closed');
    }
    
    // Terminate OCR service
    if (ocrService && typeof ocrService.terminate === 'function') {
      await ocrService.terminate();
      console.log('✅ OCR service terminated');
    }
    
    console.log('✅ Server shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle different termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server with better error handling
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();
    console.log('✅ Database connected successfully');
    
    // Initialize OCR service if available
    if (ocrService && typeof ocrService.initialize === 'function') {
      try {
        await ocrService.initialize();
        console.log('✅ OCR service initialized');
      } catch (ocrError) {
        console.warn('⚠️  OCR service initialization failed:', ocrError.message);
      }
    }
    
    // Start the server
    const server = app.listen(PORT, () => {
      console.log('🚀 PennyPal Backend Server Started');
      console.log(`📍 Server URL: http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('📄 Available endpoints:');
      console.log(`   • Documentation: http://localhost:${PORT}/`);
      console.log(`   • Health Check: http://localhost:${PORT}/health`);
      console.log(`   • API Info: http://localhost:${PORT}/api`);
      console.log(`   • Auth: http://localhost:${PORT}/auth`);
      console.log(`   • OCR: http://localhost:${PORT}/ocr`);
      console.log(`   • Currency: http://localhost:${PORT}/currency`);
      console.log(`   • Transactions: http://localhost:${PORT}/transaction`);
      console.log(`   • Savings: http://localhost:${PORT}/savings`);
      console.log(`   • Bills: http://localhost:${PORT}/bills`);
      console.log(`   • Groups: http://localhost:${PORT}/groups`);
      console.log(`   • Friends: http://localhost:${PORT}/friends`);
      console.log(`   • AI Assistant: http://localhost:${PORT}/ai`);
      console.log(`   • Dashboard: http://localhost:${PORT}/dashboard`);
      console.log('✨ Server ready to accept connections!\n');
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.log('💡 Try using a different port: PORT=3001 npm start');
      } else if (error.code === 'EACCES') {
        console.error(`❌ Permission denied for port ${PORT}`);
        console.log('💡 Try using a port above 1000 or run with sudo (not recommended)');
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

    // Handle server close
    server.on('close', () => {
      console.log('🔄 Server closed');
    });

    return server;

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('   Database connection failed. Please check if MongoDB is running.');
    } else if (error.message.includes('ENOENT')) {
      console.error('   File or directory not found. Please check your file paths.');
    } else {
      console.error('   Please check your configuration and dependencies.');
    }
    
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;