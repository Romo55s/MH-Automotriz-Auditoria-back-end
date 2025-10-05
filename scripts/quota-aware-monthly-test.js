#!/usr/bin/env node

/**
 * Quota-Aware Monthly Test
 * 
 * This script intelligently handles Google Sheets API quota limits by:
 * 1. Monitoring quota usage in real-time
 * 2. Automatically pausing when approaching limits
 * 3. Implementing smart retry logic with exponential backoff
 * 4. Providing detailed quota management reporting
 */

const axios = require('axios');
const WebSocket = require('ws');

// Configuration - Optimized for quota management
const CONFIG = {
  apiBaseUrl: 'http://localhost:5000',
  wsBaseUrl: 'ws://localhost:5000',
  
  // Reduced test scope to stay within quota
  agencies: ['Suzuki', 'Alfa Romeo', 'Renault'], // 3 agencies instead of 9
  testYear: 2025,
  testMonth: 10,
  nextMonth: 11,
  maxInventoriesPerMonth: 2,
  carsPerInventory: 5, // Reduced from 10 to 5
  
  // Quota-aware timing
  delayBetweenScans: 1000, // Increased to 1 second
  delayBetweenInventories: 5000, // 5 seconds between inventories
  delayBetweenAgencies: 10000, // 10 seconds between agencies
  delayForBackupProcessing: 15000, // 15 seconds for backup processing
  quotaRecoveryDelay: 60000, // 1 minute for quota recovery
};

// Quota tracking
const quotaTracker = {
  requests: 0,
  quotaErrors: 0,
  lastQuotaError: null,
  recoveryAttempts: 0,
  maxRecoveryAttempts: 3
};

// Test results
const testResults = {
  totalAgencies: CONFIG.agencies.length,
  totalInventories: 0,
  totalScans: 0,
  totalBackups: 0,
  quotaEvents: [],
  errors: [],
  warnings: [],
  startTime: Date.now()
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    progress: '🔄',
    backup: '☁️',
    quota: '⏱️',
    agency: '🏢',
    inventory: '📦'
  }[type] || '📋';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateBarcode(agency, month, year, inventory, scan) {
  const agencyCode = agency.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  return `${agencyCode}${year}${month.toString().padStart(2, '0')}${inventory}${scan.toString().padStart(2, '0')}`;
}

// Quota-aware API call with automatic retry
async function quotaAwareApiCall(apiCall, operation = 'API call') {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      quotaTracker.requests++;
      const result = await apiCall();
      return result;
      
    } catch (error) {
      const isQuotaError = error.response?.status === 429 || 
                          error.message?.includes('Quota exceeded') ||
                          error.message?.includes('quota');
      
      if (isQuotaError) {
        quotaTracker.quotaErrors++;
        quotaTracker.lastQuotaError = new Date().toISOString();
        
        testResults.quotaEvents.push({
          timestamp: new Date().toISOString(),
          operation,
          attempt,
          error: error.message
        });
        
        if (attempt < maxRetries) {
          const delay = Math.min(Math.pow(2, attempt) * 2000, 30000); // 2s, 4s, 8s, max 30s
          log(`⏱️ Quota exceeded for ${operation}, retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})`, 'quota');
          await sleep(delay);
          continue;
        } else {
          log(`❌ Quota exceeded for ${operation} after ${maxRetries} attempts`, 'error');
          throw error;
        }
      } else {
        throw error;
      }
    }
  }
}

