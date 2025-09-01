const express = require('express');
const { body, validationResult } = require('express-validator');
const { runQuery, getRow, getAll } = require('../config/database');
const workingHoursManager = require('../utils/working-hours');
const { sendBarberAssignmentNotification } = require('../utils/email');
const router = express.Router();

// Validation middleware
const validateBooking = [
  body('customer_name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('customer_email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email format'),
  body('customer_phone').trim().notEmpty().withMessage('Phone number is required'),
  body('address').trim().isLength({ min: 5 }).withMessage('Address must be at least 5 characters'),
  body('preferred_datetime').isISO8601().withMessage('Invalid date format'),
  body('service_type').trim().notEmpty().withMessage('Service type is required'),
  body('service_price').isFloat({ min: 0 }).withMessage('Invalid price'),
  body('payment_method').trim().notEmpty().withMessage('Payment method is required'),
  // Barber fields are now optional - will be auto-assigned
  body('barber_name').optional().trim(),
  body('barber_phone').optional().trim()
];

// Create a new booking
router.post('/', validateBooking, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      customer_name,
      customer_email,
      customer_phone,
      address,
      preferred_datetime,
      service_type,
      service_price,
      notes,
      barber_name: preferred_barber_name,
      barber_phone: preferred_barber_phone
    } = req.body;

    // Check if the requested time is within working hours
    const workingHoursCheck = await workingHoursManager.isWithinWorkingHours(preferred_datetime);
    if (!workingHoursCheck.isOpen) {
      return res.status(400).json({
        success: false,
        message: workingHoursCheck.reason,
        nextOpen: workingHoursCheck.nextOpen,
        error: 'BOOKING_OUTSIDE_HOURS'
      });
    }

    // Check for time slot conflicts (prevent double-booking)
    // All services take 1 hour + 1 hour travel buffer each way = 3 hour total per booking
    const timeSlotConflict = await getRow(`
      SELECT 
        id, barber_name, service_type, preferred_datetime, status
      FROM bookings 
      WHERE 
        status NOT IN ('cancelled', 'completed', 'no_show')
        AND (
          -- Same time slot (exact match)
          preferred_datetime = $1 
          OR 
          -- Overlapping time slots (1 hour before + 1 hour service + 1 hour after = 3 hours total)
          (
            preferred_datetime BETWEEN 
              $2::timestamp - INTERVAL '1 hour' AND $2::timestamp + INTERVAL '2 hours'
          )
        )
      LIMIT 1
    `, [preferred_datetime, preferred_datetime, preferred_datetime]);

    if (timeSlotConflict) {
      return res.status(409).json({
        success: false,
        message: `This time slot is not available. All barbers are currently booked at this time. Please choose a different time slot.`,
        error: 'TIME_SLOT_CONFLICT',
        suggestion: 'Try booking 3 hours later or earlier to avoid conflicts (each booking blocks a 3-hour time slot)'
      });
    }



    // Check for customer double-booking (same customer, same day)
    // Also check for overlapping time slots (3-hour blocks)
    const customerConflict = await getRow(`
      SELECT 
        id, service_type, preferred_datetime, status
      FROM bookings 
      WHERE 
        customer_phone = $1 
        AND status NOT IN ('cancelled', 'completed', 'no_show')
        AND (
          -- Same day booking
          (preferred_datetime >= $2::date AND preferred_datetime < ($2::date + interval '1 day'))
          OR
          -- Overlapping time slots (3-hour blocks)
          (
            preferred_datetime BETWEEN 
              $2::timestamp - INTERVAL '1 hour' AND $2::timestamp + INTERVAL '2 hours'
          )
        )
      LIMIT 1
    `, [customer_phone, preferred_datetime]);

    if (customerConflict) {
      return res.status(409).json({
        success: false,
        message: `You already have a ${customerConflict.service_type} appointment scheduled for the same day. Please cancel your existing appointment first or choose a different date.`,
        error: 'CUSTOMER_DOUBLE_BOOKING',
        suggestion: 'You can only have one appointment per day'
      });
    }

    // 🆕 CLIENT MEMORY SYSTEM: Create or update client record
    try {
      const clientData = {
        phone: customer_phone,
        name: customer_name,
        email: customer_email,
        address: address,
        location_notes: req.body.location_notes || null,
        service_type: service_type
      };

      // Make internal API call to upsert client
      const clientResponse = await fetch(`${req.protocol}://${req.get('host')}/api/clients/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData)
      });

      if (clientResponse.ok) {
        const clientResult = await clientResponse.json();
        console.log(`👤 Client ${clientResult.action}: ${customer_name} (${customer_phone}) - ${service_type}`);
      } else {
        console.log(`⚠️ Client memory system not available, continuing with booking...`);
      }
    } catch (clientError) {
      console.log(`⚠️ Client memory system error, continuing with booking:`, clientError.message);
    }

    // Check if customer has a preferred barber
    let assignedBarber;
    
    if (preferred_barber_name && preferred_barber_phone) {
      // Customer specified a preferred barber - check if available
      const preferredBarber = await getRow(`
        SELECT id, name, phone, identity_badge_number, total_services, last_active, COALESCE(profile_photo, '') as profile_photo
        FROM barbers 
        WHERE name = $1 AND phone = $2 AND is_active = true AND is_blocked = false
      `, [preferred_barber_name, preferred_barber_phone]);
      
      if (preferredBarber) {
        assignedBarber = preferredBarber;
        console.log(`🎯 Using customer's preferred barber: ${assignedBarber.name} (ID: ${assignedBarber.id})`);
      } else {
        console.log(`⚠️ Preferred barber ${preferred_barber_name} not available, will auto-assign`);
      }
    }
    
    // If no preferred barber or preferred barber unavailable, auto-assign
    if (!assignedBarber) {
      // Get all available barbers ordered by badge ID for proper round-robin assignment
      const availableBarbers = await getAll(`
        SELECT 
          id, name, phone, email, identity_badge_number,
          total_services, last_active, COALESCE(profile_photo, '') as profile_photo,
          is_active, is_blocked
        FROM barbers 
        WHERE is_active = true AND is_blocked = false 
        ORDER BY identity_badge_number
      `);
      
      // Debug: Log all available barbers
      console.log(`🔍 Available barbers for assignment:`, availableBarbers.map(b => `${b.name} (Badge: ${b.identity_badge_number}, ID: ${b.id})`));
      
      if (availableBarbers.length === 0) {
        return res.status(503).json({
          success: false,
          message: 'No barbers available at the moment. Please try again later.'
        });
      }
      
      // Get the total number of bookings today to determine which barber to assign
      const totalBookingsToday = await getRow(`
        SELECT COUNT(*) as count 
        FROM bookings 
        WHERE created_at >= CURRENT_DATE 
        AND created_at < (CURRENT_DATE + INTERVAL '1 day')
        AND status != 'cancelled'
      `);
      
      const totalBookings = totalBookingsToday.count || 0;
      const barberIndex = totalBookings % availableBarbers.length;
      assignedBarber = availableBarbers[barberIndex];
      
      console.log(`🎯 Auto-assigning barber: ${assignedBarber.name} (Badge: ${assignedBarber.identity_badge_number}) - Booking #${totalBookings + 1} of the day (Index: ${barberIndex}/${availableBarbers.length})`);
    }

        // Automatically find an available barber for this time slot
    // This ensures each barber has proper time management: 1 hour service + 1 hour travel buffer each way
    let barberFound = false;
    let attempts = 0;
    const maxAttempts = 3; // Try all 3 barbers
    
    while (!barberFound && attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 Attempt ${attempts}: Checking barber ${assignedBarber.name} (${assignedBarber.identity_badge_number})`);
      
      const barberSchedulingConflict = await getRow(`
        SELECT id FROM bookings 
        WHERE barber_id = $1 
        AND status NOT IN ('cancelled', 'completed', 'no_show')
        AND (
          -- Same time slot (exact match)
          preferred_datetime = $2 
          OR 
          -- Overlapping time slots for the same barber (1 hour before + 1 hour service + 1 hour after = 3 hours total)
          (
            preferred_datetime BETWEEN 
              $3::timestamp - INTERVAL '1 hour' AND $3::timestamp + INTERVAL '2 hours'
          )
        )
        LIMIT 1
      `, [assignedBarber.id, preferred_datetime, preferred_datetime, preferred_datetime]);

      if (!barberSchedulingConflict) {
        // This barber is available
        barberFound = true;
        console.log(`✅ Barber ${assignedBarber.name} (${assignedBarber.identity_badge_number}) is available for this time slot`);
        break;
      } else {
        console.log(`⚠️ Barber ${assignedBarber.name} is busy, trying next available barber...`);
        
        // Try to find the next available barber
        const nextAvailableBarber = await getRow(`
          SELECT id, name, phone, email, identity_badge_number, COALESCE(profile_photo, '') as profile_photo
          FROM barbers 
          WHERE is_active = true AND is_blocked = false 
          AND id != $1
          AND identity_badge_number > $2
          ORDER BY identity_badge_number
          LIMIT 1
        `, [assignedBarber.id, assignedBarber.identity_badge_number]);

        if (nextAvailableBarber) {
          // Try the next barber
          assignedBarber = nextAvailableBarber;
          console.log(`🔄 Trying next barber: ${assignedBarber.name} (${assignedBarber.identity_badge_number})`);
        } else {
          // No more barbers available, try the first one (JM001)
          const firstBarber = await getRow(`
            SELECT id, name, phone, email, identity_badge_number, COALESCE(profile_photo, '') as profile_photo
            FROM barbers 
            WHERE is_active = true AND is_blocked = false 
            ORDER BY identity_badge_number
            LIMIT 1
          `);
          
          if (firstBarber && firstBarber.id !== assignedBarber.id) {
            assignedBarber = firstBarber;
            console.log(`🔄 Trying first barber: ${assignedBarber.name} (${assignedBarber.identity_badge_number})`);
          } else {
            // We've tried all barbers, break the loop
            break;
          }
        }
      }
    }
    
    // If no barber is available after trying all options
    if (!barberFound) {
      console.log(`❌ All barbers are busy at this time slot`);
      return res.status(409).json({
        success: false,
        message: `All barbers are currently booked at this time. Please choose a different time slot.`,
        error: 'ALL_BARBERS_BUSY',
        suggestion: 'Try booking 3 hours later or earlier to avoid conflicts (each booking blocks a 3-hour time slot)'
      });
    }
    
    // Insert booking into database with assigned barber
    const result = await runQuery(`
      INSERT INTO bookings (
        customer_name, customer_email, customer_phone, address, 
        location_notes, preferred_datetime, service_type, service_price, 
        barber_id, barber_name, barber_phone, barber_identity_badge, notes, payment_method, mpesa_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `, [
      customer_name, customer_email, customer_phone, address,
      req.body.location_notes, preferred_datetime, service_type, service_price,
      assignedBarber.id, assignedBarber.name, assignedBarber.phone, assignedBarber.identity_badge_number,
      notes, req.body.payment_method, req.body.mpesa_phone
    ]);

    console.log('🔍 Insert result:', result);

    // Get the created booking
    const booking = await getRow('SELECT * FROM bookings WHERE id = $1', [result.id]);
    
    if (!booking) {
      console.error('❌ Failed to retrieve created booking with ID:', result.id);
      return res.status(500).json({
        success: false,
        message: 'Booking created but failed to retrieve details',
        error: 'Could not retrieve created booking'
      });
    }

    // Send barber assignment notification ASYNCHRONOUSLY (don't wait for email)
    // This ensures the booking response is sent immediately to the customer
    if (assignedBarber.email) {
      console.log(`🔍 Sending barber notification to: ${assignedBarber.name} (${assignedBarber.email})`);
      
      // Fire-and-forget email notification (don't await)
      sendBarberAssignmentNotification(assignedBarber, booking)
        .then(() => {
          console.log(`✅ Barber notification sent successfully to ${assignedBarber.name}`);
        })
        .catch((emailError) => {
          console.error(`⚠️ Failed to send barber notification to ${assignedBarber.name}:`, emailError.message);
          // Don't fail the booking creation if email fails
        });
    } else {
      console.log(`⚠️ Barber ${assignedBarber.name} has no email address. Cannot send email notification.`);
      console.log(`📱 Consider sending SMS notification to: ${assignedBarber.phone}`);
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: {
        id: booking.id,
        customer_name: booking.customer_name,
        service_type: booking.service_type,
        assigned_barber: {
          name: assignedBarber.name,
          phone: assignedBarber.phone,
          profile_photo: assignedBarber.profile_photo
        },
        preferred_datetime: booking.preferred_datetime,
        status: booking.status,
        barber: {
          id: assignedBarber.id,
          name: assignedBarber.name,
          phone: assignedBarber.phone,
          identity_badge: assignedBarber.identity_badge_number
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating booking:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Request body:', req.body);
    
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get all bookings (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { status, barber, date, limit = 50, offset = 0, show_completed = 'false' } = req.query;
    
    let sql = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];

    // Add filters
    if (status) {
      sql += ' AND status = $' + (params.length + 1);
      params.push(status);
    }
    
    if (barber) {
      sql += ' AND barber_name = $' + (params.length + 1);
      params.push(barber);
    }
    
    if (date) {
      sql += ' AND preferred_datetime >= $' + (params.length + 1) + '::date';
      sql += ' AND preferred_datetime < ($' + (params.length + 1) + '::date + interval \'1 day\')';
      params.push(date);
    }

    // Temporarily show all bookings for debugging
    // if (show_completed !== 'true') {
    //   sql += ' AND (status != "completed" OR DATE(preferred_datetime) >= DATE("now"))';
    // }

    // Add ordering and pagination
    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), parseInt(offset));

    const bookings = await getAll(sql, params);

    res.json({
      success: true,
      bookings,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: bookings.length
      }
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
});

// Get a specific booking by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const booking = await getRow('SELECT * FROM bookings WHERE id = $1', [id]);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      booking
    });

  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: error.message
    });
  }
});

// Update booking status
router.patch('/:id/status', [
  body('status').isIn(['pending', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    // Check if booking exists
    const existingBooking = await getRow('SELECT * FROM bookings WHERE id = $1', [id]);
    if (!existingBooking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Update booking
    await runQuery(
      'UPDATE bookings SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [status, notes, id]
    );

    // Get updated booking
    const updatedBooking = await getRow('SELECT * FROM bookings WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      booking: updatedBooking
    });

  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message
    });
  }
});

// Cancel a booking
router.post('/:id/cancel', [
  body('cancellation_reason').trim().isLength({ min: 5 }).withMessage('Cancellation reason must be at least 5 characters'),
  body('cancelled_by').trim().isLength({ min: 2 }).withMessage('Cancelled by must be at least 2 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { cancellation_reason, cancelled_by } = req.body;

    // Check if booking exists and can be cancelled
    const existingBooking = await getRow('SELECT * FROM bookings WHERE id = $1', [id]);
    if (!existingBooking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (existingBooking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    if (existingBooking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed booking'
      });
    }

    // Update booking with cancellation details
    await runQuery(`
      UPDATE bookings 
      SET status = 'cancelled', 
          cancellation_reason = $1, 
          cancelled_at = CURRENT_TIMESTAMP, 
          cancelled_by = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [cancellation_reason, cancelled_by, id]);

    // Get updated booking
    const updatedBooking = await getRow('SELECT * FROM bookings WHERE id = $1', [id]);

    // Log the cancellation for barber notification
    console.log(`📱 BARBER NOTIFICATION NEEDED:`);
    console.log(`   Booking ID: ${id}`);
    console.log(`   Cancelled by: ${cancelled_by}`);
    console.log(`   Barber: ${updatedBooking.barber_name} (${updatedBooking.barber_phone})`);
    console.log(`   Service: ${updatedBooking.service_type}`);
    console.log(`   Customer: ${updatedBooking.customer_name} (${updatedBooking.customer_phone})`);
    console.log(`   Reason: ${cancellation_reason}`);
    console.log(`   Time: ${new Date().toLocaleString()}`);
    console.log(`   ---`);
    
    // Send real barber notification via email
    let notificationSent = false;
    try {
      // Get barber details for notification
      const barber = await getRow(`
        SELECT id, name, phone, email, identity_badge_number
        FROM barbers 
        WHERE id = $1
      `, [updatedBooking.barber_id]);
      
      if (barber && barber.email) {
        // Send cancellation notification email
        const emailSubject = `🚫 Booking #${id} Cancelled - ${updatedBooking.service_type}`;
        const emailBody = `
          Hello ${barber.name},
          
          A booking has been cancelled that was assigned to you.
          
          📋 Booking Details:
          - Booking ID: ${id}
          - Service: ${updatedBooking.service_type}
          - Customer: ${updatedBooking.customer_name} (${updatedBooking.customer_phone})
          - Date/Time: ${updatedBooking.preferred_datetime}
          - Address: ${updatedBooking.address}
          
          🚫 Cancellation Details:
          - Cancelled by: ${cancelled_by}
          - Reason: ${cancellation_reason}
          - Cancelled at: ${new Date().toLocaleString()}
          
          This booking has been removed from your schedule. You can now accept other bookings for this time slot.
          
          Best regards,
          JazzMan Housecalls Team
        `;
        
        // Send cancellation notification using nodemailer directly
        const nodemailer = require('nodemailer');
        
        // Create transporter
        const transporter = nodemailer.createTransport({
          service: process.env.EMAIL_SERVICE || 'gmail',
          auth: {
            user: process.env.EMAIL_USER || 'jazzmanhousecalls@gmail.com',
            pass: process.env.EMAIL_PASS
          }
        });
        
        // Send email
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: barber.email,
          subject: emailSubject,
          html: emailBody.replace(/\n/g, '<br>')
        };
        
        await transporter.sendMail(mailOptions);
        
        notificationSent = true;
        console.log(`✅ Cancellation notification sent to ${barber.name} (${barber.email})`);
      } else {
        console.log(`⚠️ Barber ${updatedBooking.barber_name} has no email address. Skipping notification.`);
      }
    } catch (emailError) {
      console.error('❌ Error sending cancellation notification:', emailError);
      // Don't fail the cancellation if email fails
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: updatedBooking,
      notification_sent: notificationSent
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error.message
    });
  }
});

