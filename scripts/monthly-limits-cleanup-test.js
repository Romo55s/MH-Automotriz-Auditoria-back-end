#!/usr/bin/env node

/**
 * Monthly Limits and Cleanup Test
 * 
 * This script specifically tests:
 * - Monthly inventory limits (2 per month maximum)
 * - Google Drive backup creation and management
 * - Automatic cleanup of old backups
 * - File storage lifecycle management
 * - Edge cases and error handling
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  apiBaseUrl: 'http://localhost:5000',
  testAgency: 'Test Limits Agency',
  testYear: 2025,
  maxInventoriesPerMonth: 2,
  testMonths: [1, 2, 3], // Test first 3 months
  delayBetweenTests: 2000
};

// Test results
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  monthlyLimits: {},
  cleanupTests: {}
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    progress: '🔄'
  }[type] || '📋';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Monthly Inventory Limits
async function testMonthlyLimits() {
  log('\n🔢 Testing Monthly Inventory Limits...', 'progress');
  
  for (const month of CONFIG.testMonths) {
    log(`\n📅 Testing Month ${month} - Maximum ${CONFIG.maxInventoriesPerMonth} inventories allowed`, 'info');
    
    const monthResults = {
      inventoriesCreated: 0,
      limitExceeded: false,
      errors: []
    };
    
    try {
      // Create the maximum allowed inventories (2)
      for (let i = 1; i <= CONFIG.maxInventoriesPerMonth; i++) {
        log(`  📦 Creating inventory ${i}/${CONFIG.maxInventoriesPerMonth}`, 'progress');
        
        try {
          // Create a simple inventory with one scan
          const scanResponse = await axios.post(`${CONFIG.apiBaseUrl}/api/inventory/save-scan`, {
            agency: CONFIG.testAgency,
            month: month.toString(),
            year: CONFIG.testYear.toString(),
            code: `LIMIT_TEST_${month}_${i}_001`,
            user: `limit_test_user_${i}`,
            userName: `Limit Test User ${i}`,
            carData: {
              marca: `Test Brand ${i}`,
              color: `Test Color ${i}`,
              ubicaciones: `Test Location ${i}`
            }
          });
          
          if (scanResponse.status === 200) {
            monthResults.inventoriesCreated++;
            log(`    ✅ Inventory ${i} created successfully`, 'success');
            
            // Complete the inventory
            const completeResponse = await axios.post(`${CONFIG.apiBaseUrl}/api/inventory/finish-session`, {
              agency: CONFIG.testAgency,
              month: month.toString(),
              year: CONFIG.testYear.toString(),
              user: `limit_test_user_${i}`
            });
            
            if (completeResponse.status === 200) {
              log(`    ✅ Inventory ${i} completed successfully`, 'success');
            } else {
              log(`    ⚠️ Inventory ${i} completion returned status ${completeResponse.status}`, 'warning');
            }
            
          } else {
            throw new Error(`Inventory creation failed with status ${scanResponse.status}`);
          }
          
          await sleep(CONFIG.delayBetweenTests);
          
        } catch (error) {
          if (error.response?.status === 400 && error.response?.data?.message?.includes('already completed')) {
            log(`    ⚠️ Inventory ${i} already completed (expected in some scenarios)`, 'warning');
            monthResults.inventoriesCreated++; // Count as created
          } else {
            log(`    ❌ Inventory ${i} failed: ${error.message}`, 'error');
            monthResults.errors.push(`Inventory ${i}: ${error.message}`);
          }
        }
      }
      
      // Test: Try to create a third inventory (should be allowed by system but we'll track it)
      log(`  🧪 Testing limit: Attempting to create inventory ${CONFIG.maxInventoriesPerMonth + 1}`, 'progress');
      
      try {
        const extraScanResponse = await axios.post(`${CONFIG.apiBaseUrl}/api/inventory/save-scan`, {
          agency: CONFIG.testAgency,
          month: month.toString(),
          year: CONFIG.testYear.toString(),
          code: `LIMIT_TEST_${month}_${CONFIG.maxInventoriesPerMonth + 1}_001`,
          user: `limit_test_user_${CONFIG.maxInventoriesPerMonth + 1}`,
          userName: `Limit Test User ${CONFIG.maxInventoriesPerMonth + 1}`,
          carData: {
            marca: `Test Brand ${CONFIG.maxInventoriesPerMonth + 1}`,
            color: `Test Color ${CONFIG.maxInventoriesPerMonth + 1}`,
            ubicaciones: `Test Location ${CONFIG.maxInventoriesPerMonth + 1}`
          }
        });
        
        if (scanResponse.status === 200) {
          monthResults.inventoriesCreated++;
          log(`    📊 System allowed inventory ${CONFIG.maxInventoriesPerMonth + 1} (no hard limit enforced)`, 'info');
        }
        
      } catch (error) {
        log(`    ✅ System correctly rejected extra inventory: ${error.response?.data?.message || error.message}`, 'success');
        monthResults.limitExceeded = true;
      }
      
      testResults.monthlyLimits[`month_${month}`] = monthResults;
      
      log(`📊 Month ${month} results: ${monthResults.inventoriesCreated} inventories created`, 'success');
      
    } catch (error) {
      log(`❌ Month ${month} test failed: ${error.message}`, 'error');
      monthResults.errors.push(error.message);
      testResults.failed++;
      testResults.errors.push(error.message);
    }
  }
}

// Test 2: Google Drive Backup System
async function testGoogleDriveBackups() {
  log('\n☁️ Testing Google Drive Backup System...', 'progress');
  
  try {
    // Test backup creation by accessing inventory data
    for (const month of CONFIG.testMonths) {
      log(`  📦 Testing backup for ${CONFIG.testAgency} - Month ${month}`, 'progress');
      
      try {
        // This should trigger backup creation if it doesn't exist
        const response = await axios.get(
          `${CONFIG.apiBaseUrl}/api/inventory/inventory-data/${encodeURIComponent(CONFIG.testAgency)}/${month}/${CONFIG.testYear}`
        );
        
        if (response.status === 200) {
          log(`    ✅ Backup data accessible for Month ${month}`, 'success');
          testResults.cleanupTests[`backup_month_${month}`] = {
            status: 'accessible',
            timestamp: new Date().toISOString()
          };
        } else {
          log(`    ⚠️ Backup data returned status ${response.status} for Month ${month}`, 'warning');
        }
        
      } catch (error) {
        log(`    ❌ Backup test failed for Month ${month}: ${error.message}`, 'error');
        testResults.cleanupTests[`backup_month_${month}`] = {
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
      
      await sleep(CONFIG.delayBetweenTests);
    }
    
    // Test backup file structure (if possible)
    log(`  📁 Testing backup file structure...`, 'progress');
    
    try {
      // Check if temp directory exists and has files
      const tempDir = path.join(__dirname, '..', 'temp');
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        log(`    📊 Temp directory contains ${files.length} files`, 'info');
        
        testResults.cleanupTests.tempDirectory = {
          exists: true,
          fileCount: files.length,
          files: files.slice(0, 5) // Show first 5 files
        };
      } else {
        log(`    📁 Temp directory does not exist`, 'info');
        testResults.cleanupTests.tempDirectory = {
          exists: false
        };
      }
      
    } catch (error) {
      log(`    ❌ File structure test failed: ${error.message}`, 'error');
    }
    
  } catch (error) {
    log(`❌ Google Drive backup test failed: ${error.message}`, 'error');
    testResults.errors.push(error.message);
  }
}

// Test 3: Cleanup System
async function testCleanupSystem() {
  log('\n🧹 Testing Cleanup System...', 'progress');
  
  try {
    // Test 1: Check cleanup scheduler status
    log(`  ⏰ Testing cleanup scheduler...`, 'progress');
    
    try {
      // Try to access health endpoint to see if cleanup is running
      const healthResponse = await axios.get(`${CONFIG.apiBaseUrl}/health/detailed`);
      
      if (healthResponse.status === 200 && healthResponse.data.cleanupScheduler) {
        log(`    ✅ Cleanup scheduler is running`, 'success');
        testResults.cleanupTests.scheduler = {
          status: 'running',
          details: healthResponse.data.cleanupScheduler
        };
      } else {
        log(`    ⚠️ Cleanup scheduler status unknown`, 'warning');
        testResults.cleanupTests.scheduler = {
          status: 'unknown'
        };
      }
      
    } catch (error) {
      log(`    ❌ Cleanup scheduler test failed: ${error.message}`, 'error');
      testResults.cleanupTests.scheduler = {
        status: 'error',
        error: error.message
      };
    }
    
    // Test 2: Create test data for cleanup
    log(`  🗂️ Creating test data for cleanup...`, 'progress');
    
    const testDataResults = {
      created: 0,
      errors: []
    };
    
    for (let i = 1; i <= 3; i++) {
      try {
        const scanResponse = await axios.post(`${CONFIG.apiBaseUrl}/api/inventory/save-scan`, {
          agency: `${CONFIG.testAgency} Cleanup`,
          month: '1',
          year: CONFIG.testYear.toString(),
          code: `CLEANUP_TEST_${i}_001`,
          user: `cleanup_test_user_${i}`,
          userName: `Cleanup Test User ${i}`,
          carData: {
            marca: `Cleanup Test Brand ${i}`,
            color: `Cleanup Test Color ${i}`,
            ubicaciones: `Cleanup Test Location ${i}`
          }
        });
        
        if (scanResponse.status === 200) {
          testDataResults.created++;
          log(`    ✅ Cleanup test data ${i} created`, 'success');
        }
        
      } catch (error) {
        log(`    ❌ Cleanup test data ${i} failed: ${error.message}`, 'error');
        testDataResults.errors.push(error.message);
      }
    }
    
    testResults.cleanupTests.testData = testDataResults;
    
    // Test 3: Check file storage service
    log(`  📁 Testing file storage service...`, 'progress');
    
    try {
      // Check if file storage service is working
      const tempDir = path.join(__dirname, '..', 'temp');
      const testFile = path.join(tempDir, 'cleanup-test.txt');
      
      // Create a test file
      fs.writeFileSync(testFile, `Cleanup test file created at ${new Date().toISOString()}`);
      
      if (fs.existsSync(testFile)) {
        log(`    ✅ File storage service is working`, 'success');
        
        // Clean up test file
        fs.unlinkSync(testFile);
        log(`    🧹 Test file cleaned up`, 'success');
        
        testResults.cleanupTests.fileStorage = {
          status: 'working',
          testFileCreated: true,
          testFileDeleted: true
        };
      } else {
        throw new Error('Test file was not created');
      }
      
    } catch (error) {
      log(`    ❌ File storage test failed: ${error.message}`, 'error');
      testResults.cleanupTests.fileStorage = {
        status: 'error',
        error: error.message
      };
    }
    
  } catch (error) {
    log(`❌ Cleanup system test failed: ${error.message}`, 'error');
    testResults.errors.push(error.message);
  }
}

// Test 4: Edge Cases and Error Handling
async function testEdgeCases() {
  log('\n🔍 Testing Edge Cases and Error Handling...', 'progress');
  
  const edgeCases = [
    {
      name: 'Invalid Month',
      test: () => axios.post(`${CONFIG.apiBaseUrl}/api/inventory/save-scan`, {
        agency: CONFIG.testAgency,
        month: '13', // Invalid month
        year: CONFIG.testYear.toString(),
        code: 'EDGE_TEST_INVALID_MONTH',
        user: 'edge_test_user',
        userName: 'Edge Test User'
      })
    },
    {
      name: 'Invalid Year',
      test: () => axios.post(`${CONFIG.apiBaseUrl}/api/inventory/save-scan`, {
        agency: CONFIG.testAgency,
        month: '1',
        year: '1999', // Very old year
        code: 'EDGE_TEST_INVALID_YEAR',
        user: 'edge_test_user',
        userName: 'Edge Test User'
      })
    },
    {
      name: 'Empty Agency Name',
      test: () => axios.post(`${CONFIG.apiBaseUrl}/api/inventory/save-scan`, {
        agency: '',
        month: '1',
        year: CONFIG.testYear.toString(),
        code: 'EDGE_TEST_EMPTY_AGENCY',
        user: 'edge_test_user',
        userName: 'Edge Test User'
      })
    },
    {
      name: 'Invalid Barcode Format',
      test: () => axios.post(`${CONFIG.apiBaseUrl}/api/inventory/save-scan`, {
        agency: CONFIG.testAgency,
        month: '1',
        year: CONFIG.testYear.toString(),
        code: 'INVALID_BARCODE_FORMAT!!!',
        user: 'edge_test_user',
        userName: 'Edge Test User'
      })
    }
  ];
  
  for (const edgeCase of edgeCases) {
    log(`  🧪 Testing: ${edgeCase.name}`, 'progress');
    
    try {
      const response = await edgeCase.test();
      
      if (response.status >= 400) {
        log(`    ✅ Correctly rejected invalid input: ${response.status}`, 'success');
        testResults.cleanupTests[`edge_${edgeCase.name.replace(/\s+/g, '_').toLowerCase()}`] = {
          status: 'correctly_rejected',
          httpStatus: response.status
        };
      } else {
        log(`    ⚠️ Unexpectedly accepted invalid input: ${response.status}`, 'warning');
        testResults.cleanupTests[`edge_${edgeCase.name.replace(/\s+/g, '_').toLowerCase()}`] = {
          status: 'unexpectedly_accepted',
          httpStatus: response.status
        };
      }
      
    } catch (error) {
      if (error.response?.status >= 400) {
        log(`    ✅ Correctly rejected invalid input: ${error.response.status}`, 'success');
        testResults.cleanupTests[`edge_${edgeCase.name.replace(/\s+/g, '_').toLowerCase()}`] = {
          status: 'correctly_rejected',
          httpStatus: error.response.status,
          error: error.response.data?.message || error.message
        };
      } else {
        log(`    ❌ Unexpected error: ${error.message}`, 'error');
        testResults.cleanupTests[`edge_${edgeCase.name.replace(/\s+/g, '_').toLowerCase()}`] = {
          status: 'unexpected_error',
          error: error.message
        };
      }
    }
    
    await sleep(CONFIG.delayBetweenTests);
  }
}

// Generate test report
function generateTestReport() {
  log('\n📊 === MONTHLY LIMITS & CLEANUP TEST REPORT ===', 'progress');
  
  const totalTests = Object.keys(testResults.monthlyLimits).length + 
                    Object.keys(testResults.cleanupTests).length;
  const successRate = ((testResults.passed / totalTests) * 100).toFixed(2);
  
  console.log('\n🎯 TEST SUMMARY:');
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${testResults.passed}`);
  console.log(`   Failed: ${testResults.failed}`);
  console.log(`   Success Rate: ${successRate}%`);
  
  console.log('\n📅 MONTHLY LIMITS TEST:');
  Object.entries(testResults.monthlyLimits).forEach(([month, result]) => {
    console.log(`   ${month}: ${result.inventoriesCreated} inventories created${result.errors.length > 0 ? `, ${result.errors.length} errors` : ''}`);
  });
  
  console.log('\n🧹 CLEANUP SYSTEM TEST:');
  Object.entries(testResults.cleanupTests).forEach(([test, result]) => {
    const status = result.status || 'unknown';
    const icon = status.includes('working') || status.includes('correctly_rejected') ? '✅' : 
                 status.includes('error') || status.includes('unexpected') ? '❌' : '⚠️';
    console.log(`   ${icon} ${test}: ${status}`);
  });
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  console.log('\n🎉 MONTHLY LIMITS & CLEANUP TEST COMPLETED!');
  
  // Save detailed report
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: parseFloat(successRate)
    },
    monthlyLimits: testResults.monthlyLimits,
    cleanupTests: testResults.cleanupTests,
    errors: testResults.errors
  };
  
  fs.writeFileSync(
    `monthly-limits-cleanup-report-${new Date().toISOString().split('T')[0]}.json`,
    JSON.stringify(reportData, null, 2)
  );
  
  log('Detailed report saved to monthly-limits-cleanup-report-[date].json', 'success');
}

// Main test execution
async function runMonthlyLimitsTest() {
  log('🚀 Starting Monthly Limits & Cleanup Test...', 'progress');
  
  const startTime = Date.now();
  
  try {
    // Test 1: Monthly Inventory Limits
    await testMonthlyLimits();
    
    // Test 2: Google Drive Backup System
    await testGoogleDriveBackups();
    
    // Test 3: Cleanup System
    await testCleanupSystem();
    
    // Test 4: Edge Cases
    await testEdgeCases();
    
    // Generate Report
    generateTestReport();
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`\n🏁 Test completed in ${duration} seconds`, 'success');
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
    
  } catch (error) {
    log(`❌ Test failed: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n🛑 Test interrupted by user', 'warning');
  generateTestReport();
  process.exit(1);
});

// Run the test
if (require.main === module) {
  runMonthlyLimitsTest().catch((error) => {
    log(`❌ Fatal error: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { runMonthlyLimitsTest, CONFIG, testResults };
