#!/usr/bin/env node

/**
 * Real-World Load Test
 * 
 * This script simulates a realistic scenario:
 * - 3 concurrent users
 * - 100 scans per inventory
 * - Real-time WebSocket collaboration
 * - Multiple agencies working simultaneously
 */

const axios = require('axios');
const WebSocket = require('ws');

// Realistic scenario configuration
const CONFIG = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
  wsBaseUrl: process.env.WEBSOCKET_SERVER_URL || 'ws://localhost:5000',
  
  // Real-world scenario
  concurrentUsers: 3,
  scansPerInventory: 100, // Real scenario
  agencies: ['Suzuki', 'Alfa Romeo', 'Renault'],
  
  // Timing (realistic for production)
  delayBetweenScans: 200, // 200ms (realistic scan speed)
  delayBetweenUsers: 5000, // 5 seconds between users starting
  
  // Test parameters
  testMonth: 10,
  testYear: 2025,
  maxInventoriesPerUser: 1 // 1 inventory per user for this test
};

// Test results tracking
const testResults = {
  totalUsers: CONFIG.concurrentUsers,
  totalScansAttempted: 0,
  totalScansSuccessful: 0,
  quotaErrors: 0,
  apiErrors: 0,
  websocketMessages: 0,
  startTime: Date.now(),
  userResults: {}
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    progress: '🔄',
    quota: '⏱️',
    user: '👤'
  }[type] || '📋';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateBarcode(agency, month, year, userId, scanNum) {
  const agencyCode = agency.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  return `${agencyCode}${year}${month.toString().padStart(2, '0')}${userId}${scanNum.toString().padStart(3, '0')}`;
}

// Simulate a single user performing an inventory
async function simulateUser(userId, agency) {
  log(`\n👤 User ${userId} starting inventory for ${agency}`, 'user');
  
  const userResult = {
    userId,
    agency,
    scansAttempted: 0,
    scansSuccessful: 0,
    quotaErrors: 0,
    apiErrors: 0,
    websocketMessages: 0,
    errors: [],
    startTime: Date.now()
  };
  
  try {
    // Create WebSocket connection
    const wsUrl = `${CONFIG.wsBaseUrl}/ws/inventory/${encodeURIComponent(agency)}/${CONFIG.testMonth}/${CONFIG.testYear}`;
    const ws = new WebSocket(wsUrl);
    
    ws.on('message', (data) => {
      userResult.websocketMessages++;
      testResults.websocketMessages++;
      const message = JSON.parse(data);
      log(`  📡 User ${userId} WebSocket: ${message.type}`, 'info');
    });
    
    // Wait for WebSocket connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    // Send user joined message
    ws.send(JSON.stringify({
      type: 'user_joined',
      data: {
        agency: agency,
        month: CONFIG.testMonth,
        year: CONFIG.testYear,
        userId: `user_${userId}`,
        userName: `User ${userId}`
      }
    }));
    
    await sleep(500);
    
    // Perform 100 scans (realistic scenario)
    log(`  📱 User ${userId} performing ${CONFIG.scansPerInventory} scans...`, 'progress');
    
    for (let scanNum = 1; scanNum <= CONFIG.scansPerInventory; scanNum++) {
      userResult.scansAttempted++;
      testResults.totalScansAttempted++;
      
      const barcode = generateBarcode(agency, CONFIG.testMonth, CONFIG.testYear, userId, scanNum);
      
      try {
        const scanResponse = await axios.post(`${CONFIG.apiBaseUrl}/api/inventory/save-scan`, {
          agency: agency,
          month: CONFIG.testMonth.toString(),
          year: CONFIG.testYear.toString(),
          code: barcode,
          user: `user_${userId}`,
          userName: `User ${userId}`,
          carData: {
            marca: `${agency} Brand ${scanNum}`,
            color: `Color ${scanNum}`,
            ubicaciones: `Location ${scanNum}`,
            modelo: `Model ${scanNum}`,
            año: 2020 + (scanNum % 5),
            precio: 50000 + (scanNum * 1000)
          }
        }, {
          timeout: 30000
        });
        
        if (scanResponse.status === 200) {
          userResult.scansSuccessful++;
          testResults.totalScansSuccessful++;
          
          if (scanNum % 10 === 0) {
            log(`    ✅ User ${userId}: ${scanNum}/${CONFIG.scansPerInventory} scans completed`, 'success');
          }
        } else {
          throw new Error(`Scan failed with status ${scanResponse.status}`);
        }
        
        await sleep(CONFIG.delayBetweenScans);
        
      } catch (error) {
        userResult.apiErrors++;
        testResults.apiErrors++;
        
        if (error.message.includes('Quota exceeded') || error.message.includes('quota')) {
          userResult.quotaErrors++;
          testResults.quotaErrors++;
          log(`    ⏱️ User ${userId} scan ${scanNum} hit quota limit`, 'quota');
        } else {
          log(`    ❌ User ${userId} scan ${scanNum} failed: ${error.message}`, 'error');
          userResult.errors.push(`Scan ${scanNum}: ${error.message}`);
        }
        
        // If quota exceeded, wait longer before retry
        if (error.message.includes('Quota exceeded')) {
          await sleep(5000); // Wait 5 seconds for quota reset
        }
      }
    }
    
    // Complete inventory
    log(`  🏁 User ${userId} completing inventory...`, 'progress');
    
    try {
      const completeResponse = await axios.post(`${CONFIG.apiBaseUrl}/api/inventory/finish-session`, {
        agency: agency,
        month: CONFIG.testMonth.toString(),
        year: CONFIG.testYear.toString(),
        user: `user_${userId}`
      }, {
        timeout: 30000
      });
      
      if (completeResponse.status === 200) {
        log(`  ✅ User ${userId} inventory completed successfully`, 'success');
      } else {
        log(`  ⚠️ User ${userId} inventory completion returned status ${completeResponse.status}`, 'warning');
      }
      
    } catch (error) {
      if (error.message.includes('Quota exceeded')) {
        userResult.quotaErrors++;
        testResults.quotaErrors++;
        log(`  ⏱️ User ${userId} inventory completion hit quota limit`, 'quota');
      } else {
        log(`  ❌ User ${userId} inventory completion failed: ${error.message}`, 'error');
        userResult.apiErrors++;
        testResults.apiErrors++;
      }
    }
    
    await sleep(2000);
    ws.close();
    
    userResult.endTime = Date.now();
    userResult.duration = Math.round((userResult.endTime - userResult.startTime) / 1000);
    testResults.userResults[`user_${userId}`] = userResult;
    
    log(`  📊 User ${userId} completed: ${userResult.scansSuccessful}/${userResult.scansAttempted} scans in ${userResult.duration}s`, 'success');
    
  } catch (error) {
    log(`  ❌ User ${userId} failed: ${error.message}`, 'error');
    userResult.errors.push(error.message);
    testResults.userResults[`user_${userId}`] = userResult;
  }
  
  return userResult;
}

