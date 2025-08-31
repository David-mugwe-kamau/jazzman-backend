const express = require('express');
const { getAll } = require('../config/database');
const router = express.Router();

// Get all active services
router.get('/services', async (req, res) => {
  try {
    const services = await getAll('SELECT * FROM services WHERE is_active = true ORDER BY price ASC');
    
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

// Get all active barbers
router.get('/barbers', async (req, res) => {
  try {
    const barbers = await getAll('SELECT * FROM barbers WHERE is_active = true AND is_blocked = false ORDER BY name ASC');
    
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

// Get service by ID
router.get('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { getRow } = require('../config/database');
    
    const service = await getRow('SELECT * FROM services WHERE id = $1 AND is_active = true', [id]);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      service
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service',
      error: error.message
    });
  }
});

// Get barber by ID
router.get('/barbers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { getRow } = require('../config/database');
    
    const barber = await getRow('SELECT * FROM barbers WHERE id = $1 AND is_active = true', [id]);
    
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: 'Barber not found'
      });
    }

    res.json({
      success: true,
      barber
    });
  } catch (error) {
    console.error('Error fetching barber:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch barber',
      error: error.message
    });
  }
});

module.exports = router;
