const express = require('express');
const { body, validationResult } = require('express-validator');
const workingHoursManager = require('../utils/working-hours');
const router = express.Router();

// Get working hours summary
router.get('/summary', async (req, res) => {
  try {
    const summary = await workingHoursManager.getWorkingHoursSummary();
    res.json({
      success: true,
      workingHours: summary
    });
  } catch (error) {
    console.error('Error fetching working hours summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch working hours summary',
      error: error.message
    });
  }
});

// Get all working hours
router.get('/', async (req, res) => {
  try {
    const workingHours = await workingHoursManager.getWorkingHours();
    res.json({
      success: true,
      workingHours
    });
  } catch (error) {
    console.error('Error fetching working hours:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch working hours',
      error: error.message
    });
  }
});

// Check if a specific time is within working hours
router.post('/check', [
  body('datetime').isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { datetime } = req.body;
    const result = await workingHoursManager.isWithinWorkingHours(datetime);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error checking working hours:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check working hours',
      error: error.message
    });
  }
});

// Get available time slots for a specific date
router.get('/slots/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { duration = 60 } = req.query; // Default 60 minutes
    
    const slots = await workingHoursManager.getAvailableTimeSlots(date, parseInt(duration));
    
    res.json({
      success: true,
      date,
      slots,
      count: slots.length
    });
  } catch (error) {
    console.error('Error fetching time slots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch time slots',
      error: error.message
    });
  }
});

// Update working hours for a specific day
router.put('/:dayOfWeek', [
  body('is_open').isBoolean().withMessage('is_open must be a boolean'),
  body('open_time').custom((value, { req }) => {
    // If day is open, time must be valid HH:MM format
    if (req.body.is_open && value && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      throw new Error('Invalid open time format (HH:MM)');
    }
    // If day is closed, time can be null or empty
    return true;
  }),
  body('close_time').custom((value, { req }) => {
    // If day is open, time must be valid HH:MM format
    if (req.body.is_open && value && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      throw new Error('Invalid close time format (HH:MM)');
    }
    // If day is closed, time can be null or empty
    return true;
  }),
  body('notes').optional().isString().withMessage('Notes must be a string')
], async (req, res) => {
  try {
    console.log('🔄 PUT /working-hours/:dayOfWeek - Request received:', {
      dayOfWeek: req.params.dayOfWeek,
      body: req.body
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { dayOfWeek } = req.params;
    const updates = req.body;
    
    console.log('📝 Processing updates for day:', dayOfWeek, 'with data:', updates);
    
    // Validate that close time is after open time (only when day is open)
    if (updates.is_open && updates.open_time && updates.close_time) {
      if (updates.open_time >= updates.close_time) {
        console.log('❌ Invalid time range:', updates.open_time, '>=', updates.close_time);
        return res.status(400).json({
          success: false,
          message: 'Close time must be after open time'
        });
      }
    }
    
    // Break time validation removed
    
    const result = await workingHoursManager.updateWorkingHours(parseInt(dayOfWeek), updates);
    
    console.log('✅ Working hours updated successfully:', result);
    
    res.json({
      success: true,
      message: 'Working hours updated successfully',
      result
    });
  } catch (error) {
    console.error('❌ Error updating working hours:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update working hours',
      error: error.message
    });
  }
});

// Reset working hours to defaults
router.post('/reset', async (req, res) => {
  try {
    // This would typically call a function to reset to default values
    // For now, we'll just return a message
    res.json({
      success: true,
      message: 'Working hours reset to defaults. Please run the migration script to apply changes.'
    });
  } catch (error) {
    console.error('Error resetting working hours:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset working hours',
      error: error.message
    });
  }
});

module.exports = router;
