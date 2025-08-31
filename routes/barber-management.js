const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { runQuery, getRow, getAll } = require('../config/database');
const { sendBlockNotification } = require('../utils/block-notifications');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'passport-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Get all barbers with enhanced information (main route)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 API Route: GET /api/barbers called');
    
    const barbers = await getAll(`
      SELECT 
        id, name, phone, email, profile_photo, identity_badge_number,
        is_active, is_blocked, block_reason, blocked_at, blocked_by,
        block_type, block_duration_hours, block_expires_at,
        block_category, block_severity, block_warning_count,
        total_services, total_earnings, current_location,
        last_active, created_at
      FROM barbers 
      ORDER BY name ASC
    `);
    
    console.log(`📊 Database returned ${barbers.length} barbers:`, barbers.map(b => ({ id: b.id, name: b.name, is_blocked: b.is_blocked, block_type: b.block_type })));
    
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

// Get all barbers with enhanced information - MUST BE BEFORE /:id route to avoid conflicts
router.get('/all', async (req, res) => {
  try {
    console.log('🔍 API Route: GET /api/barbers/all called');
    
    const barbers = await getAll(`
      SELECT 
        id, name, phone, email, profile_photo, identity_badge_number,
        is_active, is_blocked, block_reason, blocked_at, blocked_by,
        block_type, block_duration_hours, block_expires_at,
        block_category, block_severity, block_warning_count,
        total_services, total_earnings, current_location,
        last_active, created_at
      FROM barbers 
      ORDER BY name ASC
    `);
    
    console.log(`📊 Database returned ${barbers.length} barbers:`, barbers.map(b => ({ id: b.id, name: b.name, is_blocked: b.is_blocked, block_type: b.block_type })));
    
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

// Reset database - clear all barbers, bookings, and payments
router.post('/reset', async (req, res) => {
  try {
    // Clear all tables
    await runQuery('DELETE FROM barbers');
    await runQuery('DELETE FROM bookings');
    await runQuery('DELETE FROM payments');
    
    // Reset auto-increment counters
    await runQuery('DELETE FROM sqlite_sequence WHERE name IN ("barbers", "bookings", "payments")');
    
    res.json({
      success: true,
      message: 'Database reset successfully'
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset database',
      error: error.message
    });
  }
});

// Get barber by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const barber = await getRow(`
      SELECT 
        id, name, phone, email, profile_photo, identity_badge_number,
        is_active, is_blocked, block_reason, blocked_at, blocked_by,
        total_services, total_earnings, current_location,
        last_active, created_at
      FROM barbers 
      WHERE id = ?
    `, [id]);
    
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

// Add new barber with photo upload
router.post('/', upload.single('profile_photo'), async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      identity_badge_number,
      current_location,
      is_active,
      total_services,
      total_earnings
    } = req.body;

    console.log('Received barber data:', req.body);
    console.log('File:', req.file);

    // Validate required fields
    if (!name || !phone || !identity_badge_number) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, and identity badge number are required'
      });
    }

    // Check if phone or identity badge already exists
    const existingBarber = await getRow(
      'SELECT id FROM barbers WHERE phone = $1 OR identity_badge_number = $2',
      [phone, identity_badge_number]
    );

    if (existingBarber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number or identity badge number already exists'
      });
    }

    // Handle profile photo upload
    let profilePhotoPath = null;
    if (req.file) {
      profilePhotoPath = `/uploads/profiles/${req.file.filename}`;
    }

    // Set default values for optional fields
    const activeStatus = is_active === 'true' || is_active === true;
    const servicesCount = total_services ? parseInt(total_services) : 0;
    const earningsAmount = total_earnings ? parseFloat(total_earnings) : 0.0;

    // Debug: Log the values being inserted
    console.log('🔄 Inserting barber with values:', {
      name, phone, email, profilePhotoPath, identity_badge_number, 
      current_location, servicesCount, earningsAmount, activeStatus
    });
    
    // Debug: Log the SQL query
    console.log('🔄 SQL Query:', `
      INSERT INTO barbers (
        name, phone, email, profile_photo, identity_badge_number,
        current_location, total_services, total_earnings, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `);
    
    // Debug: Log the parameters
    console.log('🔄 Parameters:', [name, phone, email, profilePhotoPath, identity_badge_number, current_location, servicesCount, earningsAmount, activeStatus]);

    // Insert new barber
    const result = await runQuery(`
      INSERT INTO barbers (
        name, phone, email, profile_photo, identity_badge_number,
        current_location, total_services, total_earnings, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [name, phone, email, profilePhotoPath, identity_badge_number, current_location, servicesCount, earningsAmount, activeStatus]);

    // Get the created barber
    const newBarber = await getRow('SELECT * FROM barbers WHERE id = $1', [result.id]);

    res.status(201).json({
      success: true,
      message: 'Barber added successfully',
      barber: newBarber
    });

  } catch (error) {
    console.error('❌ Error adding barber:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    res.status(500).json({
      success: false,
      message: 'Failed to add barber',
      error: error.message
    });
  }
});

