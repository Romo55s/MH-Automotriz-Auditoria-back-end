module.exports = {
  // Rate limiting settings
  rateLimiting: {
    minRequestInterval: 100, // Minimum 100ms between requests
    maxRequestsPerMinute: 50, // Conservative limit (Google allows 100)
  },
  
  // Caching settings
  caching: {
    enabled: true,
    duration: 30000, // 30 seconds cache
    maxCacheSize: 100, // Maximum number of cached sheets
  },
  
  // Retry settings
  retry: {
    maxRetries: 3,
    baseDelay: 1000, // 1 second base delay
    maxDelay: 10000, // Maximum 10 seconds delay
  },
  
  // Quota management
  quota: {
    // Google Sheets API limits
    readRequestsPerMinute: 100,
    writeRequestsPerMinute: 100,
    
    // Google Drive API limits
    driveReadRequestsPerMinute: 1000,
    driveWriteRequestsPerMinute: 1000,
    
    // Safety margins (use 80% of actual limits)
    safetyMargin: 0.8,
    
    // Request tracking
    trackRequests: true,
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
