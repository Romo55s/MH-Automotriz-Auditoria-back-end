#!/usr/bin/env node

/**
 * Quota Recovery Test
 * 
 * This script tests the system's ability to handle Google Sheets API quota limits
 * and recover gracefully when quota is exceeded.
 */

const axios = require('axios');

// Configuration
const CONFIG = {
  apiBaseUrl: 'http://localhost:5000',
  testAgency: 'Quota Test Agency',
  testMonth: 1,
  testYear: 2025,
  retryDelay: 60000, // 1 minute
  maxRetries: 3
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    progress: '🔄',
    quota: '⏱️'
  }[type] || '📋';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test quota recovery
async function testQuotaRecovery() {
  log('🚀 Starting Quota Recovery Test...', 'progress');
  
  let attempt = 1;
  const maxAttempts = 5;
  
  while (attempt <= maxAttempts) {
    log(`\n🔄 Attempt ${attempt}/${maxAttempts} - Testing API responsiveness`, 'progress');
    
    try {
      // Test basic health check
      const healthResponse = await axios.get(`${CONFIG.apiBaseUrl}/health`, {
        timeout: 10000
      });
      
      if (healthResponse.status === 200) {
        log('✅ Basic API is responsive', 'success');
        
        // Test Google Sheets connection
        try {
          const sheetsResponse = await axios.get(`${CONFIG.apiBaseUrl}/api/inventory/diagnose-google-sheets`, {
            timeout: 15000
          });
          
          if (sheetsResponse.status === 200 && sheetsResponse.data.success) {
            log('✅ Google Sheets API quota recovered!', 'success');
            log('🎉 System is ready for normal operations', 'success');
            return true;
          } else {
            log('⚠️ Google Sheets API still has issues', 'warning');
          }
          
        } catch (sheetsError) {
          if (sheetsError.response?.status === 429 || 
              sheetsError.message.includes('quota') || 
              sheetsError.message.includes('Quota exceeded')) {
            log(`⏱️ Google Sheets quota still exceeded (attempt ${attempt})`, 'quota');
          } else {
            log(`❌ Google Sheets error: ${sheetsError.message}`, 'error');
          }
        }
        
      } else {
        log(`❌ Health check failed with status ${healthResponse.status}`, 'error');
      }
      
    } catch (error) {
      if (error.response?.status === 429 || 
          error.message.includes('quota') || 
          error.message.includes('Quota exceeded')) {
        log(`⏱️ API quota exceeded (attempt ${attempt})`, 'quota');
      } else {
        log(`❌ API error: ${error.message}`, 'error');
      }
    }
    
    if (attempt < maxAttempts) {
      log(`⏳ Waiting 60 seconds before retry...`, 'quota');
      await sleep(CONFIG.retryDelay);
    }
    
    attempt++;
  }
  
  log('❌ Quota recovery test failed after all attempts', 'error');
  return false;
}

// Test quota management features
async function testQuotaManagement() {
  log('\n🔧 Testing Quota Management Features...', 'progress');
  
  try {
    // Test with minimal operations
    log('  📊 Testing minimal scan operation...', 'progress');
    
    const scanResponse = await axios.post(`${CONFIG.apiBaseUrl}/api/inventory/save-scan`, {
      agency: CONFIG.testAgency,
      month: CONFIG.testMonth.toString(),
      year: CONFIG.testYear.toString(),
      code: `QUOTA_TEST_${Date.now()}`,
      user: 'quota_test_user',
      userName: 'Quota Test User',
      carData: {
        marca: 'Quota Test Brand',
        color: 'Quota Test Color',
        ubicaciones: 'Quota Test Location'
      }
    }, {
      timeout: 30000 // Longer timeout for quota-limited operations
    });
    
    if (scanResponse.status === 200) {
      log('  ✅ Minimal scan operation succeeded', 'success');
      
      // Try to complete the inventory
      try {
        const completeResponse = await axios.post(`${CONFIG.apiBaseUrl}/api/inventory/finish-session`, {
          agency: CONFIG.testAgency,
          month: CONFIG.testMonth.toString(),
          year: CONFIG.testYear.toString(),
          user: 'quota_test_user'
        }, {
          timeout: 30000
        });
        
        if (completeResponse.status === 200) {
          log('  ✅ Inventory completion succeeded', 'success');
        } else {
          log(`  ⚠️ Inventory completion returned status ${completeResponse.status}`, 'warning');
        }
        
      } catch (completeError) {
        if (completeError.response?.status === 429 || 
            completeError.message.includes('quota')) {
          log('  ⏱️ Inventory completion hit quota limit (expected)', 'quota');
        } else {
          log(`  ❌ Inventory completion failed: ${completeError.message}`, 'error');
        }
      }
      
    } else {
      log(`  ❌ Scan operation failed with status ${scanResponse.status}`, 'error');
    }
    
  } catch (error) {
    if (error.response?.status === 429 || 
        error.message.includes('quota') || 
        error.message.includes('Quota exceeded')) {
      log('  ⏱️ Scan operation hit quota limit (expected)', 'quota');
    } else {
      log(`  ❌ Scan operation failed: ${error.message}`, 'error');
    }
  }
}

