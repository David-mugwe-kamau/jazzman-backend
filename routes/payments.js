const express = require('express');
const { body, validationResult } = require('express-validator');
const { runQuery, getRow, getAll } = require('../config/database');
const SmartBookingAlgorithm = require('../utils/booking-algorithm');
const router = express.Router();

// Test endpoint to verify server is working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Payment API is working!',
    timestamp: new Date().toISOString()
  });
});

// Validation middleware for payment creation
const validatePayment = [
  body('booking_id').isInt().withMessage('Valid booking ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required'),
  body('payment_method').isIn(['mpesa', 'cash', 'card']).withMessage('Valid payment method is required'),
  body('phone_number').optional().custom((value, { req }) => {
    if (req.body.payment_method === 'mpesa' && !value) {
      throw new Error('Phone number is required for M-Pesa payments');
    }
    if (value && req.body.payment_method === 'mpesa') {
      // Basic phone number validation for Kenya
      const phoneRegex = /^(\+254|254|0)?[17]\d{8}$/;
      if (!phoneRegex.test(value)) {
        throw new Error('Invalid phone number format for Kenya');
      }
    }
    return true;
  })
];

// Create a new payment
router.post('/', validatePayment, async (req, res) => {
  try {
    console.log('🔍 Payment API: Received request body:', req.body);
    console.log('🔍 Payment API: Request headers:', req.headers);
    console.log('🔍 Payment API: Content-Type:', req.get('Content-Type'));
    console.log('🔍 Payment API: Database functions available:', {
      getRow: typeof getRow,
      runQuery: typeof runQuery,
      getAll: typeof getAll
    });
    
    // Log validation errors in detail
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Payment API: Validation errors:', errors.array());
      console.log('❌ Payment API: Validation error details:', {
        booking_id: req.body.booking_id,
        amount: req.body.amount,
        payment_method: req.body.payment_method,
        phone_number: req.body.phone_number,
        customer_notes: req.body.customer_notes
      });
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    console.log('✅ Payment API: Validation passed, processing payment...');

    const {
      booking_id,
      amount,
      payment_method,
      phone_number,
      customer_notes
    } = req.body;

    // Check if booking exists and is unpaid
    console.log('🔍 Payment API: About to query database for booking:', booking_id);
    let booking;
    try {
      booking = await getRow(`
        SELECT 
          b.*, 
          s.name as service_name,
          br.name as barber_name,
          br.phone as barber_phone,
          br.identity_badge_number
        FROM bookings b
        LEFT JOIN services s ON b.service_type = s.name
        LEFT JOIN barbers br ON b.barber_id = br.id
        WHERE b.id = ? AND b.payment_status = 'unpaid'
      `, [booking_id]);
      console.log('🔍 Payment API: Database query result:', booking);
    } catch (dbError) {
      console.error('❌ Payment API: Database error querying booking:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error querying booking',
        error: dbError.message
      });
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or already paid'
      });
    }

    // Validate amount matches service price
    if (Math.abs(amount - booking.service_price) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (${amount}) must match service price (${booking.service_price})`
      });
    }

    let transaction_id = null;
    let payment_status = 'pending';

    // Handle M-Pesa payment
    if (payment_method === 'mpesa') {
      if (!phone_number) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required for M-Pesa payments'
        });
      }

      try {
        // Generate M-Pesa transaction ID
        transaction_id = `MPESA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Simulate M-Pesa payment processing
        // In production, this would integrate with actual M-Pesa API
        const mpesaResult = await processMpesaPayment({
          phone_number,
          amount,
          transaction_id,
          booking_id
        });

        if (mpesaResult.success) {
          payment_status = 'completed';
          transaction_id = mpesaResult.transaction_id;
        } else {
          payment_status = 'failed';
        }
      } catch (error) {
        console.error('M-Pesa payment error:', error);
        payment_status = 'failed';
      }
    } else {
      // For cash/card payments, mark as completed
      payment_status = 'completed';
      transaction_id = `${payment_method.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Create payment record
    console.log('🔍 Payment API: About to create payment record with data:', {
      booking_id, amount, payment_method, transaction_id, payment_status
    });
    
    const paymentResult = await runQuery(`
      INSERT INTO payments (
        booking_id, amount, payment_method, transaction_id, 
        status, receipt_sent, created_at
      ) VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `, [booking_id, amount, payment_method, transaction_id, payment_status]);
    
    console.log('🔍 Payment API: Payment record created successfully:', paymentResult);

    // Update booking payment status
    console.log('🔍 Payment API: About to update booking payment status:', {
      booking_id, payment_status
    });
    
    await runQuery(`
      UPDATE bookings SET 
        payment_status = ?, 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [payment_status, booking_id]);
    
    console.log('🔍 Payment API: Booking payment status updated successfully');

    // If payment is successful, assign barber using smart algorithm
    let assignedBarber = null;
    if (payment_status === 'completed') {
      try {
        console.log('🔍 Payment API: About to assign barber using SmartBookingAlgorithm');
        const barberAssignment = await SmartBookingAlgorithm.getBestBarber(
          booking.preferred_datetime,
          booking.service_type
        );
        
        assignedBarber = barberAssignment.barber;
        
        // Update booking with assigned barber
        await runQuery(`
          UPDATE bookings SET 
            barber_id = ?, 
            barber_name = ?, 
            barber_phone = ?, 
            barber_identity_badge = ?,
            status = 'in_progress',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          assignedBarber.id,
          assignedBarber.name,
          assignedBarber.phone,
          assignedBarber.identity_badge_number,
          booking_id
        ]);

        // Send email notification to barber
        await sendBarberAssignmentNotification(assignedBarber, booking);
        
      } catch (error) {
        console.error('❌ Payment API: Error assigning barber:', error);
        console.error('❌ Payment API: Barber assignment error details:', {
          error: error.message,
          stack: error.stack
        });
        // Continue with payment success even if barber assignment fails
      }
    }

    // Get updated payment record
    const payment = await getRow('SELECT * FROM payments WHERE id = ?', [paymentResult.id]);

    // Send receipt if payment is successful
    if (payment_status === 'completed') {
      try {
        await sendPaymentReceipt(booking, payment, assignedBarber);
        
        // Mark receipt as sent
        await runQuery('UPDATE payments SET receipt_sent = 1 WHERE id = ?', [paymentResult.id]);
      } catch (error) {
        console.error('Error sending receipt:', error);
        // Don't fail the payment if receipt sending fails
      }
    }

    res.status(201).json({
      success: true,
      message: `Payment ${payment_status}`,
      payment: {
        ...payment,
        assigned_barber: assignedBarber,
        receipt_sent: payment_status === 'completed'
      }
    });

  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: error.message
    });
  }
});

// Get payment by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const payment = await getRow(`
      SELECT 
        p.*,
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        b.service_type,
        b.service_price,
        b.preferred_datetime,
        b.address
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE p.id = ?
    `, [id]);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment
    });

  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment',
      error: error.message
    });
  }
});

// Get all payments with filters
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      payment_method, 
      start_date, 
      end_date,
      limit = 50,
      offset = 0
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    if (payment_method) {
      whereClause += ' AND p.payment_method = ?';
      params.push(payment_method);
    }

    if (start_date) {
      whereClause += ' AND DATE(p.created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(p.created_at) <= ?';
      params.push(end_date);
    }

    const payments = await getAll(`
      SELECT 
        p.*,
        b.customer_name,
        b.customer_email,
        b.service_type,
        b.service_price,
        b.preferred_datetime
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Get total count for pagination
    const totalCount = await getRow(`
      SELECT COUNT(*) as count
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      ${whereClause}
    `, params);

    res.json({
      success: true,
      payments,
      pagination: {
        total: totalCount.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalCount.count
      }
    });

  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
});

// Get payment statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (period === 'today') {
      dateFilter = 'AND DATE(p.created_at) = DATE("now")';
    } else if (period === 'week') {
      dateFilter = 'AND DATE(p.created_at) >= DATE("now", "-7 days")';
    } else if (period === 'month') {
      dateFilter = 'AND DATE(p.created_at) >= DATE("now", "-30 days")';
    }

    const stats = await getRow(`
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as successful_payments,
        COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_payments,
        SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN p.status = 'completed' THEN p.amount ELSE NULL END) as average_payment,
        COUNT(CASE WHEN p.payment_method = 'mpesa' THEN 1 END) as mpesa_payments,
        COUNT(CASE WHEN p.payment_method = 'cash' THEN 1 END) as cash_payments,
        COUNT(CASE WHEN p.payment_method = 'card' THEN 1 END) as card_payments
      FROM payments p
      ${dateFilter}
    `, params);

    // Get daily revenue for the last 7 days
    const dailyRevenue = await getAll(`
      SELECT 
        DATE(p.created_at) as date,
        SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as revenue,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as payments
      FROM payments p
      WHERE DATE(p.created_at) >= DATE("now", "-7 days")
      GROUP BY DATE(p.created_at)
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      stats,
      dailyRevenue
    });

  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statistics',
      error: error.message
    });
  }
});

// Resend receipt
router.post('/:id/resend-receipt', async (req, res) => {
  try {
    const { id } = req.params;
    
    const payment = await getRow(`
      SELECT 
        p.*,
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        b.service_type,
        b.service_price,
        b.preferred_datetime,
        b.address,
        br.name as barber_name,
        br.phone as barber_phone,
        br.identity_badge_number
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      LEFT JOIN barbers br ON b.barber_id = br.id
      WHERE p.id = ? AND p.status = 'completed'
    `, [id]);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found or not completed'
      });
    }

    // Resend receipt
    await sendPaymentReceipt(payment, payment, {
      name: payment.barber_name,
      phone: payment.barber_phone,
      identity_badge_number: payment.barber_identity_badge
    });

    // Update receipt sent status
    await runQuery('UPDATE payments SET receipt_sent = 1 WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Receipt resent successfully'
    });

  } catch (error) {
    console.error('Error resending receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend receipt',
      error: error.message
    });
  }
});

// Helper function to process M-Pesa payment
async function processMpesaPayment(paymentData) {
  // This is a simulation of M-Pesa payment processing
  // In production, you would integrate with actual M-Pesa API
  
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate 95% success rate
      const isSuccess = Math.random() > 0.05;
      
      if (isSuccess) {
        resolve({
          success: true,
          transaction_id: paymentData.transaction_id,
          message: 'Payment processed successfully'
        });
      } else {
        resolve({
          success: false,
          message: 'Payment failed - insufficient funds'
        });
      }
    }, 2000); // Simulate 2-second processing time
  });
}

// Helper function to send payment receipt
async function sendPaymentReceipt(booking, payment, assignedBarber) {
  try {
    // Generate receipt HTML
    const receiptHtml = generateReceiptHTML(booking, payment, assignedBarber);
    
    // Send email using nodemailer (configured in your system)
    // This is a placeholder - implement actual email sending logic
    console.log('📧 Receipt generated and ready to send:', {
      to: booking.customer_email,
      subject: `Payment Receipt - ${booking.service_type}`,
      amount: payment.amount,
      transaction_id: payment.transaction_id
    });

    return true;
  } catch (error) {
    console.error('Error sending receipt:', error);
    throw error;
  }
}

// Helper function to send barber notification
async function sendBarberNotification(barber, booking) {
  try {
    // Send SMS/WhatsApp notification to barber
    // This is a placeholder - implement actual notification logic
    console.log('📱 Barber notification sent:', {
      to: barber.phone,
      barber: barber.name,
      customer: booking.customer_name,
      service: booking.service_type,
      datetime: booking.preferred_datetime,
      address: booking.address
    });

    return true;
  } catch (error) {
    console.error('Error sending barber notification:', error);
    throw error;
  }
}

// Helper function to generate receipt HTML
function generateReceiptHTML(booking, payment, assignedBarber) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Payment Receipt - JazzMan Housecalls</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .receipt { border: 2px solid #333; padding: 20px; max-width: 600px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .details { margin: 20px 0; }
        .row { display: flex; justify-content: space-between; margin: 10px 0; }
        .barber-info { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <h1>🎯 JazzMan Housecalls</h1>
          <h2>Payment Receipt</h2>
          <p>Receipt #: ${payment.id}</p>
          <p>Date: ${new Date(payment.created_at).toLocaleDateString()}</p>
        </div>
        
        <div class="details">
          <h3>Customer Information</h3>
          <div class="row">
            <span><strong>Name:</strong></span>
            <span>${booking.customer_name}</span>
          </div>
          <div class="row">
            <span><strong>Phone:</strong></span>
            <span>${booking.customer_phone}</span>
          </div>
          <div class="row">
            <span><strong>Address:</strong></span>
            <span>${booking.address}</span>
          </div>
        </div>
        
        <div class="details">
          <h3>Service Details</h3>
          <div class="row">
            <span><strong>Service:</strong></span>
            <span>${booking.service_type}</span>
          </div>
          <div class="row">
            <span><strong>Date & Time:</strong></span>
            <span>${new Date(booking.preferred_datetime).toLocaleString()}</span>
          </div>
          <div class="row">
            <span><strong>Amount:</strong></span>
            <span>KES ${payment.amount.toLocaleString()}</span>
          </div>
        </div>
        
        <div class="barber-info">
          <h3>Your Assigned Barber</h3>
          <div class="row">
            <span><strong>Name:</strong></span>
            <span>${assignedBarber.name}</span>
          </div>
          <div class="row">
            <span><strong>Phone:</strong></span>
            <span>${assignedBarber.phone}</span>
          </div>
          <div class="row">
            <span><strong>Identity Badge:</strong></span>
            <span>${assignedBarber.identity_badge_number}</span>
          </div>
        </div>
        
        <div class="details">
          <h3>Payment Information</h3>
          <div class="row">
            <span><strong>Payment Method:</strong></span>
            <span>${payment.payment_method.toUpperCase()}</span>
          </div>
          <div class="row">
            <span><strong>Transaction ID:</strong></span>
            <span>${payment.transaction_id}</span>
          </div>
          <div class="row">
            <span><strong>Status:</strong></span>
            <span style="color: green;">${payment.status.toUpperCase()}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for choosing JazzMan Housecalls!</p>
          <p>For any questions, contact us at +254 XXX XXX XXX</p>
          <p>This is an automated receipt. Please keep it for your records.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = router;
