const express = require('express');
const { body, validationResult } = require('express-validator');
const { runQuery, getRow, getAll } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Apply authentication to all admin routes
router.use(authenticateToken);

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    // Get booking statistics
    const bookingStats = await getAll(`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings,

        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
        SUM(CASE WHEN status = 'completed' THEN service_price ELSE 0 END) as total_revenue
      FROM bookings
    `);

    // Get today's bookings
    const todayBookings = await getAll(`
      SELECT * FROM bookings 
      WHERE DATE(preferred_datetime) = DATE('now') 
      ORDER BY preferred_datetime ASC
    `);

    // Get barber statistics
    const barberStats = await getAll(`
      SELECT 
        barber_name,
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
        SUM(CASE WHEN status = 'completed' THEN service_price ELSE 0 END) as revenue
      FROM bookings 
      GROUP BY barber_name
    `);

    res.json({
      success: true,
      dashboard: {
        stats: bookingStats[0],
        todayBookings,
        barberStats
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});

// Get all barbers
router.get('/barbers', async (req, res) => {
  try {
    const barbers = await getAll('SELECT * FROM barbers ORDER BY name');
    
    res.json({
      success: true,
      barbers
    });

  } catch (error) {
    console.error('Error fetching barbers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch barbers',
      error: error.message
    });
  }
});

// Get all services
router.get('/services', async (req, res) => {
  try {
    const services = await getAll('SELECT * FROM services ORDER BY name');
    
    res.json({
      success: true,
      services
    });

  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
      error: error.message
    });
  }
});

module.exports = router;