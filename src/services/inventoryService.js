const googleSheets = require('./googleSheets');
const { ValidationError, GoogleSheetsError } = require('../middleware/errorHandler');

class InventoryService {
  constructor() {
    this.summarySheetName = 'MonthlySummary';
  }

  // Convert month number to readable name
  getMonthName(month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[parseInt(month) - 1] || 'Unknown';
  }

  // Format date for human readability
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Calculate session duration
  calculateSessionDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ${diffHours}h ${diffMinutes}m`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes} minutes`;
    }
  }

  // Check inventory session limits
  async checkInventoryLimits(agency, month, year) {
    try {
      console.log(`\n🔍 === CHECKING INVENTORY LIMITS ===`);
      console.log(`📋 Checking limits for: ${agency} - ${this.getMonthName(month)} ${year}`);
      
      // Ensure Monthly Summary sheet exists
      await googleSheets.ensureSheetExists(this.summarySheetName);
      
      const summaryData = await googleSheets.getSheetData(this.summarySheetName);
      
      // Filter for the specific agency and month/year
      const agencyInventories = summaryData.filter(row => {
        if (row.length < 3) return false;
        return row[2] === agency; // Agency column
      });
      
      // Count inventories for this month/year
      const currentMonthInventories = agencyInventories.filter(row => {
        return row[0] === this.getMonthName(month) && row[1] === year.toString();
      });
      
      // Count active inventories across all months for this agency
      const activeInventories = agencyInventories.filter(row => {
        return row[3] === 'Active'; // Status column
      });
      
      console.log(`📊 Current month inventories: ${currentMonthInventories.length}/2`);
      console.log(`📊 Active inventories: ${activeInventories.length}/1`);
      
      // Check monthly limit (2 per month)
      if (currentMonthInventories.length >= 2) {
        throw new ValidationError(`Monthly inventory limit reached for ${agency}. Maximum 2 inventories per month allowed.`);
      }
      
      // Check active inventory limit (1 at a time)
      if (activeInventories.length >= 1) {
        const activeInventory = activeInventories[0];
        throw new ValidationError(`Another inventory is already active for ${agency} (${activeInventory[0]} ${activeInventory[1]}). Only one inventory can be active at a time.`);
      }
      
      console.log(`✅ Inventory limits check passed`);
      return {
        canStart: true,
        currentMonthCount: currentMonthInventories.length,
        activeCount: activeInventories.length
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new GoogleSheetsError(`Failed to check inventory limits: ${error.message}`);
    }
  }

  // Save a barcode scan
  async saveScan(scanData) {
    try {
      console.log('\n🚀 === SAVE SCAN START ===');
      console.log(`📱 Scan Data:`, JSON.stringify(scanData, null, 2));
      
      // Validate input
      if (!scanData.agency || !scanData.code || !scanData.user) {
        throw new ValidationError('Missing required fields: agency, code, user');
      }

      // Extract month and year from timestamp if not provided
      let month, year;
      if (scanData.timestamp) {
        const timestamp = new Date(scanData.timestamp);
        month = (timestamp.getMonth() + 1).toString(); // getMonth() returns 0-11, so add 1
        year = timestamp.getFullYear().toString();
      } else if (scanData.month && scanData.year) {
        month = scanData.month.toString();
        year = scanData.year.toString();
      } else {
        // Fallback to current month/year
        const now = new Date();
        month = (now.getMonth() + 1).toString();
        year = now.getFullYear().toString();
      }

      console.log(`📅 Extracted month: ${month}, year: ${year} from timestamp: ${scanData.timestamp}`);

      // Check inventory session limits before proceeding
      console.log(`🔍 Checking inventory session limits...`);
      await this.checkInventoryLimits(scanData.agency, month, year);
      console.log(`✅ Inventory limits check passed`);

      // Ensure Monthly Summary sheet exists
      console.log(`📋 Ensuring MonthlySummary sheet exists...`);
      await googleSheets.ensureSheetExists(this.summarySheetName);
      console.log(`✅ MonthlySummary sheet ensured`);

      // Check if monthly inventory is already completed
      console.log(`🔍 Checking if monthly inventory is already completed...`);
      const existingSummary = await this.getMonthlySummary(scanData.agency, month, year);
      console.log(`📊 Existing summary found:`, existingSummary ? 'YES' : 'NO');
      if (existingSummary) {
        console.log(`   Status: ${existingSummary.status}`);
        console.log(`   Total Scans: ${existingSummary.totalScans}`);
        console.log(`   Session ID: ${existingSummary.sessionId}`);
      }
      
      if (existingSummary && existingSummary.status === 'Completed') {
        throw new ValidationError(`Monthly inventory for ${scanData.agency} - ${this.getMonthName(month)} ${scanData.year} is already completed`);
      }

      // Check for duplicate barcode in current month
      console.log(`🔍 Checking for duplicate barcode: ${scanData.code}`);
      const isDuplicate = await this.checkDuplicateBarcode(scanData.agency, month, year, scanData.code);
      console.log(`📊 Duplicate barcode found:`, isDuplicate ? 'YES' : 'NO');
      if (isDuplicate) {
        throw new ValidationError(`Barcode ${scanData.code} has already been scanned in ${scanData.agency} - ${this.getMonthName(month)} ${year} inventory`);
      }

      // Save scan to agency sheet (simple: Date, Barcode)
      const scanDate = new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      const values = [scanDate, scanData.code];
      
      console.log(`📱 Saving scan to agency sheet: ${scanData.agency}`);
      console.log(`   Values: [${values.join(', ')}]`);
      await googleSheets.appendRow(scanData.agency, values);
      console.log(`✅ Scan saved to agency sheet: ${scanData.code} for ${scanData.agency} on ${scanDate}`);

      // BEFORE: Check current state of MonthlySummary sheet
      console.log(`\n🔍 === BEFORE MONTHLY SUMMARY OPERATIONS ===`);
      const beforeData = await googleSheets.getSheetData(this.summarySheetName);
      console.log(`📊 MonthlySummary rows before operations: ${beforeData.length}`);
      beforeData.forEach((row, idx) => {
        if (idx === 0) {
          console.log(`   Row ${idx + 1} (Headers): [${row.join(', ')}]`);
        } else if (row.length >= 3) {
          const monthMatch = row[0] === this.getMonthName(month);
          const yearMatch = row[1] === year.toString();
          const agencyMatch = row[2] === scanData.agency;
          console.log(`   Row ${idx + 1}: [${row.join(', ')}]`);
          console.log(`     Month match: ${monthMatch}, Year match: ${yearMatch}, Agency match: ${agencyMatch}`);
        }
      });

      // VALIDATION: Ensure only one monthly summary exists
      console.log(`\n🔍 === VALIDATION STEP ===`);
      const validation = await this.validateSingleMonthlySummary(scanData.agency, month, year);
      console.log(`📊 Validation result:`, validation);
      
      if (!validation.valid) {
        console.log(`⚠️ Validation failed: ${validation.message}`);
        console.log(`🧹 Attempting to clean up duplicates...`);
        
        // Try to clean up duplicates
        const cleanupResult = await this.cleanupSpecificDuplicates(scanData.agency, month, year);
        console.log(`🧹 Cleanup result:`, cleanupResult);
        
        // Re-validate after cleanup
        const revalidation = await this.validateSingleMonthlySummary(scanData.agency, month, year);
        console.log(`📊 Re-validation result:`, revalidation);
        
        if (!revalidation.valid) {
          throw new GoogleSheetsError(`Failed to resolve duplicate rows for ${scanData.agency} - ${this.getMonthName(month)} ${year}. Please contact support.`);
        }
      }

      // Use atomic find-or-create approach to prevent duplicates
      console.log(`\n🔍 === FIND OR CREATE MONTHLY SUMMARY ===`);
      const summary = await this.findOrCreateMonthlySummary(scanData.agency, month, year, scanData.user, scanData.userName);
      console.log(`✅ Monthly summary result:`, {
        month: summary.month,
        year: summary.year,
        agency: summary.agency,
        status: summary.status,
        totalScans: summary.totalScans,
        sessionId: summary.sessionId
      });
      
      // AFTER: Check state of MonthlySummary sheet after findOrCreate
      console.log(`\n🔍 === AFTER FIND OR CREATE ===`);
      const afterFindCreate = await googleSheets.getSheetData(this.summarySheetName);
      console.log(`📊 MonthlySummary rows after findOrCreate: ${afterFindCreate.length}`);
      afterFindCreate.forEach((row, idx) => {
        if (idx === 0) {
          console.log(`   Row ${idx + 1} (Headers): [${row.join(', ')}]`);
        } else if (row.length >= 3) {
          const monthMatch = row[0] === this.getMonthName(month);
          const yearMatch = row[1] === year.toString();
          const agencyMatch = row[2] === scanData.agency;
          console.log(`   Row ${idx + 1}: [${row.join(', ')}]`);
          console.log(`     Month match: ${monthMatch}, Year match: ${yearMatch}, Agency match: ${agencyMatch}`);
        }
      });

      // Increment the scan count
      const newScanCount = summary.totalScans + 1;
      console.log(`\n📊 === INCREMENTING SCAN COUNT ===`);
      console.log(`📊 Incrementing scan count from ${summary.totalScans} to ${newScanCount}`);
      
      // Update the scan count in the summary - use the atomic update method
      console.log(`🔧 === UPDATING SCAN COUNT ===`);
      await this.updateMonthlySummaryScanCount(scanData.agency, month, year, newScanCount);
      console.log(`✅ Scan count updated successfully`);

      // FINAL: Check final state of MonthlySummary sheet
      console.log(`\n🔍 === FINAL STATE CHECK ===`);
      const finalData = await googleSheets.getSheetData(this.summarySheetName);
      console.log(`📊 MonthlySummary rows after all operations: ${finalData.length}`);
      finalData.forEach((row, idx) => {
        if (idx === 0) {
          console.log(`   Row ${idx + 1} (Headers): [${row.join(', ')}]`);
        } else if (row.length >= 3) {
          const monthMatch = row[0] === this.getMonthName(month);
          const yearMatch = row[1] === year.toString();
          const agencyMatch = row[2] === scanData.agency;
          console.log(`   Row ${idx + 1}: [${row.join(', ')}]`);
          console.log(`     Month match: ${monthMatch}, Year match: ${yearMatch}, Agency match: ${agencyMatch}`);
          if (monthMatch && yearMatch && agencyMatch) {
            console.log(`     ⭐ THIS IS OUR TARGET ROW`);
            console.log(`     Total Scans: ${row[7] || 'N/A'}`);
            console.log(`     Session ID: ${row[8] || 'N/A'}`);
          }
        }
      });

      // Count target rows
      const targetRows = finalData.filter((row, idx) => {
        if (idx === 0 || row.length < 3) return false;
        return row[0] === this.getMonthName(month) && 
               row[1] === year.toString() && 
               row[2] === scanData.agency;
      });
      
      console.log(`\n🎯 === DUPLICATE CHECK ===`);
      console.log(`📊 Target rows found for ${scanData.agency} - ${this.getMonthName(month)} ${year}: ${targetRows.length}`);
      
      if (targetRows.length > 1) {
        console.log(`⚠️ WARNING: MULTIPLE ROWS FOUND! This indicates a duplicate creation issue!`);
        targetRows.forEach((row, idx) => {
          console.log(`   Duplicate ${idx + 1}: [${row.join(', ')}]`);
        });
      } else if (targetRows.length === 1) {
        console.log(`✅ SUCCESS: Only one row found - no duplicates`);
      } else {
        console.log(`❌ ERROR: No target rows found - this shouldn't happen`);
      }

      console.log(`\n🏁 === SAVE SCAN COMPLETE ===\n`);

      return {
        success: true,
        message: 'Scan saved successfully',
        scanData: {
          agency: scanData.agency,
          month: this.getMonthName(month),
          year: year,
          barcode: scanData.code,
          date: scanDate
        },
        summary: {
          totalScans: newScanCount,
          status: summary.status
        }
      };
    } catch (error) {
      console.error(`\n💥 === SAVE SCAN ERROR ===`);
      console.error(`❌ Error in saveScan:`, error.message);
      console.error(`Stack trace:`, error.stack);
      console.error(`=== END ERROR ===\n`);
      
      if (error instanceof ValidationError || error instanceof GoogleSheetsError) {
        throw error;
      }
      throw new GoogleSheetsError(`Failed to save scan: ${error.message}`);
    }
  }

  // Finish monthly inventory session
  async finishSession(sessionData) {
    try {
      const { agency, month, year, user } = sessionData;

      if (!agency || !month || !year || !user) {
        throw new ValidationError('Missing required fields: agency, month, year, user');
      }

      // Ensure Monthly Summary sheet exists
      await googleSheets.ensureSheetExists(this.summarySheetName);

      // Get current monthly summary
      const summary = await this.getMonthlySummary(agency, month, year);
      if (!summary) {
        throw new ValidationError(`No monthly inventory found for ${agency} - ${this.getMonthName(month)} ${year}`);
      }

      if (summary.status === 'Completed') {
        throw new ValidationError(`Monthly inventory for ${agency} - ${this.getMonthName(month)} ${year} is already completed`);
      }

      // Get final scan count and last scan time from agency sheet
      const agencyData = await googleSheets.getSheetData(agency);
      const currentMonthScans = agencyData.filter(row => {
        if (row.length < 2) return false;
        const scanDate = new Date(row[0]);
        return scanDate.getMonth() === parseInt(month) - 1 && scanDate.getFullYear() === parseInt(year);
      });

      const totalScans = currentMonthScans.length;
      const lastScanTime = currentMonthScans.length > 0 ? currentMonthScans[currentMonthScans.length - 1][0] : null;

      console.log(`📊 Finishing session for ${agency} - ${this.getMonthName(month)} ${year}`);
      console.log(`   Total scans found: ${totalScans}`);
      console.log(`   Last scan time: ${lastScanTime}`);

      // Calculate session duration
      const sessionDuration = this.calculateSessionDuration(summary.createdAt, new Date().toISOString());

      // Calculate average scans per day
      const startDate = new Date(summary.createdAt);
      const endDate = new Date();
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const avgScansPerDay = daysDiff > 0 ? (totalScans / daysDiff).toFixed(1) : totalScans.toString();

      console.log(`   Session duration: ${sessionDuration}`);
      console.log(`   Average scans per day: ${avgScansPerDay}`);

      // Update monthly summary with completion data
      await this.updateMonthlySummaryStatus(
        agency, month, year, 'Completed', 
        new Date().toISOString(), 
        totalScans
      );

      // Clear agency sheet for next month (monthly reset)
      await googleSheets.clearSheet(agency);

      return {
        success: true,
        message: 'Monthly inventory completed successfully',
        summary: {
          agency,
          month: this.getMonthName(month),
          year,
          totalScans,
          completedAt: this.formatDate(new Date()),
          sessionDuration,
          avgScansPerDay
        }
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof GoogleSheetsError) {
        throw error;
      }
      throw new GoogleSheetsError(`Failed to finish session: ${error.message}`);
    }
  }

  // Get monthly inventory data
  async getMonthlyInventory(agency, month, year) {
    try {
      const data = await googleSheets.getSheetData(agency);
      
      // Filter scans for the specific month/year
      const monthScans = data.filter(row => {
        if (row.length < 2) return false;
        const scanDate = new Date(row[0]);
        return scanDate.getMonth() === parseInt(month) - 1 && scanDate.getFullYear() === parseInt(year);
      });

      return {
        agency,
        month: this.getMonthName(month),
        year,
        totalScans: monthScans.length,
        scans: monthScans.map(row => ({
          date: row[0],
          barcode: row[1]
        }))
      };
    } catch (error) {
      throw new GoogleSheetsError(`Failed to get monthly inventory: ${error.message}`);
    }
  }

  // Get all inventories for an agency
  async getAgencyInventories(agency) {
    try {
      // Ensure Monthly Summary sheet exists
      await googleSheets.ensureSheetExists(this.summarySheetName);
      
      const summaryData = await googleSheets.getSheetData(this.summarySheetName);
      
      // Filter for the specific agency
      const agencyInventories = summaryData.filter(row => {
        if (row.length < 3) return false;
        return row[2] === agency; // Agency column (3rd column)
      });

      return agencyInventories.map(row => ({
        month: row[0],           // Month (1st column)
        year: row[1],            // Year (2nd column)
        agency: row[2],          // Agency (3rd column)
        status: row[3],          // Status (4th column)
        createdAt: row[4],       // Created At (5th column)
        createdBy: row[5],       // Created By (6th column)
        userName: row[6],        // User Name (7th column)
        totalScans: row[7],      // Total Scans (8th column)
        sessionId: row[8],       // Session ID (9th column)
        completedAt: row[9]      // Completed At (10th column)
      }));
    } catch (error) {
      throw new GoogleSheetsError(`Failed to get agency inventories: ${error.message}`);
    }
  }

  // Check if monthly inventory exists and its status
  async checkMonthlyInventory(agency, month, year) {
    try {
      // Ensure Monthly Summary sheet exists
      await googleSheets.ensureSheetExists(this.summarySheetName);
      
      const summary = await this.getMonthlySummary(agency, month, year);
      
      if (!summary) {
        return {
          exists: false,
          status: 'Not Started',
          message: `No inventory found for ${agency} - ${this.getMonthName(month)} ${year}`
        };
      }

      return {
        exists: true,
        status: summary.status,
        totalScans: summary.totalScans,
        createdAt: summary.createdAt,
        completedAt: summary.completedAt,
        message: `Inventory ${summary.status.toLowerCase()} for ${agency} - ${this.getMonthName(month)} ${year}`
      };
    } catch (error) {
      throw new GoogleSheetsError(`Failed to check monthly inventory: ${error.message}`);
    }
  }

  // Get monthly summary for an agency/month/year
  async getMonthlySummary(agency, month, year) {
    try {
      const data = await googleSheets.getSheetData(this.summarySheetName);
      
      // Find the specific monthly summary
      const summary = data.find(row => {
        if (row.length < 3) return false;
        return row[0] === this.getMonthName(month) && 
               row[1] === year.toString() && 
               row[2] === agency;
      });

      if (!summary) return null;

      return {
        month: summary[0],           // Month (1st column)
        year: summary[1],            // Year (2nd column)
        agency: summary[2],          // Agency (3rd column)
        status: summary[3] || 'Active', // Status (4th column)
        createdAt: summary[4],       // Created At (5th column)
        createdBy: summary[5],       // Created By (6th column)
        userName: summary[6],        // User Name (7th column)
        totalScans: parseInt(summary[7]) || 0, // Total Scans (8th column)
        sessionId: summary[8],       // Session ID (9th column)
        completedAt: summary[9]      // Completed At (10th column)
      };
    } catch (error) {
      throw new GoogleSheetsError(`Failed to get monthly summary: ${error.message}`);
    }
  }

  // Update monthly summary scan count only
  async updateMonthlySummaryScanCount(agency, month, year, newScanCount) {
    try {
      console.log(`\n🔧 === UPDATE MONTHLY SUMMARY SCAN COUNT START ===`);
      console.log(`📋 Updating scan count for: ${agency} - ${this.getMonthName(month)} ${year}`);
      console.log(`📊 New scan count: ${newScanCount}`);
      
      const data = await googleSheets.getSheetData(this.summarySheetName);
      console.log(`📊 Current MonthlySummary data rows: ${data.length}`);
      
      // Find the row to update
      console.log(`🔍 Looking for row to update...`);
      const rowIndex = data.findIndex(row => {
        if (row.length < 3) return false;
        const monthMatch = row[0] === this.getMonthName(month);
        const yearMatch = row[1] === year.toString();
        const agencyMatch = row[2] === agency;
        
        console.log(`   Row [${row.join(', ')}]: monthMatch=${monthMatch}, yearMatch=${yearMatch}, agencyMatch=${agencyMatch}`);
        
        return monthMatch && yearMatch && agencyMatch;
      });

      console.log(`🔍 Row index found: ${rowIndex}`);

      if (rowIndex !== -1) {
        // Update only the scan count field (column 8)
        const existingRow = data[rowIndex];
        console.log(`📋 Existing row data: [${existingRow.join(', ')}]`);
        console.log(`📊 Current scan count: ${existingRow[7] || 'N/A'}`);
        
        const updatedRow = [...existingRow];
        updatedRow[7] = newScanCount.toString(); // Total Scans (8th column)
        console.log(`📋 Updated row data: [${updatedRow.join(', ')}]`);
        
        // Update the entire row
        console.log(`🔧 Updating row ${rowIndex + 1} in MonthlySummary sheet...`);
        await googleSheets.updateRow(this.summarySheetName, rowIndex + 1, updatedRow);
        
        console.log(`✅ Successfully updated scan count for ${agency} - ${this.getMonthName(month)} ${year}: ${newScanCount}`);
        console.log(`🏁 === UPDATE SCAN COUNT COMPLETE ===\n`);
      } else {
        console.log(`❌ Row not found for ${agency} - ${this.getMonthName(month)} ${year}`);
        console.log(`📊 Available rows:`, data.map((row, idx) => `${idx}: [${row.join(', ')}]`));
        console.log(`🏁 === UPDATE SCAN COUNT FAILED ===\n`);
        throw new GoogleSheetsError(`Monthly summary row not found for ${agency} - ${this.getMonthName(month)} ${year}`);
      }
    } catch (error) {
      console.error(`❌ Error updating monthly summary scan count:`, error);
      console.error(`🏁 === UPDATE SCAN COUNT ERROR ===\n`);
      throw new GoogleSheetsError(`Failed to update monthly summary scan count: ${error.message}`);
    }
  }

  // Find or create monthly summary (atomic operation)
  async findOrCreateMonthlySummary(agency, month, year, user, userName) {
    try {
      console.log(`\n🔍 === FIND OR CREATE MONTHLY SUMMARY START ===`);
      console.log(`📋 Looking for: ${agency} - ${this.getMonthName(month)} ${year}`);
      
      // First, try to find existing summary
      console.log(`🔍 Step 1: Checking for existing summary...`);
      const existingSummary = await this.getMonthlySummary(agency, month, year);
      
      if (existingSummary) {
        console.log(`✅ Found existing monthly summary for ${agency} - ${this.getMonthName(month)} ${year}`);
        console.log(`   Details:`, {
          month: existingSummary.month,
          year: existingSummary.year,
          agency: existingSummary.agency,
          status: existingSummary.status,
          totalScans: existingSummary.totalScans,
          sessionId: existingSummary.sessionId
        });
        console.log(`🏁 === FIND OR CREATE COMPLETE (EXISTING) ===\n`);
        return existingSummary;
      }
      
      // If no existing summary, create one
      console.log(`📝 Step 2: No existing summary found, creating new one...`);
      console.log(`   Agency: ${agency}`);
      console.log(`   Month: ${this.getMonthName(month)} (${month})`);
      console.log(`   Year: ${year}`);
      console.log(`   User: ${user}`);
      console.log(`   UserName: ${userName || user}`);
      
      const sessionId = `sess_${Date.now()}`;
      console.log(`   Generated Session ID: ${sessionId}`);
      
             const values = [
         this.getMonthName(month),           // Month
         year.toString(),                    // Year
         agency,                             // Agency
         'Active',                           // Status
         this.formatDate(new Date()),        // Created At
         user,                               // Created By
         userName || user,                   // User Name
         '0',                                // Total Scans ← Start with 0, not 1
         sessionId,                          // Session ID
         ''                                  // Completed At
       ];
      
      console.log(`   Values to append: [${values.join(', ')}]`);
      console.log(`   Appending row to MonthlySummary sheet...`);
      
      await googleSheets.appendRow(this.summarySheetName, values);
      console.log(`✅ Row appended to MonthlySummary sheet`);
      
      // Wait for Google Sheets to update and verify creation
      console.log(`⏳ Step 3: Waiting for Google Sheets to update and verifying creation...`);
      let retryCount = 0;
      const maxRetries = 3;
      let newSummary = null;
      
      while (retryCount < maxRetries && !newSummary) {
        const delay = 1000 * (retryCount + 1);
        console.log(`   ⏳ Retry ${retryCount + 1}/${maxRetries}: Waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Try to find the newly created summary
        console.log(`   🔍 Attempting to find newly created summary...`);
        newSummary = await this.getMonthlySummary(agency, month, year);
        
        if (!newSummary) {
          retryCount++;
          console.log(`   ❌ Summary not found yet, retry ${retryCount}/${maxRetries}`);
        } else {
          console.log(`   ✅ Summary found after retry ${retryCount + 1}!`);
        }
      }
      
      if (newSummary) {
        console.log(`✅ Successfully created monthly summary for ${agency} - ${this.getMonthName(month)} ${year}`);
        console.log(`   Final summary details:`, {
          month: newSummary.month,
          year: newSummary.year,
          agency: newSummary.agency,
          status: newSummary.status,
          totalScans: newSummary.totalScans,
          sessionId: newSummary.sessionId
        });
        console.log(`🏁 === FIND OR CREATE COMPLETE (NEW) ===\n`);
        return newSummary;
      } else {
        // If we still can't find it, there might be an issue
        console.error(`❌ Failed to create monthly summary after ${maxRetries} retries`);
        console.error(`   This suggests a serious issue with Google Sheets API or permissions`);
        throw new Error('Failed to create monthly summary - Google Sheets API may be experiencing delays');
      }
    } catch (error) {
      console.error(`❌ Error in findOrCreateMonthlySummary:`, error);
      console.error(`🏁 === FIND OR CREATE FAILED ===\n`);
      throw error;
    }
  }

  // Update monthly summary
  async updateMonthlySummary(agency, month, year, user, userName) {
    try {
      // Get fresh data from Google Sheets
      const data = await googleSheets.getSheetData(this.summarySheetName);
      
      console.log(`🔍 Looking for existing row: Month=${this.getMonthName(month)}, Year=${year}, Agency=${agency}`);
      console.log(`📊 Current data in MonthlySummary:`, data.map((row, idx) => `${idx}: [${row.join(', ')}]`));
      
      // Find existing row with same agency/month/year
      // Use a more robust comparison that handles incomplete data
      const existingRowIndex = data.findIndex(row => {
        if (row.length < 3) return false;
        
        // Check if this row matches the agency/month/year combination
        const monthMatch = row[0] === this.getMonthName(month);
        const yearMatch = row[1] === year.toString();
        const agencyMatch = row[2] === agency;
        
        console.log(`🔍 Row ${row.join(', ')}: monthMatch=${monthMatch}, yearMatch=${yearMatch}, agencyMatch=${agencyMatch}`);
        
        return monthMatch && yearMatch && agencyMatch;
      });
      
      console.log(`🔍 Found existing row at index: ${existingRowIndex}`);
      
      if (existingRowIndex === -1) {
        // Don't create new rows here - this method should only update existing ones
        // If no row exists, it should have been created by findOrCreateMonthlySummary
        console.log(`⚠️ No existing row found for ${agency} - ${this.getMonthName(month)} ${year}`);
        console.log(`   This method should not create new rows. Use findOrCreateMonthlySummary instead.`);
        throw new GoogleSheetsError(`No monthly summary found for ${agency} - ${this.getMonthName(month)} ${year}. Please create it first.`);
      }
      
      // Update existing summary - increment scan count
      const existingRow = data[existingRowIndex];
      
      // Get current scan count and increment it
      const currentScanCount = parseInt(existingRow[7]) || 0;
      const newScanCount = currentScanCount + 1;
      
      console.log(`📊 Updating existing row: current scans=${currentScanCount}, new scans=${newScanCount}`);
      
      // Ensure the existing row has all required fields and increment scan count
      const updatedRow = [
        existingRow[0] || this.getMonthName(month),           // Month
        existingRow[1] || year.toString(),                    // Year
        existingRow[2] || agency,                             // Agency
        'Active',                                             // Status (keep as Active during scanning)
        existingRow[4] || this.formatDate(new Date()),        // Created At
        existingRow[5] || user,                               // Created By
        existingRow[6] || userName || user,                   // User Name
        newScanCount.toString(),                              // Total Scans (increment)
        existingRow[8] || `sess_${Date.now()}`,               // Session ID
        existingRow[9] || ''                                  // Completed At
      ];
      
             // Update the entire row
       await googleSheets.updateRow(this.summarySheetName, existingRowIndex + 1, updatedRow);
      console.log(`✅ Updated monthly summary for ${agency} - ${this.getMonthName(month)} ${year}: Total Scans = ${newScanCount}`);
    } catch (error) {
      console.error(`❌ Error updating monthly summary:`, error);
      throw new GoogleSheetsError(`Failed to update monthly summary: ${error.message}`);
    }
  }

  // Update monthly summary status
  async updateMonthlySummaryStatus(agency, month, year, status, completedAt, totalScans) {
    try {
      const data = await googleSheets.getSheetData(this.summarySheetName);
      
      // Find the row to update
      const rowIndex = data.findIndex(row => {
        if (row.length < 3) return false;
        return row[0] === this.getMonthName(month) && 
               row[1] === year.toString() && 
               row[2] === agency;
      });

      if (rowIndex !== -1) {
        // Instead of updating individual cells, update the entire row
        const existingRow = data[rowIndex];
        const updatedRow = [...existingRow];
        
        // Update the specific fields
        updatedRow[3] = status;                    // Status (4th column)
        updatedRow[7] = totalScans.toString();     // Total Scans (8th column)
        updatedRow[9] = this.formatDate(completedAt); // Completed At (10th column)
        
        // Ensure all required fields are present
        for (let i = 0; i < updatedRow.length; i++) {
          if (updatedRow[i] === undefined || updatedRow[i] === null) {
            updatedRow[i] = '';
          }
        }
        
        // Update the entire row
        await googleSheets.updateRow(this.summarySheetName, rowIndex + 1, updatedRow);
        
        console.log(`✅ Successfully updated Monthly Summary for ${agency} - ${this.getMonthName(month)} ${year}`);
        console.log(`   Status: ${status}, Total Scans: ${totalScans}, Completed At: ${this.formatDate(completedAt)}`);
        console.log(`   Row ${rowIndex + 2} updated successfully`);
      } else {
        console.log(`❌ Row not found for ${agency} - ${this.getMonthName(month)} ${year}`);
        console.log(`   Available rows:`, data.map((row, idx) => `${idx + 1}: [${row.slice(0, 3).join(', ')}]`));
        throw new GoogleSheetsError(`Monthly summary row not found for ${agency} - ${this.getMonthName(month)} ${year}`);
      }
    } catch (error) {
      console.error(`❌ Error updating monthly summary status:`, error);
      throw new GoogleSheetsError(`Failed to update monthly summary status: ${error.message}`);
    }
  }

  // Validate that only one monthly summary exists for an agency/month/year
  async validateSingleMonthlySummary(agency, month, year) {
    try {
      console.log(`\n🔍 === VALIDATE SINGLE MONTHLY SUMMARY ===`);
      console.log(`📋 Checking for: ${agency} - ${this.getMonthName(month)} ${year}`);
      
      const data = await googleSheets.getSheetData(this.summarySheetName);
      console.log(`📊 Total MonthlySummary rows: ${data.length}`);
      
      // Find all rows for the specific agency/month/year combination
      const targetRows = data.filter((row, idx) => {
        if (idx === 0 || row.length < 3) return false;
        const monthMatch = row[0] === this.getMonthName(month);
        const yearMatch = row[1] === year.toString();
        const agencyMatch = row[2] === agency;
        
        if (monthMatch && yearMatch && agencyMatch) {
          console.log(`   Found target row ${idx + 1}: [${row.join(', ')}]`);
          return true;
        }
        return false;
      });
      
      console.log(`📊 Target rows found: ${targetRows.length}`);
      
      if (targetRows.length === 0) {
        console.log(`✅ No existing rows found - safe to create new one`);
        return { valid: true, message: 'No existing rows found', rows: [] };
      }
      
      if (targetRows.length === 1) {
        const row = targetRows[0];
        const status = row[3] || 'Active';
        console.log(`✅ Single row found with status: ${status}`);
        return { 
          valid: true, 
          message: 'Single row found', 
          rows: targetRows,
          status: status
        };
      }
      
      // Multiple rows found - this is a problem!
      console.log(`⚠️ MULTIPLE ROWS FOUND! This indicates a duplicate issue!`);
      console.log(`📋 Duplicate rows:`, targetRows.map((row, idx) => `Row ${idx + 1}: [${row.join(', ')}]`));
      
      // Check if any are completed
      const completedRows = targetRows.filter(row => (row[3] || 'Active') === 'Completed');
      const activeRows = targetRows.filter(row => (row[3] || 'Active') === 'Active');
      
      console.log(`📊 Completed rows: ${completedRows.length}, Active rows: ${activeRows.length}`);
      
      if (completedRows.length > 0) {
        console.log(`✅ Found completed row - this is valid`);
        return { 
          valid: true, 
          message: 'Found completed row', 
          rows: completedRows,
          status: 'Completed'
        };
      }
      
      // Multiple active rows - this needs cleanup
      console.log(`❌ Multiple active rows found - validation failed`);
      return { 
        valid: false, 
        message: 'Multiple active rows found', 
        rows: targetRows,
        status: 'Multiple Active'
      };
      
    } catch (error) {
      console.error(`❌ Error in validateSingleMonthlySummary:`, error);
      throw error;
    }
  }

  // Clean up duplicate rows in monthly summary
  async cleanupDuplicateRows() {
    try {
      const data = await googleSheets.getSheetData(this.summarySheetName);
      
      if (data.length <= 1) {
        console.log('📋 No data rows to clean up');
        return { cleaned: 0, message: 'No duplicates found' };
      }

      const headers = data[0];
      const dataRows = data.slice(1);
      
      // Group rows by agency/month/year combination
      const groupedRows = {};
      const duplicates = [];
      
      dataRows.forEach((row, index) => {
        if (row.length < 3) return;
        
        const key = `${row[0]}_${row[1]}_${row[2]}`; // Month_Year_Agency
        if (!groupedRows[key]) {
          groupedRows[key] = [];
        }
        groupedRows[key].push({ row, index: index + 2 }); // +2 because of 0-based index and header row
      });

      // Find duplicates and keep the one with highest scan count
      let cleanedCount = 0;
      for (const [key, rows] of Object.entries(groupedRows)) {
        if (rows.length > 1) {
          console.log(`🔍 Found ${rows.length} rows for key: ${key}`);
          
          // Sort by scan count (descending) and keep the first one
          rows.sort((a, b) => {
            const aScans = parseInt(a.row[7]) || 0;
            const bScans = parseInt(b.row[7]) || 0;
            return bScans - aScans;
          });
          
          // Keep the first row (highest scan count), delete the rest
          const rowsToDelete = rows.slice(1);
          console.log(`🗑️ Keeping row ${rows[0].index} with ${rows[0].row[7]} scans, deleting ${rowsToDelete.length} duplicates`);
          
          for (const duplicateRow of rowsToDelete) {
            try {
              // Delete the duplicate row by clearing it
              await googleSheets.clearRow(this.summarySheetName, duplicateRow.index);
              cleanedCount++;
              console.log(`✅ Deleted duplicate row ${duplicateRow.index}`);
            } catch (error) {
              console.error(`❌ Failed to delete row ${duplicateRow.index}:`, error);
            }
          }
        }
      }

      return {
        cleaned: cleanedCount,
        message: `Cleaned up ${cleanedCount} duplicate rows`
      };
    } catch (error) {
      console.error('❌ Error cleaning up duplicate rows:', error);
      throw new GoogleSheetsError(`Failed to cleanup duplicate rows: ${error.message}`);
    }
  }

  // Clean up specific duplicate rows for an agency/month/year combination
  async cleanupSpecificDuplicates(agency, month, year) {
    try {
      const data = await googleSheets.getSheetData(this.summarySheetName);
      
      if (data.length <= 1) {
        console.log('📋 No data rows to clean up');
        return { cleaned: 0, message: 'No duplicates found' };
      }

      const dataRows = data.slice(1);
      
      // Find all rows for the specific agency/month/year combination
      const targetRows = dataRows.filter((row, index) => {
        if (row.length < 3) return false;
        return row[0] === this.getMonthName(month) && 
               row[1] === year.toString() && 
               row[2] === agency;
      }).map((row, index) => ({ row, index: index + 2 }));

      if (targetRows.length <= 1) {
        console.log(`📋 No duplicates found for ${agency} - ${this.getMonthName(month)} ${year}`);
        return { cleaned: 0, message: 'No duplicates found' };
      }

      console.log(`🔍 Found ${targetRows.length} rows for ${agency} - ${this.getMonthName(month)} ${year}`);

      // Sort by scan count (descending) and keep the first one
      targetRows.sort((a, b) => {
        const aScans = parseInt(a.row[7]) || 0;
        const bScans = parseInt(b.row[7]) || 0;
        return bScans - aScans;
      });

      // Keep the first row (highest scan count), delete the rest
      const rowsToDelete = targetRows.slice(1);
      console.log(`🗑️ Keeping row ${targetRows[0].index} with ${targetRows[0].row[7]} scans, deleting ${rowsToDelete.length} duplicates`);

      let cleanedCount = 0;
      for (const duplicateRow of rowsToDelete) {
        try {
          // Delete the duplicate row by clearing it
          await googleSheets.clearRow(this.summarySheetName, duplicateRow.index);
          cleanedCount++;
          console.log(`✅ Deleted duplicate row ${duplicateRow.index}`);
        } catch (error) {
          console.error(`❌ Failed to delete row ${duplicateRow.index}:`, error);
        }
      }

      return {
        cleaned: cleanedCount,
        message: `Cleaned up ${cleanedCount} duplicate rows for ${agency} - ${this.getMonthName(month)} ${year}`
      };
    } catch (error) {
      console.error('❌ Error cleaning up specific duplicates:', error);
      throw new GoogleSheetsError(`Failed to cleanup specific duplicates: ${error.message}`);
    }
  }

  // Validate and repair monthly summary data structure
  async validateMonthlySummaryStructure() {
    try {
      const data = await googleSheets.getSheetData(this.summarySheetName);
      
      if (data.length === 0) {
        console.log('📋 Monthly Summary sheet is empty, no validation needed');
        return { valid: true, message: 'Sheet is empty' };
      }

      const headers = data[0];
      const expectedHeaders = [
        'Month', 'Year', 'Agency', 'Status', 'Created At', 'Created By', 
        'User Name', 'Total Scans', 'Session ID', 'Completed At'
      ];

      // Check if headers match expected structure
      const headerMatch = expectedHeaders.every((header, index) => 
        headers[index] === header
      );

      if (!headerMatch) {
        console.log('⚠️ Monthly Summary headers do not match expected structure');
        console.log('   Expected:', expectedHeaders);
        console.log('   Found:', headers);
        return { valid: false, message: 'Headers do not match expected structure' };
      }

      // Validate data rows
      let validRows = 0;
      let invalidRows = 0;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row.length >= 8 && row[0] && row[1] && row[2]) {
          validRows++;
        } else {
          invalidRows++;
          console.log(`⚠️ Invalid row ${i + 1}:`, row);
        }
      }

      console.log(`📊 Monthly Summary validation: ${validRows} valid rows, ${invalidRows} invalid rows`);
      
      return {
        valid: invalidRows === 0,
        message: `Validation complete: ${validRows} valid rows, ${invalidRows} invalid rows`,
        validRows,
        invalidRows
      };
    } catch (error) {
      console.error('❌ Error validating monthly summary structure:', error);
      throw new GoogleSheetsError(`Failed to validate monthly summary structure: ${error.message}`);
    }
  }

  // Get real-time scan count for monitoring progress
  async getScanCount(agency, month, year) {
    try {
      // Get current scan count from agency sheet
      const agencyData = await googleSheets.getSheetData(agency);
      const currentMonthScans = agencyData.filter(row => {
        if (row.length < 2) return false;
        const scanDate = new Date(row[0]);
        return scanDate.getMonth() === parseInt(month) - 1 && scanDate.getFullYear() === parseInt(year);
      });

      // Get monthly summary for status
      const summary = await this.getMonthlySummary(agency, month, year);
      
      return {
        agency,
        month: this.getMonthName(month),
        year,
        totalScans: currentMonthScans.length,
        status: summary ? summary.status : 'Not Started',
        lastScan: currentMonthScans.length > 0 ? currentMonthScans[currentMonthScans.length - 1][0] : null,
        isActive: summary ? summary.status === 'Active' : false
      };
    } catch (error) {
      throw new GoogleSheetsError(`Failed to get scan count: ${error.message}`);
    }
  }

  // Check for duplicate barcode in current month
  async checkDuplicateBarcode(agency, month, year, barcode) {
    try {
      const data = await googleSheets.getSheetData(agency);
      
      // Check for duplicate in current month/year
      const duplicate = data.find(row => {
        if (row.length < 2) return false;
        const scanDate = new Date(row[0]);
        return scanDate.getMonth() === parseInt(month) - 1 && 
               scanDate.getFullYear() === parseInt(year) && 
               row[1] === barcode;
      });

      return !!duplicate;
    } catch (error) {
      throw new GoogleSheetsError(`Failed to check duplicate barcode: ${error.message}`);
    }
  }

  // Get duplicate barcodes for a month
  async getDuplicateBarcodes(agency, month, year) {
    try {
      const data = await googleSheets.getSheetData(agency);
      
      // Group barcodes by count for current month/year
      const barcodeCounts = {};
      
      data.forEach(row => {
        if (row.length < 2) return;
        
        const scanDate = new Date(row[0]);
        if (scanDate.getMonth() === parseInt(month) - 1 && scanDate.getFullYear() === parseInt(year)) {
          const barcode = row[1];
          barcodeCounts[barcode] = (barcodeCounts[barcode] || 0) + 1;
        }
      });

      // Find duplicates (count > 1)
      const duplicates = Object.entries(barcodeCounts)
        .filter(([barcode, count]) => count > 1)
        .map(([barcode, count]) => ({
          barcode,
          count,
          message: `Barcode ${barcode} scanned ${count} times`
        }));

      return duplicates;
    } catch (error) {
      throw new GoogleSheetsError(`Failed to get duplicate barcodes: ${error.message}`);
    }
  }

  // Delete a specific scanned entry
  async deleteScannedEntry(agency, barcode) {
    try {
      console.log(`\n🗑️ === DELETE SCANNED ENTRY START ===`);
      console.log(`📋 Deleting entry: ${agency} - ${barcode}`);
      
      // Validate input
      if (!agency || !barcode) {
        throw new ValidationError('Missing required fields: agency, barcode');
      }

      // Get current data from agency sheet
      const data = await googleSheets.getSheetData(agency);
      
      // Find the row to delete (matching barcode)
      const rowIndex = data.findIndex(row => {
        if (row.length < 2) return false;
        return row[1] === barcode;
      });

      if (rowIndex === -1) {
        throw new ValidationError(`Scanned entry not found: ${barcode} for ${agency}`);
      }

      const deletedRow = data[rowIndex];
      const deletedDate = deletedRow[0];

      // Delete the row by clearing it
      await googleSheets.clearRow(agency, rowIndex + 1);
      console.log(`✅ Successfully deleted row ${rowIndex + 1} from ${agency} sheet`);

      // Find which month/year this entry belongs to for updating summary
      const scanDate = new Date(deletedDate);
      const month = (scanDate.getMonth() + 1).toString();
      const year = scanDate.getFullYear().toString();

      // Update the monthly summary scan count
      const summary = await this.getMonthlySummary(agency, month, year);
      if (summary) {
        const newScanCount = Math.max(0, summary.totalScans - 1);
        await this.updateMonthlySummaryScanCount(agency, month, year, newScanCount);
        console.log(`✅ Updated scan count from ${summary.totalScans} to ${newScanCount}`);
      }

      console.log(`🏁 === DELETE SCANNED ENTRY COMPLETE ===\n`);

      return {
        success: true,
        message: 'Scanned entry deleted successfully',
        deletedEntry: {
          agency,
          barcode,
          date: deletedDate,
          month: this.getMonthName(month),
          year
        }
      };
    } catch (error) {
      console.error(`❌ Error deleting scanned entry:`, error);
      if (error instanceof ValidationError || error instanceof GoogleSheetsError) {
        throw error;
      }
      throw new GoogleSheetsError(`Failed to delete scanned entry: ${error.message}`);
    }
  }

  // Get inventory data for download
  async getInventoryDataForDownload(agency, month, year) {
    try {
      console.log(`\n📊 === GET INVENTORY DATA FOR DOWNLOAD ===`);
      console.log(`📋 Getting data for: ${agency} - ${this.getMonthName(month)} ${year}`);
      
      // Get monthly summary
      const summary = await this.getMonthlySummary(agency, month, year);
      if (!summary) {
        throw new ValidationError(`No inventory found for ${agency} - ${this.getMonthName(month)} ${year}`);
      }

      // Get all scanned data from agency sheet
      const data = await googleSheets.getSheetData(agency);
      
      // Filter scans for the specific month/year
      const monthScans = data.filter(row => {
        if (row.length < 2) return false;
        const scanDate = new Date(row[0]);
        return scanDate.getMonth() === parseInt(month) - 1 && scanDate.getFullYear() === parseInt(year);
      });

      console.log(`📊 Found ${monthScans.length} scans for download`);

      return {
        agency,
        month: this.getMonthName(month),
        year,
        totalScans: monthScans.length,
        status: summary.status,
        createdAt: summary.createdAt,
        completedAt: summary.completedAt,
        scans: monthScans.map(row => ({
          date: row[0],
          barcode: row[1]
        }))
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof GoogleSheetsError) {
        throw error;
      }
      throw new GoogleSheetsError(`Failed to get inventory data for download: ${error.message}`);
    }
  }
}

module.exports = new InventoryService();