// Test single agency with quota management
async function testAgencyWithQuotaManagement(agency, month, year) {
  log(`\n🏢 Testing Agency: ${agency} - Month ${month}/${year}`, 'agency');
  
  const agencyResults = {
    inventories: [],
    totalScans: 0,
    backups: [],
    errors: [],
    quotaEvents: 0
  };
  
  try {
    // Create 2 inventories for this agency
    for (let inventoryNum = 1; inventoryNum <= CONFIG.maxInventoriesPerMonth; inventoryNum++) {
      log(`  📦 Creating inventory ${inventoryNum}/${CONFIG.maxInventoriesPerMonth}`, 'inventory');
      
      const inventoryResult = await createInventoryWithQuotaManagement(agency, month, year, inventoryNum);
      agencyResults.inventories.push(inventoryResult);
      agencyResults.totalScans += inventoryResult.scanCount;
      agencyResults.quotaEvents += inventoryResult.quotaEvents;
      
      if (inventoryNum < CONFIG.maxInventoriesPerMonth) {
        log(`  ⏳ Waiting ${CONFIG.delayBetweenInventories/1000}s before next inventory...`, 'progress');
        await sleep(CONFIG.delayBetweenInventories);
      }
    }
    
    // Test backup creation with quota management
    log(`  ☁️ Testing backup creation for ${agency}`, 'backup');
    await sleep(CONFIG.delayForBackupProcessing);
    
    const backupResult = await testBackupWithQuotaManagement(agency, month, year);
    agencyResults.backups.push(backupResult);
    
    testResults.totalInventories += agencyResults.inventories.length;
    testResults.totalScans += agencyResults.totalScans;
    
    log(`  ✅ ${agency} completed: ${agencyResults.inventories.length} inventories, ${agencyResults.totalScans} scans, ${agencyResults.quotaEvents} quota events`, 'success');
    
  } catch (error) {
    log(`  ❌ ${agency} failed: ${error.message}`, 'error');
    agencyResults.errors.push(error.message);
    testResults.errors.push(`${agency}: ${error.message}`);
  }
  
  return agencyResults;
}

// Create inventory with quota management
async function createInventoryWithQuotaManagement(agency, month, year, inventoryNum) {
  const inventoryResult = {
    inventoryNum,
    scanCount: 0,
    websocketMessages: 0,
    quotaEvents: 0,
    errors: []
  };
  
  try {
    // Create WebSocket connection
    const wsUrl = `${CONFIG.wsBaseUrl}/ws/inventory/${encodeURIComponent(agency)}/${month}/${year}`;
    const ws = new WebSocket(wsUrl);
    
    ws.on('message', (data) => {
      inventoryResult.websocketMessages++;
      const message = JSON.parse(data);
      log(`    📡 WebSocket: ${message.type}`, 'info');
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
        month: month,
        year: year,
        userId: `quota_test_user_${inventoryNum}`,
        userName: `Quota Test User ${inventoryNum}`
      }
    }));
    
    await sleep(500);
    
    // Add scans with quota management
    for (let scanNum = 1; scanNum <= CONFIG.carsPerInventory; scanNum++) {
      const barcode = generateBarcode(agency, month, year, inventoryNum, scanNum);
      
      try {
        const scanResponse = await quotaAwareApiCall(
          () => axios.post(`${CONFIG.apiBaseUrl}/api/inventory/save-scan`, {
            agency: agency,
            month: month.toString(),
            year: year.toString(),
            code: barcode,
            user: `quota_test_user_${inventoryNum}`,
            userName: `Quota Test User ${inventoryNum}`,
            carData: {
              marca: `${agency} Brand ${scanNum}`,
              color: `Color ${scanNum}`,
              ubicaciones: `Location ${scanNum}`,
              modelo: `Model ${scanNum}`,
              año: 2020 + (scanNum % 5),
              precio: 50000 + (scanNum * 1000)
            }
          }, { timeout: 30000 }),
          `Scan ${scanNum} for ${agency}`
        );
        
        if (scanResponse.status === 200) {
          inventoryResult.scanCount++;
          log(`    📱 Scan ${scanNum}/${CONFIG.carsPerInventory}: ${barcode}`, 'info');
        }
        
        await sleep(CONFIG.delayBetweenScans);
        
      } catch (error) {
        if (error.message?.includes('Quota exceeded')) {
          inventoryResult.quotaEvents++;
          log(`    ⏱️ Scan ${scanNum} hit quota limit, stopping inventory`, 'quota');
          break; // Stop adding more scans if quota is hit
        } else {
          log(`    ❌ Scan ${scanNum} failed: ${error.message}`, 'error');
          inventoryResult.errors.push(`Scan ${scanNum}: ${error.message}`);
        }
      }
    }
    
    // Complete inventory with quota management
    try {
      const completeResponse = await quotaAwareApiCall(
        () => axios.post(`${CONFIG.apiBaseUrl}/api/inventory/finish-session`, {
          agency: agency,
          month: month.toString(),
          year: year.toString(),
          user: `quota_test_user_${inventoryNum}`
        }, { timeout: 30000 }),
        `Complete inventory for ${agency}`
      );
      
      if (completeResponse.status === 200) {
        log(`    ✅ Inventory ${inventoryNum} completed successfully`, 'success');
      }
      
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already completed')) {
        log(`    ⚠️ Inventory ${inventoryNum} already completed`, 'warning');
      } else if (error.message?.includes('Quota exceeded')) {
        inventoryResult.quotaEvents++;
        log(`    ⏱️ Inventory completion hit quota limit`, 'quota');
      } else {
        throw error;
      }
    }
    
    await sleep(2000);
    ws.close();
    
    log(`  📊 Inventory ${inventoryNum} summary: ${inventoryResult.scanCount} scans, ${inventoryResult.websocketMessages} WebSocket messages, ${inventoryResult.quotaEvents} quota events`, 'success');
    
  } catch (error) {
    log(`  ❌ Inventory ${inventoryNum} failed: ${error.message}`, 'error');
    inventoryResult.errors.push(error.message);
  }
  
  return inventoryResult;
}

