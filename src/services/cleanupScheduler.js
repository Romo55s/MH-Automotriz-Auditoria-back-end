const cron = require('node-cron');
const fileStorageService = require('./fileStorageService');
const { GoogleSheetsError } = require('../middleware/errorHandler');
const config = require('../config/googleSheets');

class CleanupScheduler {
  constructor() {
    this.isRunning = false;
    this.schedule = config.drive.cleanup.schedule;
    this.task = null;
  }

  // Start the cleanup scheduler
  start() {
    if (this.isRunning) {
      console.log('⚠️ Cleanup scheduler is already running');
      return;
    }

    if (!config.drive.cleanup.enabled) {
      console.log('📅 Cleanup scheduler is disabled in configuration');
      return;
    }

    try {
      this.task = cron.schedule(this.schedule, async () => {
        console.log(`\n🕐 === SCHEDULED CLEANUP STARTED ===`);
        console.log(`📅 Running at: ${new Date().toISOString()}`);
        
        try {
          await this.runCleanup();
        } catch (error) {
          console.error('❌ Scheduled cleanup failed:', error);
        }
        
        console.log(`🏁 === SCHEDULED CLEANUP COMPLETED ===\n`);
      }, {
        scheduled: false,
        timezone: 'UTC'
      });

      this.task.start();
      this.isRunning = true;
      
      console.log(`✅ Cleanup scheduler started`);
      console.log(`📅 Schedule: ${this.schedule} (UTC)`);
      console.log(`⏰ Next run: ${this.getNextRunTime()}`);
    } catch (error) {
      console.error('❌ Failed to start cleanup scheduler:', error);
      throw new GoogleSheetsError(`Failed to start cleanup scheduler: ${error.message}`);
    }
  }

  // Stop the cleanup scheduler
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Cleanup scheduler is not running');
      return;
    }

    try {
      if (this.task) {
        this.task.stop();
        this.task.destroy();
        this.task = null;
      }
      
      this.isRunning = false;
      console.log('✅ Cleanup scheduler stopped');
    } catch (error) {
      console.error('❌ Failed to stop cleanup scheduler:', error);
    }
  }

  // Run cleanup manually
  async runCleanup() {
    try {
      console.log(`🧹 Starting file cleanup process...`);
      
      const result = await fileStorageService.cleanupExpiredFiles();
      
      console.log(`📊 Cleanup results:`);
      console.log(`   Total files processed: ${result.totalFiles}`);
      console.log(`   Successfully cleaned: ${result.successful}`);
      console.log(`   Failed to clean: ${result.failed}`);
      
      if (result.failed > 0) {
        console.log(`⚠️ Some files failed to clean up:`);
        result.results
          .filter(r => !r.success)
          .forEach(r => console.log(`   - ${r.filename}: ${r.error}`));
      }
      
      return result;
    } catch (error) {
      console.error('❌ Cleanup process failed:', error);
      throw new GoogleSheetsError(`Cleanup process failed: ${error.message}`);
    }
  }

  // Get next scheduled run time
  getNextRunTime() {
    if (!this.task) {
      return 'Not scheduled';
    }
    
    try {
      // This is a simplified approach - in a real implementation,
      // you might want to use a more sophisticated method to get next run time
      const now = new Date();
      const nextRun = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // Next day as fallback
      return nextRun.toISOString();
    } catch (error) {
      return 'Unknown';
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      schedule: this.schedule,
      nextRun: this.getNextRunTime(),
      enabled: config.drive.cleanup.enabled
    };
  }

  // Force run cleanup (for testing or manual execution)
  async forceCleanup() {
    console.log(`\n🔧 === FORCE CLEANUP STARTED ===`);
    console.log(`📅 Running at: ${new Date().toISOString()}`);
    
    try {
      const result = await this.runCleanup();
      console.log(`🏁 === FORCE CLEANUP COMPLETED ===\n`);
      return result;
    } catch (error) {
      console.error('❌ Force cleanup failed:', error);
      throw error;
    }
  }
}

module.exports = new CleanupScheduler();
