const express = require('express');
const { runQuery, getRow, getAll } = require('../config/database');
const router = express.Router();

// Get comprehensive dashboard overview
router.get('/dashboard', async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    // Get date range based on period
    const { startDate, endDate } = getDateRange(period);
    
    // Get all analytics data
    const [
      bookingStats,
      revenueStats,
      barberPerformance,
      serviceBreakdown,
      dailyTrends,
      topServices,
      customerMetrics
    ] = await Promise.all([
      getBookingStats(startDate, endDate),
      getRevenueStats(startDate, endDate),
      getBarberPerformance(startDate, endDate),
      getServiceBreakdown(startDate, endDate),
      getDailyTrends(startDate, endDate),
      getTopServices(startDate, endDate),
      getCustomerMetrics(startDate, endDate)
    ]);

    res.json({
      success: true,
      data: {
        period,
        dateRange: { startDate, endDate },
        bookingStats,
        revenueStats,
        barberPerformance,
        serviceBreakdown,
        dailyTrends,
        topServices,
        customerMetrics
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

// Get daily service analysis
router.get('/daily-analysis', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE DATE(b.created_at) BETWEEN $1 AND $2';
      params.push(start_date, end_date);
    } else {
      // Default to last 30 days
      dateFilter = 'WHERE DATE(b.created_at) >= CURRENT_DATE - INTERVAL \'30 days\'';
    }

    const dailyAnalysis = await getAll(`
      SELECT 
        DATE(b.created_at) as date,
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN b.status = 'pending' THEN 1 END) as pending_bookings,
        COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
        SUM(CASE WHEN b.status = 'completed' THEN b.service_price ELSE 0 END) as daily_revenue,
        AVG(CASE WHEN b.status = 'completed' THEN b.service_price ELSE NULL END) as average_service_price,
        COUNT(DISTINCT b.customer_phone) as unique_customers,
        COUNT(DISTINCT b.barber_id) as active_barbers
      FROM bookings b
      ${dateFilter}
      GROUP BY DATE(b.created_at)
      ORDER BY date DESC
    `, params);

    // Get service type breakdown for each day
    const serviceBreakdown = await getAll(`
      SELECT 
        DATE(b.created_at) as date,
        b.service_type,
        COUNT(*) as count,
        SUM(b.service_price) as revenue
      FROM bookings b
      ${dateFilter}
      GROUP BY DATE(b.created_at), b.service_type
      ORDER BY date DESC, revenue DESC
    `, params);

    res.json({
      success: true,
      data: {
        dailyAnalysis,
        serviceBreakdown
      }
    });

  } catch (error) {
    console.error('Error fetching daily analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily analysis',
      error: error.message
    });
  }
});

// Get weekly service analysis
router.get('/weekly-analysis', async (req, res) => {
  try {
    const { weeks = 4 } = req.query;
    
    const weeklyAnalysis = await getAll(`
      SELECT 
        TO_CHAR(b.created_at, 'IYYY-IW') as week,
        MIN(DATE(b.created_at)) as week_start,
        MAX(DATE(b.created_at)) as week_end,
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN b.status = 'pending' THEN 1 END) as pending_bookings,
        SUM(CASE WHEN b.status = 'completed' THEN b.service_price ELSE 0 END) as weekly_revenue,
        AVG(CASE WHEN b.status = 'completed' THEN b.service_price ELSE NULL END) as average_service_price,
        COUNT(DISTINCT b.customer_phone) as unique_customers,
        COUNT(DISTINCT b.barber_id) as active_barbers
      FROM bookings b
      WHERE DATE(b.created_at) >= CURRENT_DATE - INTERVAL '${weeks * 7} days'
      GROUP BY TO_CHAR(b.created_at, 'IYYY-IW')
      ORDER BY week DESC
    `);

    // Get weekly service breakdown
    const weeklyServiceBreakdown = await getAll(`
      SELECT 
        TO_CHAR(b.created_at, 'IYYY-IW') as week,
        b.service_type,
        COUNT(*) as count,
        SUM(b.service_price) as revenue
      FROM bookings b
      WHERE DATE(b.created_at) >= CURRENT_DATE - INTERVAL '${weeks * 7} days'
      GROUP BY TO_CHAR(b.created_at, 'IYYY-IW'), b.service_type
      ORDER BY week DESC, revenue DESC
    `);

    res.json({
      success: true,
      data: {
        weeklyAnalysis,
        weeklyServiceBreakdown
      }
    });

  } catch (error) {
    console.error('Error fetching weekly analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly analysis',
      error: error.message
    });
  }
});