// Update barber
router.put('/:id', upload.single('profile_photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      email,
      identity_badge_number,
      is_active,
      total_services,
      total_earnings,
      current_location
    } = req.body;

    // Check if barber exists
    const existingBarber = await getRow('SELECT * FROM barbers WHERE id = $1', [id]);
    if (!existingBarber) {
      return res.status(404).json({
        success: false,
        message: 'Barber not found'
      });
    }

    // Check if phone or identity badge conflicts with other barbers
    const conflictCheck = await getRow(
      'SELECT id FROM barbers WHERE (phone = $1 OR identity_badge_number = $2) AND id != $3',
      [phone, identity_badge_number, id]
    );

    if (conflictCheck) {
      return res.status(400).json({
        success: false,
        message: 'Phone number or identity badge number already exists'
      });
    }

    // Handle profile photo update
    let profilePhotoPath = existingBarber.profile_photo;
    if (req.file) {
      // Delete old photo if exists
      if (existingBarber.profile_photo) {
        const oldPhotoPath = path.join(__dirname, '../public', existingBarber.profile_photo);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
      profilePhotoPath = `/uploads/profiles/${req.file.filename}`;
    }

    // Update barber
    await runQuery(`
      UPDATE barbers SET 
        name = $1, phone = $2, email = $3, profile_photo = $4,
        identity_badge_number = $5, is_active = $6, 
        total_services = $7, total_earnings = $8, current_location = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
    `, [name, phone, email, profilePhotoPath, identity_badge_number, is_active, 
        total_services || 0, total_earnings || 0, current_location || '', id]);

    // Get updated barber
    const updatedBarber = await getRow('SELECT * FROM barbers WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Barber updated successfully',
      barber: updatedBarber
    });

  } catch (error) {
    console.error('Error updating barber:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update barber',
      error: error.message
    });
  }
});

// Delete barber
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if barber exists
    const existingBarber = await getRow('SELECT * FROM barbers WHERE id = $1', [id]);
    if (!existingBarber) {
      return res.status(404).json({
        success: false,
        message: 'Barber not found'
      });
    }

    // Check if barber has active bookings
    const activeBookings = await getRow(
      'SELECT id FROM bookings WHERE barber_id = $1 AND status IN (\'pending\', \'in_progress\')',
      [id]
    );

    if (activeBookings) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete barber with active bookings'
      });
    }

    // Delete passport photo if exists
          if (existingBarber.profile_photo) {
        const photoPath = path.join(__dirname, '../public', existingBarber.profile_photo);
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
        }
      }

    // Delete barber
    await runQuery('DELETE FROM barbers WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Barber deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting barber:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete barber',
      error: error.message
    });
  }
});

