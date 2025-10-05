#!/usr/bin/env node

/**
 * Minimal Quota Test
 * 
 * This script tests the system with minimal API calls to avoid quota issues:
 * - 1 agency only
 * - 1 inventory only  
 * - 3 scans per inventory
 * - 2-second delays between operations
 */

const axios = require('axios');

// Minimal configuration to avoid quota limits
const CONFIG = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
  testAgency: 'Suzuki',
  testMonth: 10,
  testYear: 2025,
  maxScans: 3,
  delayBetweenScans: 2000, // 2 seconds
  delayBetweenOperations: 3000 // 3 seconds
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

function generateBarcode(agency, month, year, scan) {
  const agencyCode = agency.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  return `${agencyCode}${year}${month.toString().padStart(2, '0')}001${scan.toString().padStart(2, '0')}`;
}

async function runMinimalTest() {
  log('🚀 Starting Minimal Quota Test...', 'progress');
  log(`Configuration: 1 agency, 1 inventory, ${CONFIG.maxScans} scans, ${CONFIG.delayBetweenScans}ms delays`, 'info');
  
  const startTime = Date.now();
  let successfulScans = 0;
  let errors = 0;
  
  try {
    // Test 1: Health check
    log('🔍 Testing server health...', 'progress');
    const healthResponse = await axios.get(`${CONFIG.apiBaseUrl}/health`);
    if (healthResponse.status === 200) {
      log('✅ Server is healthy', 'success');
    } else {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    
    await sleep(CONFIG.delayBetweenOperations);
    
    // Test 2: Create minimal inventory
    log(`📦 Creating minimal inventory for ${CONFIG.testAgency}...`, 'progress');
    
    for (let scanNum = 1; scanNum <= CONFIG.maxScans; scanNum++) {
      const barcode = generateBarcode(CONFIG.testAgency, CONFIG.testMonth, CONFIG.testYear, scanNum);
      
      try {
        log(`  📱 Adding scan ${scanNum}/${CONFIG.maxScans}: ${barcode}`, 'info');
        
        const scanResponse = await axios.post(`${CONFIG.apiBaseUrl}/api/inventory/save-scan`, {
          agency: CONFIG.testAgency,
          month: CONFIG.testMonth.toString(),
          year: CONFIG.testYear.toString(),
          code: barcode,
          user: 'minimal_test_user',
          userName: 'Minimal Test User',
          carData: {
            marca: `Test Brand ${scanNum}`,
            color: `Test Color ${scanNum}`,
            ubicaciones: `Test Location ${scanNum}`,
            modelo: `Test Model ${scanNum}`,
            año: 2020 + (scanNum % 3),
            precio: 50000 + (scanNum * 1000)
          }
        }, {
          timeout: 30000
        });
        
        if (scanResponse.status === 200) {
          successfulScans++;
          log(`    ✅ Scan ${scanNum} added successfully`, 'success');
        } else {
          throw new Error(`Scan failed with status ${scanResponse.status}`);
        }
        
        if (scanNum < CONFIG.maxScans) {
          await sleep(CONFIG.delayBetweenScans);
        }
        
      } catch (error) {
        errors++;
        log(`    ❌ Scan ${scanNum} failed: ${error.message}`, 'error');
        
        // If it's a quota error, stop the test
        if (error.message.includes('Quota exceeded') || error.message.includes('quota')) {
          log(`    ⏱️ Quota limit hit, stopping test`, 'warning');
          break;
        }
      }
    }
    
    await sleep(CONFIG.delayBetweenOperations);
    
    // Test 3: Complete inventory
    log('🏁 Completing inventory...', 'progress');
    
    try {
      const completeResponse = await axios.post(`${CONFIG.apiBaseUrl}/api/inventory/finish-session`, {
        agency: CONFIG.testAgency,
        month: CONFIG.testMonth.toString(),
        year: CONFIG.testYear.toString(),
        user: 'minimal_test_user'
      }, {
        timeout: 30000
      });
      
      if (completeResponse.status === 200) {
        log('✅ Inventory completed successfully', 'success');
      } else {
        log(`⚠️ Inventory completion returned status ${completeResponse.status}`, 'warning');
      }
      
    } catch (error) {
      if (error.message.includes('Quota exceeded')) {
        log('⏱️ Inventory completion hit quota limit', 'warning');
      } else {
        log(`❌ Inventory completion failed: ${error.message}`, 'error');
        errors++;
      }
    }
    
    await sleep(CONFIG.delayBetweenOperations);
    
    // Test 4: Test backup creation
    log('☁️ Testing backup creation...', 'progress');
    
    try {
      const backupResponse = await axios.get(
        `${CONFIG.apiBaseUrl}/api/inventory/inventory-data/${encodeURIComponent(CONFIG.testAgency)}/${CONFIG.testMonth}/${CONFIG.testYear}`,
        { timeout: 30000 }
      );
      
      if (backupResponse.status === 200) {
        log('✅ Backup creation successful', 'success');
      } else {
        log(`⚠️ Backup creation returned status ${backupResponse.status}`, 'warning');
      }
      
    } catch (error) {
      if (error.message.includes('Quota exceeded')) {
        log('⏱️ Backup creation hit quota limit', 'warning');
      } else {
        log(`❌ Backup creation failed: ${error.message}`, 'error');
        errors++;
      }
    }
    
    // Generate report
    const duration = Math.round((Date.now() - startTime) / 1000);
    const successRate = ((successfulScans / CONFIG.maxScans) * 100).toFixed(2);
    
    log('\n📊 === MINIMAL QUOTA TEST REPORT ===', 'progress');
    console.log(`\n🎯 TEST RESULTS:`);
    console.log(`   Duration: ${duration} seconds`);
    console.log(`   Scans Attempted: ${CONFIG.maxScans}`);
    console.log(`   Scans Successful: ${successfulScans}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Success Rate: ${successRate}%`);
    
    if (successRate >= 80) {
      console.log('\n🎉 SUCCESS: System is working within quota limits!');
    } else if (successRate >= 50) {
      console.log('\n⚠️ PARTIAL: Some quota issues detected');
    } else {
      console.log('\n❌ FAILED: Significant quota issues detected');
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (errors === 0) {
      console.log('   ✅ System is stable - you can increase test frequency');
      console.log('   ✅ Consider running larger tests');
    } else {
      console.log('   ⚠️ Quota limits are still being hit');
      console.log('   ⚠️ Increase delays between operations');
      console.log('   ⚠️ Request quota increase from Google');
    }
    
    log('\n🏁 Minimal quota test completed', 'success');
    
  } catch (error) {
    log(`❌ Test failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runMinimalTest().catch((error) => {
    log(`❌ Fatal error: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { runMinimalTest, CONFIG };
