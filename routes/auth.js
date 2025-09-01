const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getRow, runQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Admin login
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').trim().notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Find admin user
    const admin = await getRow(
      'SELECT * FROM admin_users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'JazzMan2025SecretKey123!@#';
    console.log('JWT_SECRET from env:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
    console.log('Using JWT_SECRET:', jwtSecret);
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username, 
        role: admin.role 
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id;

    const admin = await getRow(
      'SELECT id, username, email, role, created_at FROM admin_users WHERE id = $1',
      [userId]
    );

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: admin
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

// Verify token (for frontend to check if user is still logged in)
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const admin = await getRow(
      'SELECT id, username, email, role FROM admin_users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Token invalid or user not found'
      });
    }

    res.json({
      success: true,
      user: admin
    });

  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({
      success: false,
      message: 'Token verification failed',
      error: error.message
    });
  }
});

// Change password (authenticated)
router.post('/change-password', authenticateToken, [
  body('current_password').trim().notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    const admin = await getRow('SELECT id, password_hash FROM admin_users WHERE id = $1 AND is_active = true', [userId]);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const valid = await bcrypt.compare(current_password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashed = bcrypt.hashSync(new_password, 10);
    await runQuery('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hashed, userId]);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: 'Failed to change password', error: error.message });
  }
});

module.exports = router;