// Get barber performance analytics
router.get('/barber-performance', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const barberPerformance = await getAll(`
      SELECT 
        b.id,
        b.name,
        b.identity_badge_number,
        b.total_services,
        b.total_earnings,
        COUNT(bk.id) as period_bookings,
        COUNT(CASE WHEN bk.status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN bk.status = 'pending' THEN 1 END) as pending_bookings,
        SUM(CASE WHEN bk.status = 'completed' THEN bk.service_price ELSE 0 END) as period_revenue,
        AVG(CASE WHEN bk.status = 'completed' THEN bk.service_price ELSE NULL END) as average_service_price,
        COUNT(DISTINCT DATE(bk.created_at)) as active_days,
        MAX(bk.created_at) as last_booking
      FROM barbers b
      LEFT JOIN bookings bk ON b.id = bk.barber_id 
                 AND DATE(bk.created_at) BETWEEN $1 AND $2
       WHERE b.is_active = true
      GROUP BY b.id
      ORDER BY period_revenue DESC, period_bookings DESC
    `, [startDate, endDate]);

    // Get barber daily performance
    const barberDailyPerformance = await getAll(`
      SELECT 
        b.id,
        b.name,
        DATE(bk.created_at) as date,
        COUNT(*) as bookings,
        SUM(CASE WHEN bk.status = 'completed' THEN bk.service_price ELSE 0 END) as revenue
      FROM barbers b
      JOIN bookings bk ON b.id = bk.barber_id
             WHERE DATE(bk.created_at) BETWEEN $1 AND $2
         AND b.is_active = true
      GROUP BY b.id, DATE(bk.created_at)
      ORDER BY b.name, date DESC
    `, [startDate, endDate]);

    res.json({
      success: true,
      data: {
        barberPerformance,
        barberDailyPerformance
      }
    });

  } catch (error) {
    console.error('Error fetching barber performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch barber performance',
      error: error.message
    });
  }
});

// Get revenue analytics
router.get('/revenue', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const revenueStats = await getRow(`
      SELECT 
        SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as total_revenue,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as successful_payments,
        COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_payments,
        AVG(CASE WHEN p.status = 'completed' THEN p.amount ELSE NULL END) as average_payment,
        SUM(CASE WHEN p.payment_method = 'mpesa' THEN p.amount ELSE 0 END) as mpesa_revenue,
        SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END) as cash_revenue,
        SUM(CASE WHEN p.payment_method = 'card' THEN p.amount ELSE 0 END) as card_revenue
      FROM payments p
             WHERE DATE(p.created_at) BETWEEN $1 AND $2
     `, [startDate, endDate]);

    // Get daily revenue trends
    const dailyRevenue = await getAll(`
      SELECT 
        DATE(p.created_at) as date,
        SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as revenue,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as payments,
        COUNT(CASE WHEN p.payment_method = 'mpesa' THEN 1 END) as mpesa_count,
        COUNT(CASE WHEN p.payment_method = 'cash' THEN 1 END) as cash_count,
        COUNT(CASE WHEN p.payment_method = 'card' THEN 1 END) as card_count
      FROM payments p
             WHERE DATE(p.created_at) BETWEEN $1 AND $2
       GROUP BY DATE(p.created_at)
      ORDER BY date DESC
    `, [startDate, endDate]);

    // Get payment method breakdown
    const paymentMethodBreakdown = await getAll(`
      SELECT 
        p.payment_method,
        COUNT(*) as total_payments,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as successful_payments,
        SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN p.status = 'completed' THEN p.amount ELSE NULL END) as average_amount
      FROM payments p
             WHERE DATE(p.created_at) BETWEEN $1 AND $2
       GROUP BY p.payment_method
      ORDER BY total_revenue DESC
    `, [startDate, endDate]);

    res.json({
      success: true,
      data: {
        revenueStats,
        dailyRevenue,
        paymentMethodBreakdown
      }
    });

  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics',
      error: error.message
    });
  }
});

