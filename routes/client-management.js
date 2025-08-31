const express = require('express');
const router = express.Router();
const { getRow, getAll, runQuery } = require('../config/database');

// Get all clients
router.get('/', async (req, res) => {
  try {
    const clients = await getAll(`
      SELECT 
        c.*,
        COUNT(b.id) as total_bookings,
        MAX(b.created_at) as last_booking_date,
        SUM(CASE WHEN p.status = 'received' THEN p.amount ELSE 0 END) as total_spent
      FROM clients c
      LEFT JOIN bookings b ON c.phone = b.customer_phone
      LEFT JOIN payments p ON b.id = p.booking_id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.total_bookings DESC, c.last_booking_date DESC
    `);

    res.json({
      success: true,
      clients: clients
    });
  } catch (error) {
    console.error('❌ Error fetching clients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clients',
      error: error.message
    });
  }
});

// Get client by phone number
router.get('/phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const client = await getRow(`
      SELECT 
        c.*,
        COUNT(b.id) as total_bookings,
        MAX(b.created_at) as last_booking_date,
        SUM(CASE WHEN p.status = 'received' THEN p.amount ELSE 0 END) as total_spent
      FROM clients c
      LEFT JOIN bookings b ON c.phone = b.customer_phone
      LEFT JOIN payments p ON b.id = p.booking_id
      WHERE c.phone = $1 AND c.is_active = true
      GROUP BY c.id
    `, [phone]);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Get client's booking history
    const bookingHistory = await getAll(`
      SELECT 
        b.id,
        b.service_type,
        b.preferred_datetime,
        b.status,
        b.address,
        br.name as barber_name,
        p.amount,
        p.status as payment_status
      FROM bookings b
      LEFT JOIN barbers br ON b.barber_id = br.id
      LEFT JOIN payments p ON b.id = p.booking_id
      WHERE b.customer_phone = $1
      ORDER BY b.created_at DESC
      LIMIT 10
    `, [phone]);

    res.json({
      success: true,
      client: {
        ...client,
        booking_history: bookingHistory
      }
    });
  } catch (error) {
    console.error('❌ Error fetching client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client',
      error: error.message
    });
  }
});

// Create or update client (called when making a booking)
router.post('/upsert', async (req, res) => {
  try {
    const { 
      phone, 
      name, 
      email, 
      address, 
      location_notes,
      service_type 
    } = req.body;

    if (!phone || !name) {
      return res.status(400).json({
        success: false,
        message: 'Phone and name are required'
      });
    }

    // Check if client exists
    const existingClient = await getRow(`
      SELECT * FROM clients WHERE phone = ?
    `, [phone]);

    if (existingClient) {
      // Update existing client
      const result = await runQuery(`
        UPDATE clients 
        SET 
          name = ?,
          email = COALESCE(?, email),
          address = COALESCE(?, address),
          location_notes = COALESCE(?, location_notes),
          total_bookings = total_bookings + 1,
          last_booking_date = CURRENT_TIMESTAMP,
          favorite_service = CASE 
            WHEN ? IS NOT NULL THEN ?
            ELSE favorite_service
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE phone = ?
      `, [name, email, address, location_notes, service_type, service_type, phone]);

      if (result.changes === 0) {
        return res.status(400).json({
          success: false,
          message: 'Failed to update client'
        });
      }

      console.log(`👤 Updated existing client: ${name} (${phone}) - Total bookings: ${existingClient.total_bookings + 1}`);

      res.json({
        success: true,
        message: 'Client updated successfully',
        client_id: existingClient.id,
        action: 'updated'
      });
    } else {
      // Create new client
      const result = await runQuery(`
        INSERT INTO clients (
          phone, name, email, address, location_notes, 
          preferred_service, total_bookings, last_booking_date,
          favorite_service, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [phone, name, email, address, location_notes, service_type, service_type]);

      if (result.lastID) {
        console.log(`👤 Created new client: ${name} (${phone}) - First booking: ${service_type}`);
        
        res.json({
          success: true,
          message: 'Client created successfully',
          client_id: result.lastID,
          action: 'created'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Failed to create client'
        });
      }
    }

  } catch (error) {
    console.error('❌ Error upserting client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upsert client',
      error: error.message
    });
  }
});

// Update client preferences
router.put('/:id/preferences', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      preferred_service, 
      preferred_barber_name, 
      preferred_barber_phone,
      notes 
    } = req.body;

    const result = await runQuery(`
      UPDATE clients 
      SET 
        preferred_service = COALESCE(?, preferred_service),
        preferred_barber_name = COALESCE(?, preferred_barber_name),
        preferred_barber_phone = COALESCE(?, preferred_barber_phone),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [preferred_service, preferred_barber_name, preferred_barber_phone, notes, id]);

    if (result.changes === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update client preferences'
      });
    }

    // Get updated client
    const updatedClient = await getRow(`
      SELECT * FROM clients WHERE id = ?
    `, [id]);

    console.log(`👤 Updated client preferences: ${updatedClient.name} (${updatedClient.phone})`);

    res.json({
      success: true,
      message: 'Client preferences updated successfully',
      client: updatedClient
    });

  } catch (error) {
    console.error('❌ Error updating client preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update client preferences',
      error: error.message
    });
  }
});

// Get client statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await getRow(`
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN total_bookings > 1 THEN 1 END) as returning_clients,
        COUNT(CASE WHEN total_bookings = 1 THEN 1 END) as new_clients,
        AVG(total_bookings) as average_bookings_per_client,
        SUM(total_spent) as total_revenue_from_clients
      FROM clients
      WHERE is_active = 1
    `);

    // Get top clients by bookings
    const topClients = await getAll(`
      SELECT 
        name,
        phone,
        total_bookings,
        total_spent,
        favorite_service,
        last_booking_date
      FROM clients
      WHERE is_active = 1
      ORDER BY total_bookings DESC, total_spent DESC
      LIMIT 10
    `);

    // Get clients by service preference
    const servicePreferences = await getAll(`
      SELECT 
        favorite_service,
        COUNT(*) as client_count
      FROM clients
      WHERE is_active = 1 AND favorite_service IS NOT NULL
      GROUP BY favorite_service
      ORDER BY client_count DESC
    `);

    res.json({
      success: true,
      stats: {
        ...stats,
        top_clients: topClients,
        service_preferences: servicePreferences
      }
    });

  } catch (error) {
    console.error('❌ Error fetching client statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client statistics',
      error: error.message
    });
  }
});

// Search clients
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const searchQuery = `%${query}%`;

    const clients = await getAll(`
      SELECT 
        c.*,
        COUNT(b.id) as total_bookings,
        MAX(b.created_at) as last_booking_date
      FROM clients c
      LEFT JOIN bookings b ON c.phone = b.customer_phone
      WHERE c.is_active = 1 
        AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)
      GROUP BY c.id
      ORDER BY c.total_bookings DESC
      LIMIT 20
    `, [searchQuery, searchQuery, searchQuery]);

    res.json({
      success: true,
      clients: clients,
      search_query: query
    });

  } catch (error) {
    console.error('❌ Error searching clients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search clients',
      error: error.message
    });
  }
});

module.exports = router;