// Generate quota status report
async function generateQuotaReport() {
  log('\n📊 === QUOTA RECOVERY TEST REPORT ===', 'progress');
  
  try {
    // Get detailed health information
    const healthResponse = await axios.get(`${CONFIG.apiBaseUrl}/health/detailed`, {
      timeout: 10000
    });
    
    if (healthResponse.status === 200) {
      const health = healthResponse.data;
      
      console.log('\n🏥 SYSTEM HEALTH:');
      console.log(`   Status: ${health.status}`);
      console.log(`   Uptime: ${health.uptime}`);
      console.log(`   Memory Usage: ${health.memoryUsage?.heapUsed || 'Unknown'}`);
      
      if (health.googleSheets) {
        console.log('\n📊 GOOGLE SHEETS STATUS:');
        console.log(`   Connected: ${health.googleSheets.connected ? '✅' : '❌'}`);
        console.log(`   Last Check: ${health.googleSheets.lastCheck || 'Unknown'}`);
        console.log(`   Cache Status: ${health.googleSheets.cacheStatus || 'Unknown'}`);
      }
      
      if (health.websocket) {
        console.log('\n🔌 WEBSOCKET STATUS:');
        console.log(`   Active Connections: ${health.websocket.activeConnections || 0}`);
        console.log(`   Total Messages: ${health.websocket.totalMessages || 0}`);
      }
      
    } else {
      log('❌ Could not retrieve detailed health information', 'error');
    }
    
  } catch (error) {
    log(`❌ Health check failed: ${error.message}`, 'error');
  }
  
  console.log('\n💡 QUOTA MANAGEMENT RECOMMENDATIONS:');
  console.log('   1. Wait 1-2 minutes for quota reset');
  console.log('   2. Reduce test frequency to avoid quota limits');
  console.log('   3. Implement exponential backoff in production');
  console.log('   4. Consider upgrading Google Sheets API quota');
  console.log('   5. Use caching more aggressively to reduce API calls');
  
  console.log('\n⏰ QUOTA RESET TIMELINE:');
  console.log('   - Read requests: Reset every minute');
  console.log('   - Write requests: Reset every minute');
  console.log('   - Batch requests: Reset every minute');
  console.log('   - Daily quota: Reset every 24 hours');
}

// Main execution
async function runQuotaRecoveryTest() {
  log('🚀 Starting Quota Recovery and Management Test...', 'progress');
  
  const startTime = Date.now();
  
  try {
    // Test 1: Quota Recovery
    const recovered = await testQuotaRecovery();
    
    if (recovered) {
      // Test 2: Quota Management
      await testQuotaManagement();
    }
    
    // Generate Report
    await generateQuotaReport();
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`\n🏁 Quota recovery test completed in ${duration} seconds`, 'success');
    
    if (recovered) {
      log('🎉 System is ready for continued testing!', 'success');
      process.exit(0);
    } else {
      log('⏳ System needs more time for quota recovery', 'warning');
      process.exit(1);
    }
    
  } catch (error) {
    log(`❌ Quota recovery test failed: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n🛑 Quota recovery test interrupted by user', 'warning');
  process.exit(1);
});

// Run the test
if (require.main === module) {
  runQuotaRecoveryTest().catch((error) => {
    log(`❌ Fatal error: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { runQuotaRecoveryTest };
