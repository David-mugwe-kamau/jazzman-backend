const express = require('express');
const router = express.Router();
const { getRow, getAll, runQuery } = require('../config/database');

// Utility function to ensure payment_method_used column exists (Render-safe)
async function ensurePaymentMethodUsedColumn() {
  try {
    // Check if column exists first
    const columnCheck = await getRow(`PRAGMA table_info(payments)`);
    const hasColumn = columnCheck && columnCheck.some(col => col.name === 'payment_method_used');
    
    if (!hasColumn) {
      await runQuery(`ALTER TABLE payments ADD COLUMN payment_method_used TEXT`);
      console.log('✅ Added payment_method_used column to payments table');
      return true;
    } else {
      console.log('✅ payment_method_used column already exists');
      return false;
    }
  } catch (migrationError) {
    console.log('⚠️ Migration note:', migrationError.message);
    return false;
  }
}

// Get all payments with booking and customer details
router.get('/', async (req, res) => {
  try {
    const payments = await getAll(`
      SELECT 
        p.id,
        p.booking_id,
        p.amount,
        p.payment_method,
        p.transaction_id,
        p.status,
        p.receipt_sent,
        p.created_at,
        p.payment_received_at,
        p.payment_notes,
        b.customer_name,
        b.customer_phone,
        b.customer_email,
        b.service_type,
        b.preferred_datetime,
        b.address,
        br.name as barber_name,
        br.phone as barber_phone
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      LEFT JOIN barbers br ON b.barber_id = br.id
      ORDER BY p.created_at DESC
    `);

    res.json({
      success: true,
      payments: payments
    });
  } catch (error) {
    console.error('❌ Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
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
        p.id,
        p.booking_id,
        p.amount,
        p.payment_method,
        p.transaction_id,
        p.status,
        p.receipt_sent,
        p.created_at,
        p.payment_received_at,
        p.payment_notes,
        b.customer_name,
        b.customer_phone,
        b.customer_email,
        b.service_type,
        b.preferred_datetime,
        b.address,
        br.name as barber_name,
        br.phone as barber_phone
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      LEFT JOIN barbers br ON b.barber_id = br.id
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
      payment: payment
    });
  } catch (error) {
    console.error('❌ Error fetching payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment',
      error: error.message
    });
  }
});

// Mark payment as received (when barber gets paid by customer)
router.put('/:id/mark-received', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_notes, payment_method_used } = req.body;

    // Ensure payment_method_used column exists (Render-safe migration)
    await ensurePaymentMethodUsedColumn();

    // Get current payment details
    const currentPayment = await getRow(`
      SELECT p.*, b.customer_name, b.service_type, br.name as barber_name
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      LEFT JOIN barbers br ON b.barber_id = br.id
      WHERE p.id = ?
    `, [id]);

    if (!currentPayment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (currentPayment.status === 'received') {
      return res.status(400).json({
        success: false,
        message: 'Payment already marked as received'
      });
    }

    // Update payment status - handle missing columns gracefully
    const result = await runQuery(`
      UPDATE payments 
      SET 
        status = 'received',
        payment_received_at = CURRENT_TIMESTAMP,
        payment_notes = ?,
        payment_method_used = ?
      WHERE id = ?
    `, [payment_notes || null, payment_method_used || currentPayment.payment_method, id]);

    if (result.changes === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update payment status'
      });
    }

    // Get updated payment
    const updatedPayment = await getRow(`
      SELECT 
        p.id,
        p.booking_id,
        p.amount,
        p.payment_method,
        p.transaction_id,
        p.status,
        p.receipt_sent,
        p.created_at,
        p.payment_received_at,
        p.payment_notes,
        p.payment_method_used,
        b.customer_name,
        b.customer_phone,
        b.service_type,
        b.preferred_datetime,
        br.name as barber_name
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      LEFT JOIN barbers br ON b.barber_id = br.id
      WHERE p.id = ?
    `, [id]);

    console.log(`💰 Payment marked as received: Booking #${currentPayment.booking_id} - ${currentPayment.customer_name} paid ${currentPayment.barber_name} KES ${currentPayment.amount}`);

    res.json({
      success: true,
      message: 'Payment marked as received successfully',
      payment: updatedPayment
    });

  } catch (error) {
    console.error('❌ Error marking payment as received:', error);
    console.error('🔍 Payment ID:', id);
    console.error('🔍 Request body:', req.body);
    console.error('🔍 Current payment:', currentPayment);
    
    res.status(500).json({
      success: false,
      message: 'Failed to mark payment as received',
      error: error.message
    });
  }
});

// Mark payment as pending (revert received status)
router.put('/:id/mark-pending', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Ensure payment_method_used column exists (Render-safe migration)
    await ensurePaymentMethodUsedColumn();

    // Get current payment details
    const currentPayment = await getRow(`
      SELECT p.*, b.customer_name, b.service_type, br.name as barber_name
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      LEFT JOIN barbers br ON b.barber_id = br.id
      WHERE p.id = ?
    `, [id]);

    if (!currentPayment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (currentPayment.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment already marked as pending'
      });
    }

    // Update payment status
    const result = await runQuery(`
      UPDATE payments 
      SET 
        status = 'pending',
        payment_received_at = NULL,
        payment_notes = CASE 
          WHEN ? IS NOT NULL THEN ?
          ELSE payment_notes
        END
      WHERE id = ?
    `, [reason, reason, id]);

    if (result.changes === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update payment status'
      });
    }

    console.log(`⏳ Payment reverted to pending: Booking #${currentPayment.booking_id} - ${currentPayment.customer_name} payment to ${currentPayment.barber_name} marked as pending`);

    res.json({
      success: true,
      message: 'Payment marked as pending successfully',
      payment_id: id
    });

  } catch (error) {
    console.error('❌ Error marking payment as pending:', error);
    console.error('🔍 Payment ID:', id);
    console.error('🔍 Request body:', req.body);
    console.error('🔍 Current payment:', currentPayment);
    
    res.status(500).json({
      success: false,
      message: 'Failed to mark payment as pending',
      error: error.message
    });
  }
});

// Get payment statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await getRow(`
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'received' THEN 1 END) as received_payments,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
        SUM(CASE WHEN status = 'received' THEN amount ELSE 0 END) as total_received,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
        AVG(amount) as average_payment
      FROM payments
    `);

    // Get payments by method
    const methodStats = await getAll(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'received' THEN amount ELSE 0 END) as total_received,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending
      FROM payments
      GROUP BY payment_method
    `);

    // Get recent payments
    const recentPayments = await getAll(`
      SELECT 
        p.id,
        p.amount,
        p.status,
        p.payment_received_at,
        b.customer_name,
        b.service_type,
        br.name as barber_name
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      LEFT JOIN barbers br ON b.barber_id = br.id
      ORDER BY p.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      stats: {
        ...stats,
        method_breakdown: methodStats,
        recent_payments: recentPayments
      }
    });

  } catch (error) {
    console.error('❌ Error fetching payment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statistics',
      error: error.message
    });
  }
});

module.exports = router;