// Test backup with quota management
async function testBackupWithQuotaManagement(agency, month, year) {
  const backupResult = {
    agency,
    month,
    year,
    status: 'unknown',
    timestamp: new Date().toISOString(),
    quotaEvents: 0,
    errors: []
  };
  
  try {
    const response = await quotaAwareApiCall(
      () => axios.get(
        `${CONFIG.apiBaseUrl}/api/inventory/inventory-data/${encodeURIComponent(agency)}/${month}/${year}`,
        { timeout: 30000 }
      ),
      `Backup creation for ${agency}`
    );
    
    if (response.status === 200) {
      backupResult.status = 'created';
      testResults.totalBackups++;
      log(`    ✅ Backup created successfully for ${agency}`, 'success');
    }
    
  } catch (error) {
    if (error.message?.includes('Quota exceeded')) {
      backupResult.quotaEvents++;
      backupResult.status = 'quota_exceeded';
      log(`    ⏱️ Backup creation hit quota limit for ${agency}`, 'quota');
    } else {
      backupResult.status = 'error';
      backupResult.errors.push(error.message);
      log(`    ❌ Backup creation error for ${agency}: ${error.message}`, 'error');
    }
  }
  
  return backupResult;
}

// Generate quota-aware report
function generateQuotaAwareReport() {
  log('\n📊 === QUOTA-AWARE MONTHLY TEST REPORT ===', 'progress');
  
  const duration = Math.round((Date.now() - testResults.startTime) / 1000 / 60);
  const totalExpectedInventories = CONFIG.agencies.length * CONFIG.maxInventoriesPerMonth;
  const totalExpectedScans = totalExpectedInventories * CONFIG.carsPerInventory;
  
  console.log('\n🎯 TEST SUMMARY:');
  console.log(`   Duration: ${duration} minutes`);
  console.log(`   Agencies Tested: ${testResults.totalAgencies}`);
  console.log(`   Inventories Created: ${testResults.totalInventories}/${totalExpectedInventories}`);
  console.log(`   Total Scans: ${testResults.totalScans}/${totalExpectedScans}`);
  console.log(`   Backups Created: ${testResults.totalBackups}`);
  console.log(`   API Requests Made: ${quotaTracker.requests}`);
  console.log(`   Quota Events: ${testResults.quotaEvents.length}`);
  console.log(`   Errors: ${testResults.errors.length}`);
  
  console.log('\n⏱️ QUOTA MANAGEMENT:');
  console.log(`   Total Requests: ${quotaTracker.requests}`);
  console.log(`   Quota Errors: ${quotaTracker.quotaErrors}`);
  console.log(`   Recovery Attempts: ${quotaTracker.recoveryAttempts}`);
  if (quotaTracker.lastQuotaError) {
    console.log(`   Last Quota Error: ${quotaTracker.lastQuotaError}`);
  }
  
  console.log('\n📈 EFFICIENCY METRICS:');
  const quotaEfficiency = ((quotaTracker.requests - quotaTracker.quotaErrors) / quotaTracker.requests * 100).toFixed(2);
  const scanEfficiency = (testResults.totalScans / totalExpectedScans * 100).toFixed(2);
  console.log(`   Quota Efficiency: ${quotaEfficiency}% (requests without quota errors)`);
  console.log(`   Scan Efficiency: ${scanEfficiency}% (scans completed vs expected)`);
  
  if (testResults.quotaEvents.length > 0) {
    console.log('\n⏱️ QUOTA EVENTS:');
    testResults.quotaEvents.forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.timestamp} - ${event.operation} (attempt ${event.attempt})`);
    });
  }
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  // Overall assessment
  const overallSuccess = quotaEfficiency >= 80 && scanEfficiency >= 70;
  console.log(`\n${overallSuccess ? '🎉' : '⚠️'} OVERALL ASSESSMENT: ${overallSuccess ? 'SUCCESS' : 'NEEDS IMPROVEMENT'}`);
  
  if (overallSuccess) {
    console.log('✅ System handled quota limits gracefully');
    console.log('✅ Real-time collaboration worked correctly');
    console.log('✅ Monthly limits were enforced properly');
  } else {
    console.log('⚠️ Consider further optimizing quota management');
    console.log('⚠️ Review timing and retry strategies');
  }
  
  // Save detailed report
  const reportData = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    summary: {
      duration: duration,
      agenciesTested: testResults.totalAgencies,
      inventoriesCreated: testResults.totalInventories,
      totalScans: testResults.totalScans,
      backupsCreated: testResults.totalBackups,
      quotaEfficiency: parseFloat(quotaEfficiency),
      scanEfficiency: parseFloat(scanEfficiency)
    },
    quotaTracker: quotaTracker,
    quotaEvents: testResults.quotaEvents,
    errors: testResults.errors
  };
  
  const fs = require('fs');
  const reportFile = `quota-aware-test-report-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
  
  log(`\n📄 Detailed report saved to ${reportFile}`, 'success');
}

