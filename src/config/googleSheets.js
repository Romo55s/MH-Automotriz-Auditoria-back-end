module.exports = {
  // Rate limiting settings - OPTIMIZED FOR PRODUCTION
  rateLimiting: {
    minRequestInterval: 500, // Increased to 500ms between requests
    maxRequestsPerMinute: 30, // Very conservative limit to avoid quota issues
  },
  
  // Caching settings - OPTIMIZED FOR PRODUCTION
  caching: {
    enabled: true,
    duration: 120000, // Increased to 2 minutes cache
    maxCacheSize: 500, // Increased cache size for better performance
  },
  
  // Retry settings
  retry: {
    maxRetries: 3,
    baseDelay: 1000, // 1 second base delay
    maxDelay: 10000, // Maximum 10 seconds delay
  },
  
  // Quota management - OPTIMIZED FOR PRODUCTION
  quota: {
    // Google Sheets API limits (very conservative for production)
    readRequestsPerMinute: 50,
    writeRequestsPerMinute: 50,
    
    // Google Drive API limits
    driveReadRequestsPerMinute: 1000,
    driveWriteRequestsPerMinute: 1000,
    
    // Safety margins (use 60% of actual limits for production stability)
    safetyMargin: 0.6,
    
    // Request tracking
    trackRequests: true,
    
    // Quota recovery settings
    quotaRecoveryDelay: 90000, // 1.5 minutes wait for quota reset
    maxQuotaRetries: 3,
    
    // Emergency quota management
    emergencyMode: {
      enabled: true,
      triggerThreshold: 0.8, // Trigger at 80% quota usage
      minRequestInterval: 1000, // 1 second between requests in emergency mode
      maxRequestsPerMinute: 20, // Very low limit in emergency mode
    }
  },
  
  // Google Drive settings
  drive: {
    // Folder ID where inventory files will be stored
    inventoryFolderId: process.env.GOOGLE_DRIVE_INVENTORY_FOLDER_ID || 'root',
    
    // File retention period in days
    retentionDays: 30,
    
    // File naming pattern
    fileNamingPattern: '{agency}_{month}_{year}_{type}_{timestamp}',
    
    // Supported file types
    supportedTypes: ['csv', 'xlsx'],
    
    // Cleanup settings
    cleanup: {
      enabled: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      batchSize: 50, // Process files in batches
    }
  }
};