// Get barber statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    const stats = await getRow(`
      SELECT 
        b.name,
        b.total_services,
        b.total_earnings,
        COUNT(bk.id) as total_bookings,
        COUNT(CASE WHEN bk.status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN bk.status = 'pending' THEN 1 END) as pending_bookings,
        SUM(CASE WHEN bk.status = 'completed' THEN bk.service_price ELSE 0 END) as total_revenue
      FROM barbers b
      LEFT JOIN bookings bk ON b.id = bk.barber_id
      WHERE b.id = ?
      GROUP BY b.id
    `, [id]);

    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'Barber not found'
      });
    }

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching barber stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch barber statistics',
      error: error.message
    });
  }
});

// Block a barber from receiving new bookings
router.post('/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const { block_reason, blocked_by, block_type, block_duration_hours, block_category, block_severity } = req.body;

    if (!block_reason) {
      return res.status(400).json({
        success: false,
        message: 'Block reason is required'
      });
    }

    if (block_type === 'temporary' && !block_duration_hours) {
      return res.status(400).json({
        success: false,
        message: 'Block duration is required for temporary blocks'
      });
    }

    // Check if barber exists
    const barber = await getRow('SELECT id, is_blocked FROM barbers WHERE id = $1', [id]);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: 'Barber not found'
      });
    }

    if (barber.is_blocked) {
      return res.status(400).json({
        success: false,
        message: 'Barber is already blocked'
      });
    }

    // Calculate block expiry for temporary blocks
    let block_expires_at = null;
    if (block_type === 'temporary' && block_duration_hours) {
      block_expires_at = new Date(Date.now() + (block_duration_hours * 60 * 60 * 1000));
    }

    // Block the barber
    await runQuery(`
      UPDATE barbers SET 
        is_blocked = true,
        block_reason = $1,
        blocked_at = CURRENT_TIMESTAMP,
        blocked_by = $2,
        block_type = $3,
        block_duration_hours = $4,
        block_expires_at = $5,
        block_category = $6,
        block_severity = $7
      WHERE id = $8
    `, [block_reason, blocked_by || 1, block_type || 'permanent', block_duration_hours || null, block_expires_at, block_category || 'Policy Violation', block_severity || 'suspension', id]);

    // Send notification after successful blocking
    try {
      await sendBlockNotification(id, block_type, block_duration_hours, block_reason);
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
      // Don't fail the block operation if notification fails
    }

    res.json({
      success: true,
      message: `Barber ${block_type === 'temporary' ? 'temporarily blocked' : 'permanently blocked'} successfully`,
      block_expires_at: block_expires_at
    });
  } catch (error) {
    console.error('Error blocking barber:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block barber',
      error: error.message
    });
  }
});

// Unblock a barber
router.post('/:id/unblock', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if barber exists
    const barber = await getRow('SELECT id, is_blocked FROM barbers WHERE id = $1', [id]);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: 'Barber not found'
      });
    }

    if (!barber.is_blocked) {
      return res.status(400).json({
        success: false,
        message: 'Barber is not blocked'
      });
    }

    // Unblock the barber
    await runQuery(`
      UPDATE barbers SET 
        is_blocked = false,
        block_reason = NULL,
        blocked_at = NULL,
        blocked_by = NULL,
        block_type = NULL,
        block_duration_hours = NULL,
        block_expires_at = NULL,
        block_category = NULL,
        block_severity = NULL
      WHERE id = $1
    `, [id]);

    res.json({
      success: true,
      message: 'Barber unblocked successfully'
    });
  } catch (error) {
    console.error('Error unblocking barber:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unblock barber',
      error: error.message
    });
  }
});

// Check and auto-unblock expired temporary blocks
router.post('/check-expired-blocks', async (req, res) => {
  try {
    console.log('🔍 Checking for expired temporary blocks...');
    
    // Find and unblock expired temporary blocks
    const expiredBlocks = await getAll(`
      SELECT id, name, block_expires_at 
      FROM barbers 
      WHERE is_blocked = true 
        AND block_type = 'temporary' 
        AND block_expires_at IS NOT NULL 
        AND block_expires_at < CURRENT_TIMESTAMP
    `);
    
    if (expiredBlocks.length === 0) {
      return res.json({
        success: true,
        message: 'No expired temporary blocks found',
        unblocked_count: 0
      });
    }
    
    // Unblock expired barbers
    await runQuery(`
      UPDATE barbers SET 
        is_blocked = false,
        block_reason = NULL,
        blocked_at = NULL,
        blocked_by = NULL,
        block_type = NULL,
        block_duration_hours = NULL,
        block_expires_at = NULL
      WHERE is_blocked = true 
        AND block_type = 'temporary' 
        AND block_expires_at < CURRENT_TIMESTAMP
    `);
    
    console.log(`✅ Auto-unblocked ${expiredBlocks.length} expired temporary blocks`);
    
    res.json({
      success: true,
      message: `Auto-unblocked ${expiredBlocks.length} expired temporary blocks`,
      unblocked_count: expiredBlocks.length,
      unblocked_barbers: expiredBlocks
    });
    
  } catch (error) {
    console.error('Error checking expired blocks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check expired blocks',
      error: error.message
    });
  }
});

// Update barber photo
router.post('/:id/photo', upload.single('profile_photo'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if barber exists
    const existingBarber = await getRow('SELECT * FROM barbers WHERE id = $1', [id]);
    if (!existingBarber) {
      return res.status(404).json({
        success: false,
        message: 'Barber not found'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    // Delete old photo if exists
    if (existingBarber.profile_photo) {
      const oldPhotoPath = path.join(__dirname, '../public', existingBarber.profile_photo);
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    // Update photo path
    const profilePhotoPath = `/uploads/profiles/${req.file.filename}`;
    
    await runQuery(`
      UPDATE barbers SET 
        profile_photo = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [profilePhotoPath, id]);

    // Get updated barber
    const updatedBarber = await getRow('SELECT * FROM barbers WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Barber photo updated successfully',
      barber: updatedBarber
    });

  } catch (error) {
    console.error('Error updating barber photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update barber photo',
      error: error.message
    });
  }
});

module.exports = router;