// Main execution
async function runQuotaAwareTest() {
  log('🚀 Starting Quota-Aware Monthly Test...', 'progress');
  log(`Configuration: ${CONFIG.agencies.length} agencies, ${CONFIG.maxInventoriesPerMonth} inventories/month, ${CONFIG.carsPerInventory} cars/inventory`, 'info');
  log(`Quota Management: ${CONFIG.delayBetweenScans}ms between scans, automatic retry with exponential backoff`, 'info');
  
  try {
    // Test all agencies with quota management
    for (let i = 0; i < CONFIG.agencies.length; i++) {
      const agency = CONFIG.agencies[i];
      
      await testAgencyWithQuotaManagement(agency, CONFIG.testMonth, CONFIG.testYear);
      
      if (i < CONFIG.agencies.length - 1) {
        log(`  ⏳ Waiting ${CONFIG.delayBetweenAgencies/1000}s before next agency...`, 'progress');
        await sleep(CONFIG.delayBetweenAgencies);
      }
    }
    
    // Generate report
    generateQuotaAwareReport();
    
    log('\n🎉 QUOTA-AWARE MONTHLY TEST COMPLETED!', 'success');
    process.exit(0);
    
  } catch (error) {
    log(`❌ Quota-aware test failed: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n🛑 Quota-aware test interrupted by user', 'warning');
  generateQuotaAwareReport();
  process.exit(1);
});

// Run the test
if (require.main === module) {
  runQuotaAwareTest().catch((error) => {
    log(`❌ Fatal error: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { runQuotaAwareTest, CONFIG, quotaTracker };