// Generate comprehensive report
function generateRealWorldReport() {
  log('\n📊 === REAL-WORLD LOAD TEST REPORT ===', 'progress');
  
  const duration = Math.round((Date.now() - testResults.startTime) / 1000 / 60);
  const totalExpectedScans = CONFIG.concurrentUsers * CONFIG.scansPerInventory;
  const successRate = ((testResults.totalScansSuccessful / testResults.totalScansAttempted) * 100).toFixed(2);
  const quotaErrorRate = ((testResults.quotaErrors / testResults.totalScansAttempted) * 100).toFixed(2);
  
  console.log('\n🎯 REAL-WORLD SCENARIO RESULTS:');
  console.log(`   Duration: ${duration} minutes`);
  console.log(`   Concurrent Users: ${testResults.totalUsers}`);
  console.log(`   Scans Attempted: ${testResults.totalScansAttempted}/${totalExpectedScans}`);
  console.log(`   Scans Successful: ${testResults.totalScansSuccessful}`);
  console.log(`   Success Rate: ${successRate}%`);
  console.log(`   Quota Errors: ${testResults.quotaErrors} (${quotaErrorRate}%)`);
  console.log(`   API Errors: ${testResults.apiErrors}`);
  console.log(`   WebSocket Messages: ${testResults.websocketMessages}`);
  
  console.log('\n👤 USER BREAKDOWN:');
  Object.entries(testResults.userResults).forEach(([userId, result]) => {
    const userSuccessRate = ((result.scansSuccessful / result.scansAttempted) * 100).toFixed(2);
    console.log(`   ${userId}: ${result.scansSuccessful}/${result.scansAttempted} scans (${userSuccessRate}%) in ${result.duration}s`);
    console.log(`     Quota Errors: ${result.quotaErrors}, API Errors: ${result.apiErrors}`);
  });
  
  console.log('\n📈 REAL-WORLD ASSESSMENT:');
  
  if (successRate >= 90) {
    console.log('🎉 EXCELLENT: System can handle real-world load');
    console.log('✅ Ready for production with multiple users');
  } else if (successRate >= 70) {
    console.log('⚠️ GOOD: System works but with some limitations');
    console.log('⚠️ Consider optimizing for better performance');
  } else if (successRate >= 50) {
    console.log('❌ POOR: System struggles with real-world load');
    console.log('❌ Significant quota issues detected');
  } else {
    console.log('🚫 FAILED: System cannot handle real-world scenario');
    console.log('🚫 Major quota and API issues');
  }
  
  console.log('\n🔧 QUOTA ANALYSIS:');
  const estimatedApiCalls = testResults.totalScansAttempted * 5; // ~5 API calls per scan
  const quotaLimit = 100; // Google's limit per minute
  const estimatedMinutes = Math.ceil(estimatedApiCalls / quotaLimit);
  
  console.log(`   Estimated API Calls: ${estimatedApiCalls}`);
  console.log(`   Quota Limit: ${quotaLimit} calls/minute`);
  console.log(`   Estimated Time Needed: ${estimatedMinutes} minutes`);
  console.log(`   Actual Time Taken: ${duration} minutes`);
  
  if (quotaErrorRate > 20) {
    console.log('\n🚨 CRITICAL QUOTA ISSUES:');
    console.log('   ❌ System cannot handle 100 scans per inventory');
    console.log('   ❌ Multiple users will cause quota overruns');
    console.log('   ❌ Production deployment not recommended');
  } else if (quotaErrorRate > 10) {
    console.log('\n⚠️ QUOTA CONCERNS:');
    console.log('   ⚠️ System works but with quota limitations');
    console.log('   ⚠️ Consider reducing scans per inventory');
    console.log('   ⚠️ Request quota increase from Google');
  } else {
    console.log('\n✅ QUOTA STATUS:');
    console.log('   ✅ System handles quota limits well');
    console.log('   ✅ Ready for production deployment');
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  
  if (successRate < 80) {
    console.log('   🚨 URGENT: Request Google Sheets API quota increase');
    console.log('   🚨 URGENT: Implement batch operations');
    console.log('   🚨 URGENT: Consider database alternatives for heavy operations');
  }
  
  console.log('   📊 Monitor quota usage in production');
  console.log('   🔄 Implement smart caching strategies');
  console.log('   ⏱️ Add exponential backoff for quota errors');
  console.log('   🎯 Consider reducing scans per inventory to 50-75');
  
  // Save detailed report
  const reportData = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    results: testResults,
    summary: {
      duration: duration,
      successRate: parseFloat(successRate),
      quotaErrorRate: parseFloat(quotaErrorRate),
      estimatedApiCalls: estimatedApiCalls,
      estimatedMinutes: estimatedMinutes
    },
    assessment: {
      productionReady: successRate >= 80 && quotaErrorRate < 10,
      needsOptimization: successRate < 80 || quotaErrorRate > 10,
      criticalIssues: quotaErrorRate > 20
    }
  };
  
  const fs = require('fs');
  const reportFile = `real-world-load-test-report-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
  
  log(`\n📄 Detailed report saved to ${reportFile}`, 'success');
}

// Main execution
async function runRealWorldLoadTest() {
  log('🚀 Starting Real-World Load Test...', 'progress');
  log(`Scenario: ${CONFIG.concurrentUsers} users, ${CONFIG.scansPerInventory} scans each, ${CONFIG.delayBetweenScans}ms delays`, 'info');
  log(`Expected API calls: ~${CONFIG.concurrentUsers * CONFIG.scansPerInventory * 5} calls`, 'info');
  
  try {
    // Start all users concurrently
    const userPromises = [];
    
    for (let i = 1; i <= CONFIG.concurrentUsers; i++) {
      const agency = CONFIG.agencies[(i - 1) % CONFIG.agencies.length];
      
      // Stagger user start times
      setTimeout(() => {
        userPromises.push(simulateUser(i, agency));
      }, (i - 1) * CONFIG.delayBetweenUsers);
    }
    
    // Wait for all users to complete
    await Promise.all(userPromises);
    
    // Generate report
    generateRealWorldReport();
    
    log('\n🏁 Real-world load test completed', 'success');
    
  } catch (error) {
    log(`❌ Load test failed: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n🛑 Load test interrupted by user', 'warning');
  generateRealWorldReport();
  process.exit(1);
});

// Run the test
if (require.main === module) {
  runRealWorldLoadTest().catch((error) => {
    log(`❌ Fatal error: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { runRealWorldLoadTest, CONFIG, testResults };