// Get customer analytics
router.get('/customers', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const customerStats = await getRow(`
      SELECT 
        COUNT(DISTINCT b.customer_phone) as unique_customers,
        COUNT(DISTINCT b.customer_email) as customers_with_email,
        COUNT(*) as total_bookings,
        AVG(b.service_price) as average_booking_value,
        COUNT(DISTINCT DATE(b.created_at)) as active_days
      FROM bookings b
             WHERE DATE(b.created_at) BETWEEN $1 AND $2
     `, [startDate, endDate]);

    // Get customer retention (repeat customers)
    const repeatCustomers = await getAll(`
      SELECT 
        b.customer_phone,
        b.customer_name,
        COUNT(*) as booking_count,
        SUM(b.service_price) as total_spent,
        MIN(b.created_at) as first_booking,
        MAX(b.created_at) as last_booking,
        STRING_AGG(DISTINCT b.service_type, ', ') as services_used
      FROM bookings b
      WHERE DATE(b.created_at) BETWEEN $1 AND $2
      GROUP BY b.customer_phone
      HAVING booking_count > 1
      ORDER BY booking_count DESC, total_spent DESC
      LIMIT 20
    `, [startDate, endDate]);

    // Get new vs returning customers
    const customerSegmentation = await getAll(`
      SELECT 
        CASE 
          WHEN COUNT(*) = 1 THEN 'New Customer'
          WHEN COUNT(*) BETWEEN 2 AND 5 THEN 'Returning Customer'
          ELSE 'Loyal Customer'
        END as customer_type,
        COUNT(DISTINCT b.customer_phone) as customer_count,
        COUNT(*) as total_bookings,
        SUM(b.service_price) as total_revenue
      FROM bookings b
      WHERE DATE(b.created_at) BETWEEN $1 AND $2
      GROUP BY b.customer_phone
      GROUP BY customer_type
      ORDER BY total_revenue DESC
    `, [startDate, endDate]);

    res.json({
      success: true,
      data: {
        customerStats,
        repeatCustomers,
        customerSegmentation
      }
    });

  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer analytics',
      error: error.message
    });
  }
});

// Get service analytics
router.get('/services', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const serviceStats = await getAll(`
      SELECT 
        b.service_type,
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN b.status = 'pending' THEN 1 END) as pending_bookings,
        SUM(CASE WHEN b.status = 'completed' THEN b.service_price ELSE 0 END) as total_revenue,
        AVG(b.service_price) as average_price,
        COUNT(DISTINCT b.customer_phone) as unique_customers,
        COUNT(DISTINCT b.barber_id) as barbers_assigned
      FROM bookings b
      WHERE DATE(b.created_at) BETWEEN $1 AND $2
      GROUP BY b.service_type
      ORDER BY total_revenue DESC
    `, [startDate, endDate]);

    // Get service popularity over time
    const serviceTrends = await getAll(`
      SELECT 
        DATE(b.created_at) as date,
        b.service_type,
        COUNT(*) as bookings,
        SUM(b.service_price) as revenue
      FROM bookings b
      WHERE DATE(b.created_at) BETWEEN $1 AND $2
      GROUP BY DATE(b.created_at), b.service_type
      ORDER BY date DESC, revenue DESC
    `, [startDate, endDate]);

    res.json({
      success: true,
      data: {
        serviceStats,
        serviceTrends
      }
    });

  } catch (error) {
    console.error('Error fetching service analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service analytics',
      error: error.message
    });
  }
});

