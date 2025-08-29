const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const { blockExpiryScheduler } = require('./utils/scheduler');
const { dailySummaryScheduler } = require('./utils/daily-summary-scheduler');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const barberManagementRoutes = require('./routes/barber-management');
const paymentRoutes = require('./routes/payments');
const paymentManagementRoutes = require('./routes/payment-management');
const clientManagementRoutes = require('./routes/client-management');
const analyticsRoutes = require('./routes/analytics');
const workingHoursRoutes = require('./routes/working-hours');

// Security middleware with CSP configuration for admin dashboard
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));

// Rate limiting - Increased for better user experience
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs (increased from 100)
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parsing middleware
app.use(cookieParser());

// Serve static files for main frontend only
app.use('/', express.static(path.join(__dirname, 'public')));

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve admin dashboard (protected)
app.get('/admin', (req, res) => {
  // Check if user has a valid JWT token in cookies, query params, or Authorization header
  const token = req.cookies?.adminToken || req.query.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    // No token, redirect to login
    return res.redirect('/login');
  }
  
  // Token exists, serve admin dashboard
  // The frontend will validate the token and redirect if invalid
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API Routes
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/barbers', barberManagementRoutes);  // Move this BEFORE publicRoutes
app.use('/api/working-hours', workingHoursRoutes);
app.use('/api', publicRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payment-management', paymentManagementRoutes);
app.use('/api/clients', clientManagementRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
      JWT_SECRET_LENGTH: process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0
    }
  });
});

// Test daily summary endpoint (for development/testing)
app.post('/api/test-daily-summary', async (req, res) => {
  try {
    console.log('🧪 Manual daily summary test triggered...');
    const result = await dailySummaryScheduler.sendDailySummaries();
    res.json({ 
      success: true, 
      message: 'Daily summaries sent successfully',
      barbersNotified: result?.successCount || 'Unknown',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in manual daily summary test:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Scheduler status endpoint
app.get('/api/scheduler-status', (req, res) => {
  res.json({
    blockExpiry: blockExpiryScheduler.getStatus(),
    dailySummary: dailySummaryScheduler.getStatus(),
    timestamp: new Date().toISOString()
  });
});

// Booking status update endpoint
app.put('/api/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Simple validation
    if (!status || !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
  return res.status(400).json({
    success: false,
    message: 'Invalid status. Must be one of: pending, in_progress, completed, cancelled'
  });
}
    
    // Update booking status in database
    const db = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, 'data', 'jazzman.db');
    console.log('🔍 Database path for booking status update:', dbPath);
    const database = new db.Database(dbPath);
    
    database.run(
      'UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id],
      function(err) {
        if (err) {
          console.error('Error updating booking status:', err);
          res.status(500).json({
            success: false,
            message: 'Database error updating booking status'
          });
        } else if (this.changes === 0) {
          res.status(404).json({
            success: false,
            message: 'Booking not found'
          });
        } else {
          res.json({
            success: true,
            message: `Booking status updated to ${status}`,
            booking_id: id,
            new_status: status
          });
        }
        database.close();
      }
    );
    
  } catch (error) {
    console.error('Error in booking status update:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get single booking endpoint
app.get('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get booking details from database
    const db = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, 'data', 'jazzman.db');
    console.log('🔍 Database path for single booking:', dbPath);
    const database = new db.Database(dbPath);
    
    database.get(
      'SELECT * FROM bookings WHERE id = ?',
      [id],
      function(err, row) {
        if (err) {
          console.error('Error fetching booking:', err);
          res.status(500).json({
            success: false,
            message: 'Database error fetching booking'
          });
        } else if (!row) {
          res.status(404).json({
            success: false,
            message: 'Booking not found'
          });
        } else {
          res.json({
            success: true,
            booking: row
          });
        }
        database.close();
      }
    );
    
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Booking reschedule endpoint
app.put('/api/bookings/:id/reschedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { preferred_datetime } = req.body;
    
    if (!preferred_datetime) {
      return res.status(400).json({
        success: false,
        message: 'New date and time is required'
      });
    }
    
    // Update booking datetime in database
    const db = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, 'data', 'jazzman.db');
    console.log('🔍 Database path for booking reschedule:', dbPath);
    const database = new db.Database(dbPath);
    
    database.run(
      'UPDATE bookings SET preferred_datetime = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [preferred_datetime, id],
      function(err) {
        if (err) {
          console.error('Error rescheduling booking:', err);
          res.status(500).json({
            success: false,
            message: 'Database error rescheduling booking'
          });
        } else if (this.changes === 0) {
          res.status(404).json({
            success: false,
            message: 'Booking not found'
          });
        } else {
          res.json({
            success: true,
            message: 'Booking rescheduled successfully',
            booking_id: id,
            new_datetime: preferred_datetime
          });
        }
        database.close();
      }
    );
    
  } catch (error) {
    console.error('Error in booking reschedule:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Root endpoint - serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin endpoint - serve the admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Payment management endpoint
app.get('/payment-management', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment-management.html'));
});

// Client management endpoint
app.get('/client-management', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'client-management.html'));
});

// Serve admin static files (CSS, JS, images)
app.use('/admin/assets', express.static(path.join(__dirname, 'public')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎉 JazzMan Housecalls API running on port ${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Admin dashboard: http://localhost:${PORT}/admin`);
  
  // Wait for database initialization before starting schedulers
  const { db } = require('./config/database');
  
  // Check if database is ready (tables exist)
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='barbers'", (err, row) => {
    if (err) {
      console.error('❌ Error checking database readiness:', err.message);
    } else if (row) {
      console.log('✅ Database ready, starting schedulers...');
      // Start the block expiry scheduler
      blockExpiryScheduler.start();
      
      // Start the daily summary scheduler
      dailySummaryScheduler.start();
    } else {
      console.log('⏳ Waiting for database initialization...');
      // Wait a bit more for tables to be created
      setTimeout(() => {
        console.log('✅ Starting schedulers after delay...');
        // Start the block expiry scheduler
        blockExpiryScheduler.start();
        
        // Start the daily summary scheduler
        dailySummaryScheduler.start();
      }, 2000); // Wait 2 seconds for tables to be created
    }
  });
});

module.exports = app;