// Get booking statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await getAll(`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings,

        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
        SUM(CASE WHEN status = 'completed' THEN service_price ELSE 0 END) as total_revenue
      FROM bookings
    `);

    res.json({
      success: true,
      stats: stats[0]
    });

  } catch (error) {
    console.error('Error fetching booking stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking statistics',
      error: error.message
    });
  }
});

// Get available time slots for a specific date
router.get('/available-slots/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { duration = 60 } = req.query; // Default 60 minutes
    
    const slots = await workingHoursManager.getAvailableTimeSlots(date, parseInt(duration));
    
    res.json({
      success: true,
      date,
      slots,
      count: slots.length,
      message: slots.length > 0 ? 
        `Found ${slots.length} available time slots` : 
        'No available time slots for this date'
    });
  } catch (error) {
    console.error('Error fetching available time slots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available time slots',
      error: error.message
    });
  }
});

// Reschedule booking (PUT endpoint for rescheduling)
router.put('/:id', [
  body('preferred_datetime').isISO8601().withMessage('Invalid date format'),
  body('notes').optional().isString().withMessage('Notes must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { preferred_datetime, notes } = req.body;
    
    // Check if booking exists
    const existingBooking = await getRow('SELECT * FROM bookings WHERE id = $1', [id]);
    if (!existingBooking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking can be rescheduled (not completed or cancelled)
    if (existingBooking.status === 'completed' || existingBooking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule a completed or cancelled booking'
      });
    }

    // Check working hours for new datetime
    const workingHoursCheck = await workingHoursManager.isWithinWorkingHours(preferred_datetime);
    if (!workingHoursCheck.isOpen) {
      return res.status(400).json({
        success: false,
        message: workingHoursCheck.reason,
        nextOpen: workingHoursCheck.nextOpen,
        error: 'BOOKING_OUTSIDE_HOURS'
      });
    }

    // Check for barber conflicts at new time
    const barberConflict = await getRow(`
      SELECT id FROM bookings 
      WHERE barber_name = $1 
      AND id != $2 
      AND status != 'cancelled'
      AND preferred_datetime BETWEEN $3::timestamp - INTERVAL '1 hour' AND $3::timestamp + INTERVAL '2 hours'
    `, [existingBooking.barber_name, id, preferred_datetime]);

    if (barberConflict) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is not available. The assigned barber is busy at this time. Please choose a different time slot.',
        error: 'BARBER_CONFLICT'
      });
    }

    // Update the booking
    const updateQuery = `
      UPDATE bookings 
      SET preferred_datetime = $1::timestamp, 
          notes = CASE WHEN $2::text IS NOT NULL THEN $2::text ELSE notes END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = $3::integer
      RETURNING *
    `;
    
    const updatedBooking = await runQuery(updateQuery, [preferred_datetime, notes, id]);
    
    if (!updatedBooking || !updatedBooking.rows || updatedBooking.rows.length === 0) {
      throw new Error('Failed to update booking');
    }
    
    res.json({
      success: true,
      message: 'Booking rescheduled successfully',
      booking: updatedBooking.rows[0]
    });
    
  } catch (error) {
    console.error('Error rescheduling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reschedule booking',
      error: error.message
    });
  }
});

// Update booking details (general update)
router.patch('/:id', [
  body('preferred_datetime').optional().isISO8601().withMessage('Invalid date format'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
  body('customer_name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('customer_phone').optional().trim().notEmpty().withMessage('Phone number is required'),
  body('customer_email').optional().isEmail().withMessage('Invalid email format'),
  body('address').optional().trim().isLength({ min: 5 }).withMessage('Address must be at least 5 characters'),
  body('service_type').optional().trim().notEmpty().withMessage('Service type is required'),
  body('service_price').optional().isFloat({ min: 0 }).withMessage('Invalid price')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;
    
    // Check if booking exists
    const existingBooking = await getRow('SELECT * FROM bookings WHERE id = $1', [id]);
    if (!existingBooking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // If updating datetime, check working hours
    if (updates.preferred_datetime) {
      const workingHoursCheck = await workingHoursManager.isWithinWorkingHours(updates.preferred_datetime);
      if (!workingHoursCheck.isOpen) {
        return res.status(400).json({
          success: false,
          message: workingHoursCheck.reason,
          nextOpen: workingHoursCheck.nextOpen,
          error: 'BOOKING_OUTSIDE_HOURS'
        });
      }
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && updates[key] !== null) {
        updateFields.push(`${key} = $` + (updateValues.length + 1));
        updateValues.push(updates[key]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    
    const updateQuery = `UPDATE bookings SET ${updateFields.join(', ')} WHERE id = $` + (updateValues.length + 1);
    
    await runQuery(updateQuery, updateValues);
    
    // Get updated booking
    const updatedBooking = await getRow('SELECT * FROM bookings WHERE id = $1', [id]);
    
    res.json({
      success: true,
      message: 'Booking updated successfully',
      booking: updatedBooking
    });
    
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking',
      error: error.message
    });
  }
});

module.exports = router;