// Helper function to get date range based on period
function getDateRange(period) {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'today':
      startDate = endDate = now.toISOString().split('T')[0];
      break;
    case 'week':
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      startDate = weekStart.toISOString().split('T')[0];
      endDate = new Date().toISOString().split('T')[0];
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      endDate = new Date().toISOString().split('T')[0];
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
      endDate = new Date().toISOString().split('T')[0];
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      endDate = new Date().toISOString().split('T')[0];
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = new Date().toISOString().split('T')[0];
  }

  return { startDate, endDate };
}

// Helper function to get booking statistics
async function getBookingStats(startDate, endDate) {
  return await getRow(`
    SELECT 
      COUNT(*) as total_bookings,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
      COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_bookings,
      COUNT(DISTINCT customer_phone) as unique_customers,
      COUNT(DISTINCT barber_id) as active_barbers
    FROM bookings 
    WHERE DATE(created_at) BETWEEN $1 AND $2
  `, [startDate, endDate]);
}

// Helper function to get revenue statistics
async function getRevenueStats(startDate, endDate) {
  return await getRow(`
    SELECT 
      SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as total_revenue,
      COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as successful_payments,
      COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_payments,
      AVG(CASE WHEN p.status = 'completed' THEN p.amount ELSE NULL END) as average_payment
    FROM payments p
    WHERE DATE(p.created_at) BETWEEN $1 AND $2
  `, [startDate, endDate]);
}

// Helper function to get barber performance
async function getBarberPerformance(startDate, endDate) {
  return await getAll(`
    SELECT 
      b.id,
      b.name,
      b.identity_badge_number,
      COUNT(bk.id) as period_bookings,
      SUM(CASE WHEN bk.status = 'completed' THEN bk.service_price ELSE 0 END) as period_revenue,
      AVG(CASE WHEN bk.status = 'completed' THEN bk.service_price ELSE NULL END) as average_service_price
    FROM barbers b
    LEFT JOIN bookings bk ON b.id = bk.barber_id 
      AND DATE(bk.created_at) BETWEEN $1 AND $2
    WHERE b.is_active = true
    GROUP BY b.id
    ORDER BY period_revenue DESC
    LIMIT 10
  `, [startDate, endDate]);
}

// Helper function to get service breakdown
async function getServiceBreakdown(startDate, endDate) {
  return await getAll(`
    SELECT 
      service_type,
      COUNT(*) as bookings,
      SUM(CASE WHEN status = 'completed' THEN service_price ELSE 0 END) as revenue
    FROM bookings 
    WHERE DATE(created_at) BETWEEN $1 AND $2
    GROUP BY service_type
    ORDER BY revenue DESC
  `, [startDate, endDate]);
}

// Helper function to get daily trends
async function getDailyTrends(startDate, endDate) {
  return await getAll(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as bookings,
      SUM(CASE WHEN status = 'completed' THEN service_price ELSE 0 END) as revenue
    FROM bookings 
    WHERE DATE(created_at) BETWEEN $1 AND $2
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `, [startDate, endDate]);
}

// Helper function to get top services
async function getTopServices(startDate, endDate) {
  return await getAll(`
    SELECT 
      service_type,
      COUNT(*) as bookings,
      SUM(CASE WHEN status = 'completed' THEN service_price ELSE 0 END) as revenue
    FROM bookings 
    WHERE DATE(created_at) BETWEEN $1 AND $2
    GROUP BY service_type
    ORDER BY revenue DESC
    LIMIT 5
  `, [startDate, endDate]);
}

// Helper function to get customer metrics
async function getCustomerMetrics(startDate, endDate) {
  return await getRow(`
    SELECT 
      COUNT(DISTINCT customer_phone) as unique_customers,
      COUNT(DISTINCT customer_email) as customers_with_email,
      COUNT(*) as total_bookings,
      AVG(service_price) as average_booking_value
    FROM bookings 
    WHERE DATE(created_at) BETWEEN $1 AND $2
  `, [startDate, endDate]);
}

module.exports = router;
