const { sendDailySalesSummary } = require('./email');
const { getRow, getAll } = require('../config/database');

class DailySummaryScheduler {
  constructor() {
    this.isRunning = false;
  }

  // Send daily sales summaries to all active barbers
  async sendDailySummaries() {
    if (this.isRunning) {
      console.log('⚠️ Daily summary already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('📊 Starting daily sales summary process...');

    try {
      // Get all active barbers
      const barbers = await getAll(`
        SELECT id, name, email, phone, total_services, total_earnings
        FROM barbers 
        WHERE is_active = 1 AND is_blocked = 0 AND email IS NOT NULL
      `);

      console.log(`📊 Found ${barbers.length} active barbers to notify`);

      let successCount = 0;
      let errorCount = 0;

      for (const barber of barbers) {
        try {
          console.log(`📊 Processing daily summary for ${barber.name}...`);
          
          // Get today's completed services for this barber
          const today = new Date().toISOString().split('T')[0];
          const dailyServices = await getAll(`
            SELECT 
              b.id,
              b.customer_name,
              b.service_type,
              b.service_price,
              b.preferred_datetime,
              b.status,
              b.payment_status
            FROM bookings b
            WHERE 
              b.barber_id = ? 
              AND DATE(b.preferred_datetime) = ?
              AND b.status = 'completed'
              AND b.payment_status = 'completed'
          `, [barber.id, today]);

          if (dailyServices.length === 0) {
            console.log(`📊 No completed services today for ${barber.name}, skipping...`);
            continue;
          }

          // Calculate daily statistics
          const totalServices = dailyServices.length;
          const totalEarnings = dailyServices.reduce((sum, service) => sum + service.service_price, 0);
          const averagePerService = totalEarnings / totalServices;

          // Find best performing service
          const serviceCounts = {};
          dailyServices.forEach(service => {
            serviceCounts[service.service_type] = (serviceCounts[service.service_type] || 0) + 1;
          });
          const bestService = Object.entries(serviceCounts)
            .sort(([,a], [,b]) => b - a)[0][0];

          // Find peak hours
          const hourCounts = {};
          dailyServices.forEach(service => {
            const hour = new Date(service.preferred_datetime).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          });
          const peakHour = Object.entries(hourCounts)
            .sort(([,a], [,b]) => b - a)[0][0];
          const peakHours = `${peakHour}:00`;

          // Calculate satisfaction rate (placeholder - could be enhanced with actual ratings)
          const satisfactionRate = 95; // Default high satisfaction

          const dailyStats = {
            date: today,
            totalServices,
            totalEarnings,
            averagePerService,
            services: dailyServices,
            bestService,
            peakHours,
            satisfactionRate
          };

          // Send daily summary email
          await sendDailySalesSummary(barber, dailyStats);
          console.log(`✅ Daily summary sent to ${barber.name}`);
          successCount++;

        } catch (error) {
          console.error(`❌ Error sending daily summary to ${barber.name}:`, error);
          errorCount++;
        }
      }

      console.log(`📊 Daily summary process completed: ${successCount} successful, ${errorCount} errors`);

    } catch (error) {
      console.error('❌ Error in daily summary process:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Schedule daily summaries to run at 8 PM every day
  scheduleDailySummaries() {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(20, 0, 0, 0); // 8:00 PM

    // If it's already past 8 PM today, schedule for tomorrow
    if (now > scheduledTime) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const timeUntilScheduled = scheduledTime.getTime() - now.getTime();
    
    console.log(`📅 Daily summary scheduled for: ${scheduledTime.toLocaleString()}`);
    console.log(`⏰ Time until next summary: ${Math.round(timeUntilScheduled / 1000 / 60)} minutes`);

    setTimeout(() => {
      this.sendDailySummaries();
      // Schedule next day
      this.scheduleDailySummaries();
    }, timeUntilScheduled);
  }

  // Start the scheduler
  start() {
    console.log('🚀 Starting daily summary scheduler...');
    this.scheduleDailySummaries();
  }

  // Stop the scheduler
  stop() {
    console.log('🛑 Stopping daily summary scheduler...');
    this.isRunning = false;
  }
}

// Create singleton instance
const dailySummaryScheduler = new DailySummaryScheduler();

module.exports = dailySummaryScheduler;
