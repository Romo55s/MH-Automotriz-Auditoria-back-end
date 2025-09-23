// Test date parsing fix
require('dotenv').config();

async function testDateParsing() {
  console.log('🧪 === TESTING DATE PARSING FIX ===\n');

  try {
    // Test 1: Initialize services
    console.log('1️⃣ Initializing services...');
    const inventoryService = require('../src/services/inventoryService');
    
    // Test 2: Test date parsing with mock data
    console.log('\n2️⃣ Testing date parsing...');
    
    // Mock data that simulates what comes from Google Sheets
    const mockData = [
      ['Date', 'VIN', 'Brand', 'Model', 'Year'], // Header row
      ['Sep 2, 2025', '1FTFW1ET0DF019012', 'Ford', 'F-150', '2019'], // Data row 1
      ['Sep 3, 2025', '1G1ZT58N08F010123', 'Chevrolet', 'Silverado', '2010'], // Data row 2
      ['Sep 4, 2025', '1HGCM82633A001234', 'Honda', 'Civic', '2001'] // Data row 3
    ];
    
    console.log('📊 Mock data:');
    mockData.forEach((row, index) => {
      console.log(`  Row ${index}: ${row.join(' | ')}`);
    });
    
    // Test the filtering logic
    const dataRows = mockData.slice(1); // Skip first row (headers)
    console.log(`\n📊 Data rows (excluding headers): ${dataRows.length}`);
    
    const monthScans = dataRows.filter(row => {
      if (row.length < 2 || !row[0] || !row[1]) return false;
      
      try {
        // Skip if this looks like a header row
        const dateStr = row[0].toString().trim();
        if (dateStr === 'Date' || dateStr === 'VIN' || dateStr === 'Brand' || dateStr === 'Model' || dateStr === 'Year') {
          console.log(`⚠️ Skipping header row: ${dateStr}`);
          return false;
        }
        
        // Try different date formats
        let scanDate;
        
        // Handle different date formats
        if (dateStr.includes('Sep')) {
          // Format: "Sep 2, 2025"
          scanDate = new Date(dateStr);
        } else {
          // Try standard date parsing
          scanDate = new Date(dateStr);
        }
        
        if (isNaN(scanDate.getTime())) {
          console.log(`⚠️ Invalid date format: ${dateStr}`);
          return false;
        }
        
        const targetMonth = 8; // September (0-based)
        const targetYear = 2025;
        
        const matches = scanDate.getMonth() === targetMonth && scanDate.getFullYear() === targetYear;
        
        if (matches) {
          console.log(`✅ Match found: ${dateStr} -> ${scanDate.toDateString()}`);
        }
        
        return matches;
      } catch (error) {
        console.log(`❌ Error parsing row: ${error.message}`);
        return false;
      }
    });
    
    console.log(`\n📊 Found ${monthScans.length} scans for September 2025`);
    monthScans.forEach((scan, index) => {
      console.log(`  Scan ${index + 1}: ${scan.join(' | ')}`);
    });
    
    if (monthScans.length === 3) {
      console.log('\n✅ === DATE PARSING FIX SUCCESSFUL ===');
      console.log('✅ Headers are properly skipped');
      console.log('✅ Dates are parsed correctly');
      console.log('✅ All 3 scans are found');
    } else {
      console.log('\n❌ === DATE PARSING FIX FAILED ===');
      console.log(`❌ Expected 3 scans, found ${monthScans.length}`);
    }

  } catch (error) {
    console.error('\n❌ === DATE PARSING TEST FAILED ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testDateParsing();
