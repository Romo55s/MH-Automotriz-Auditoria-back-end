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
    
    // Safety margins (use 80% of actual limits)
    safetyMargin: 0.8,
    
    // Request tracking
    trackRequests: true,
  }
};
