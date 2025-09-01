const inventoryService = require('./src/services/inventoryService');

async function testSingleScan() {
  console.log('🧪 Testing Single Scan with Detailed Logging...\n');

  try {
    // Test parameters - change these to match your test case
    const testAgency = 'Suzuki';  // Change this to your agency
    const testMonth = '8';        // August
    const testYear = '2025';      // 2025
    const testUser = 'tonyidol69@gmail.com';
    const testUserName = 'tonyidol69@gmail.com';
    const testBarcode = `TEST_${Date.now()}`; // Unique barcode

    console.log(`📋 Test Parameters:`);
    console.log(`   Agency: ${testAgency}`);
    console.log(`   Month: ${testMonth} (${inventoryService.getMonthName(testMonth)})`);
    console.log(`   Year: ${testYear}`);
    console.log(`   User: ${testUser}`);
    console.log(`   Barcode: ${testBarcode}\n`);

    // Step 1: Validate current state
    console.log('🔍 Step 1: Validating current monthly summary state...');
    const validation = await inventoryService.validateSingleMonthlySummary(testAgency, testMonth, testYear);
    console.log(`📊 Validation result:`, validation);
    console.log('');

    // Step 2: Add scan
    console.log('📱 Step 2: Adding scan...');
    const scanData = {
      agency: testAgency,
      month: testMonth,
      year: testYear,
      code: testBarcode,
      user: testUser,
      userName: testUserName
    };

    const result = await inventoryService.saveScan(scanData);
    console.log(`✅ Scan result: ${result.message}`);
    console.log(`📊 Total scans: ${result.summary.totalScans}`);

    // Step 3: Final validation
    console.log('\n🔍 Step 3: Final validation...');
    const finalValidation = await inventoryService.validateSingleMonthlySummary(testAgency, testMonth, testYear);
    console.log(`📊 Final validation result:`, finalValidation);

    console.log('\n🎯 Test completed successfully!');
    console.log('📝 Check the console logs above for detailed information about what happened during the scan.');

  } catch (error) {
    console.error('\n💥 Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testSingleScan()
    .then(() => {
      console.log('\n🏁 Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testSingleScan };
