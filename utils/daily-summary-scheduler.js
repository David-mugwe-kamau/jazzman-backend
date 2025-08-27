const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { sendEmail } = require('./email');

class DailySummaryScheduler {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.dbPath = path.join(__dirname, '..', 'data', 'jazzman.db');
    
    // Debug: Log the database path
    console.log('🔍 Daily Summary Scheduler DB Path:', this.dbPath);
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log('🔄 Daily summary scheduler is already running');
      return;
    }

    console.log('🚀 Starting daily summary scheduler...');
    
    // Check every 24 hours (86400000 ms) at 6:00 AM
    this.interval = setInterval(async () => {
      try {
        const now = new Date();
        const hour = now.getHours();
        
        // Only send summaries at 6:00 AM
        if (hour === 6) {
          console.log('⏰ Running scheduled daily summary check...');
          await this.sendDailySummaries();
        }
      } catch (error) {
        console.error('❌ Error in scheduled daily summary check:', error);
      }
    }, 3600000); // Check every hour

    this.isRunning = true;
    console.log('✅ Daily summary scheduler started successfully');
    
    // Run initial check if it's 6:00 AM
    this.runInitialCheck();
  }

  // Stop the scheduler
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      console.log('🛑 Daily summary scheduler stopped');
    }
  }

  // Run initial check when server starts
  async runInitialCheck() {
    try {
      const now = new Date();
      const hour = now.getHours();
      
      if (hour === 6) {
        console.log('🔍 Running initial daily summary check...');
        await this.sendDailySummaries();
      } else {
        console.log(`⏰ Daily summary scheduler initialized. Next check at 6:00 AM (current time: ${hour}:${now.getMinutes()})`);
      }
    } catch (error) {
      console.error('❌ Error in initial daily summary check:', error);
    }
  }

  // Send daily summaries to all barbers
  async sendDailySummaries() {
    try {
      console.log('📊 Generating daily summaries for all barbers...');
      
      const db = new sqlite3.Database(this.dbPath);
      
      // Get all active barbers
      const barbers = await this.getActiveBarbers(db);
      
      for (const barber of barbers) {
        if (barber.email) {
          await this.generateAndSendBarberSummary(db, barber);
        } else {
          console.log(`⚠️ Barber ${barber.name} has no email address. Skipping daily summary.`);
        }
      }
      
      db.close();
      console.log('✅ Daily summaries sent successfully');
      
    } catch (error) {
      console.error('❌ Error sending daily summaries:', error);
    }
  }

  // Get all active barbers
  async getActiveBarbers(db) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, name, email, phone, is_blocked 
        FROM barbers 
        WHERE is_blocked = 0 AND is_active = 1
        ORDER BY name
      `;
      
      db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Generate and send summary for a specific barber
  async generateAndSendBarberSummary(db, barber) {
    try {
      console.log(`📊 Generating daily summary for ${barber.name}...`);
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // Get yesterday's data
      const summary = await this.getBarberDailySummary(db, barber.id, yesterdayStr);
      
      if (summary.totalBookings > 0) {
        await this.sendBarberSummaryEmail(barber, summary, yesterdayStr);
        console.log(`✅ Daily summary sent to ${barber.name}`);
      } else {
        console.log(`ℹ️ No bookings for ${barber.name} yesterday. Skipping summary.`);
      }
      
    } catch (error) {
      console.error(`❌ Error generating summary for ${barber.name}:`, error);
    }
  }

  // Get barber's daily summary data
  async getBarberDailySummary(db, barberId, date) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as totalBookings,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedBookings,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledBookings,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingBookings,
  
          SUM(service_price) as totalEarnings,
          GROUP_CONCAT(DISTINCT service_type) as servicesOffered
        FROM bookings 
        WHERE barber_id = ? 
        AND DATE(preferred_datetime) = ?
      `;
      
      db.get(query, [barberId, date], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            totalBookings: row.totalBookings || 0,
            completedBookings: row.completedBookings || 0,
            cancelledBookings: row.cancelledBookings || 0,
            pendingBookings: row.pendingBookings || 0,

            totalEarnings: row.totalEarnings || 0,
            servicesOffered: row.servicesOffered ? row.servicesOffered.split(',') : []
          });
        }
      });
    });
  }

  // Send summary email to barber
  async sendBarberSummaryEmail(barber, summary, date) {
    try {
      const subject = `📊 Daily Summary - ${date} - JazzMan Housecalls`;
      
      const htmlContent = this.generateSummaryEmailHTML(barber, summary, date);
      const textContent = this.generateSummaryEmailText(barber, summary, date);
      
      await sendEmail({
        to: barber.email,
        subject: subject,
        html: htmlContent,
        text: textContent
      });
      
    } catch (error) {
      console.error(`❌ Error sending email to ${barber.name}:`, error);
    }
  }

  // Generate HTML email content
  generateSummaryEmailHTML(barber, summary, date) {
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily Summary - ${formattedDate}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1976d2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
          .stat-card { background: white; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .stat-number { font-size: 24px; font-weight: bold; color: #1976d2; }
          .stat-label { color: #666; font-size: 14px; }
          .services { background: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Daily Summary Report</h1>
            <p>${formattedDate}</p>
          </div>
          
          <div class="content">
            <h2>Hello ${barber.name}! 👋</h2>
            <p>Here's your performance summary for yesterday:</p>
            
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-number">${summary.totalBookings}</div>
                <div class="stat-label">Total Bookings</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">KSh ${summary.totalEarnings.toFixed(2)}</div>
                <div class="stat-label">Total Earnings</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${summary.completedBookings}</div>
                <div class="stat-label">Completed</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${summary.pendingBookings}</div>
                <div class="stat-label">Pending</div>
              </div>
            </div>
            
            <div class="services">
              <h3>Services Offered Yesterday:</h3>
              <ul>
                ${summary.servicesOffered.map(service => `<li>${service}</li>`).join('')}
              </ul>
            </div>
            
            <div class="footer">
              <p>Keep up the great work! 💪</p>
              <p>JazzMan Housecalls Team</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate text email content
  generateSummaryEmailText(barber, summary, date) {
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
Daily Summary Report - ${formattedDate}

Hello ${barber.name}!

Here's your performance summary for yesterday:

📊 STATISTICS:
- Total Bookings: ${summary.totalBookings}
- Completed: ${summary.completedBookings}
- Pending: ${summary.pendingBookings}
- Cancelled: ${summary.cancelledBookings}
- Total Earnings: KSh ${summary.totalEarnings.toFixed(2)}

🛠️ SERVICES OFFERED:
${summary.servicesOffered.map(service => `- ${service}`).join('\n')}

Keep up the great work!

Best regards,
JazzMan Housecalls Team
    `;
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextCheck: this.isRunning ? 'Every hour (6:00 AM trigger)' : 'Stopped',
      lastCheck: new Date().toISOString()
    };
  }
}

// Create singleton instance
const dailySummaryScheduler = new DailySummaryScheduler();

module.exports = {
  dailySummaryScheduler,
  DailySummaryScheduler
};
