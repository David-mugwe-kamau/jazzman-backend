const { checkExpiringBlocks } = require('./block-notifications');

// Simple scheduler using setInterval
class BlockExpiryScheduler {
  constructor() {
    this.interval = null;
    this.isRunning = false;
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log('🔄 Scheduler is already running');
      return;
    }

    console.log('🚀 Starting block expiry scheduler...');
    
    // Check every 30 minutes (1800000 ms)
    this.interval = setInterval(async () => {
      try {
        console.log('⏰ Running scheduled block expiry check...');
        await checkExpiringBlocks();
      } catch (error) {
        console.error('❌ Error in scheduled block expiry check:', error);
      }
    }, 1800000); // 30 minutes

    this.isRunning = true;
    console.log('✅ Block expiry scheduler started successfully');
    
    // Run initial check immediately
    this.runInitialCheck();
  }

  // Stop the scheduler
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      console.log('🛑 Block expiry scheduler stopped');
    }
  }

  // Run initial check when server starts
  async runInitialCheck() {
    try {
      console.log('🔍 Running initial block expiry check...');
      await checkExpiringBlocks();
    } catch (error) {
      console.error('❌ Error in initial block expiry check:', error);
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextCheck: this.isRunning ? 'Every 30 minutes' : 'Stopped',
      lastCheck: new Date().toISOString()
    };
  }
}

// Create singleton instance
const blockExpiryScheduler = new BlockExpiryScheduler();

module.exports = {
  blockExpiryScheduler,
  BlockExpiryScheduler
};
