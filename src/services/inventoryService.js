const googleSheets = require('./googleSheets');
const { ValidationError, GoogleSheetsError } = require('../middleware/errorHandler');
const { v4: uuidv4 } = require('uuid');

class InventoryService {
  constructor() {
    this.summarySheetName = 'MonthlySummary';
    
    // Available locations (agencies + bodegas)
    this.locations = {
      // Agencies
      'suzuki': { name: 'Suzuki', type: 'agency', googleSheetId: 'your-suzuki-sheet-id' },
      'alfa-romeo': { name: 'Alfa Romeo', type: 'agency', googleSheetId: 'Alfa Romeo' },
      'renault': { name: 'Renault', type: 'agency', googleSheetId: 'Renault' },
      'jac': { name: 'Jac', type: 'agency', googleSheetId: 'Jac' },
      'car4u': { name: 'Car4u', type: 'agency', googleSheetId: 'Car4u' },
      'audi': { name: 'Audi', type: 'agency', googleSheetId: 'audi' },
      'stellantis': { name: 'Stellantis', type: 'agency', googleSheetId: 'Stellantis' },
      
      // Bodegas
      'bodega-coyote': { name: 'Bodega Coyote', type: 'bodega', googleSheetId: 'Bodega Coyote' },
      'bodega-goyo': { name: 'Bodega Goyo', type: 'bodega', googleSheetId: 'Bodega Goyo' }
    };
  }

  // Get available locations
  getAvailableLocations() {
    return Object.keys(this.locations).map(key => ({
      id: key,
      name: this.locations[key].name,
      type: this.locations[key].type,
      googleSheetId: this.locations[key].googleSheetId
    }));
  }

  // Validate location name
  validateLocation(locationId) {
    return this.locations.hasOwnProperty(locationId.toLowerCase());
  }

  // Get location info
  getLocationInfo(locationId) {
    return this.locations[locationId.toLowerCase()] || null;
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
      // Ensure Monthly Summary sheet exists
      await googleSheets.ensureSheetExists(this.summarySheetName);
      
      // Get all inventories for this agency/month/year using the new function
      const currentMonthInventories = await this.getAllMonthlyInventories(agency, month, year);
      
      // Count active inventories for this specific month/year
      const activeInventoriesThisMonth = currentMonthInventories.filter(inv => {
        return inv.status === 'Active';
      });
      
      // FIRST: Check if there's already an active inventory for this specific month/year
      // If there is, allow adding scans to it (multiple users can scan to same inventory)
      if (activeInventoriesThisMonth.length >= 1) {
        return {
          canStart: true,
          currentMonthCount: currentMonthInventories.length,
          activeCount: activeInventoriesThisMonth.length,
          message: 'Adding scans to existing active inventory'
        };
      }
      
      // SECOND: Check monthly limit (2 per month) - only if no active inventory exists
      if (currentMonthInventories.length >= 2) {
        throw new ValidationError(`Monthly inventory limit reached for ${agency}. Maximum 2 inventories per month allowed.`);
      }
      
      return {
        canStart: true,
        currentMonthCount: currentMonthInventories.length,
        activeCount: activeInventoriesThisMonth.length
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

      // Check inventory session limits before proceeding
      await this.checkInventoryLimits(scanData.agency, month, year);

      // Ensure Monthly Summary sheet exists
      await googleSheets.ensureSheetExists(this.summarySheetName);

      // Check inventory limits and existing inventories
      const existingSummary = await this.getMonthlySummary(scanData.agency, month, year);
      
      // Check inventory limits (2 per month, 1 active at a time)
      const limitsCheck = await this.checkInventoryLimits(scanData.agency, month, year);
      
      // If there's an active inventory, we can add scans to it
      if (existingSummary && existingSummary.status === 'Completed') {
        // The checkInventoryLimits function will handle the logic for starting a new inventory
        if (!limitsCheck.canStart) {
          throw new ValidationError(`Cannot start new inventory: ${limitsCheck.message || 'Monthly limit reached'}`);
        }
      }

      // Check for duplicate barcode in current month
      const isDuplicate = await this.checkDuplicateBarcode(scanData.agency, month, year, scanData.code);
      if (isDuplicate) {
        throw new ValidationError(`Barcode ${scanData.code} has already been scanned in ${scanData.agency} - ${this.getMonthName(month)} ${year} inventory`);
      }

      // Save scan to location sheet (enhanced: Date, Identifier, User, Serie, Marca, Color, Ubicaciones)
      const scanDate = new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      // Build values array with car data if available
      const values = [
        scanDate,                                    // Date
        scanData.code,                               // Identifier (serie or barcode)
        scanData.user,                               // Scanned By
        scanData.carData?.serie || '',               // Serie
        scanData.carData?.marca || '',               // Marca
        scanData.carData?.color || '',               // Color
        scanData.carData?.ubicaciones || ''          // Ubicaciones
      ];
      
      await googleSheets.appendRow(scanData.agency, values);

      // VALIDATION: Ensure only one monthly summary exists
      const validation = await this.validateSingleMonthlySummary(scanData.agency, month, year);
      
      if (!validation.valid) {
        // Try to clean up duplicates
        const cleanupResult = await this.cleanupSpecificDuplicates(scanData.agency, month, year);
        
        // Re-validate after cleanup
        const revalidation = await this.validateSingleMonthlySummary(scanData.agency, month, year);
        
        if (!revalidation.valid) {
          throw new GoogleSheetsError(`Failed to resolve duplicate rows for ${scanData.agency} - ${this.getMonthName(month)} ${year}. Please contact support.`);
        }
      }

      // Use atomic find-or-create approach to prevent duplicates
      const summary = await this.findOrCreateMonthlySummary(scanData.agency, month, year, scanData.user, scanData.userName);
      
      // Check state after findOrCreate

      // Increment the scan count
      const newScanCount = summary.totalScans + 1;
      
      // Update the scan count in the summary - use the atomic update method
      await this.updateMonthlySummaryScanCount(scanData.agency, month, year, newScanCount, summary.inventoryId);

      // Validate final state to prevent duplicates
      const finalData = await googleSheets.getSheetData(this.summarySheetName);
      const targetRows = finalData.filter((row, idx) => {
        if (idx === 0 || row.length < 3) return false;
        return row[0] === this.getMonthName(month) && 
               row[1] === year.toString() && 
               row[2] === scanData.agency;
      });
      
      if (targetRows.length > 1) {
        console.error(`⚠️ WARNING: Multiple rows found for ${scanData.agency} - ${this.getMonthName(month)} ${year}`);
      }

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
      console.error(`❌ Error in saveScan:`, error.message);
      
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
        totalScans,
        summary.inventoryId,
        user
      );

      // Create automatic backup to Google Drive when finishing session (only if there's data)
      if (totalScans > 0) {
        console.log(`📁 Creating automatic backup for completed session with ${totalScans} scans...`);
        try {
          const fileStorageService = require('./fileStorageService');
          const backupResult = await fileStorageService.storeInventoryFile(agency, month, year, 'csv', summary.inventoryId);
          console.log(`✅ Automatic backup created: ${backupResult.filename}`);
          
          // Clear agency sheet data after successful backup
          await this.clearAgencyDataAfterDownload(agency, month, year, summary.inventoryId);
          console.log(`🧹 Agency sheet cleared after backup`);
        } catch (backupError) {
          console.error(`❌ Automatic backup failed:`, backupError.message);
          console.log(`📋 Agency sheet preserved for manual download (backup failed)`);
        }
      } else {
        console.log(`⚠️ No scans found (${totalScans} scans) - skipping backup creation`);
        console.log(`📋 Agency sheet preserved (no data to backup)`);
      }

      return {
        success: true,
        message: 'Monthly inventory completed successfully',
        summary: {
          agency,
          month: this.getMonthName(month),
          year,
          totalScans,
          completedAt: new Date().toISOString(),
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
          identifier: row[1], // Can be barcode or serie
          scannedBy: row[2] || '',
          // Enhanced car data from new format
          serie: row[3] || '',
          marca: row[4] || '',
          color: row[5] || '',
          ubicaciones: row[6] || '',
          // Legacy compatibility
          barcode: row[1] // Keep for backward compatibility
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
        inventoryId: row[8],     // Inventory ID (9th column)
        completedAt: row[9]      // Completed At (10th column)
      }));
    } catch (error) {
      throw new GoogleSheetsError(`Failed to get agency inventories: ${error.message}`);
    }
  }

  // Check if monthly inventory exists and its status (supports multiple inventories per month)
  async checkMonthlyInventory(agency, month, year) {
    try {
      console.log(`\n🔍 === CHECK MONTHLY INVENTORY ===`);
      console.log(`📋 Checking: ${agency} - ${this.getMonthName(month)} ${year}`);
      
      // Ensure Monthly Summary sheet exists
      await googleSheets.ensureSheetExists(this.summarySheetName);
      
      // Get all inventories for this agency/month/year
      const inventories = await this.getAllMonthlyInventories(agency, month, year);
      
      if (inventories.length === 0) {
        return {
          exists: false,
          status: 'Not Started',
          totalInventories: 0,
          activeInventories: 0,
          completedInventories: 0,
          message: `No inventory found for ${agency} - ${this.getMonthName(month)} ${year}`
        };
      }

      // Count by status
      const activeInventories = inventories.filter(inv => inv.status === 'Active');
      const completedInventories = inventories.filter(inv => inv.status === 'Completed');
      
      // Get the most recent inventory (last one in the list)
      const latestInventory = inventories[inventories.length - 1];
      
      console.log(`📊 Found ${inventories.length} inventories:`, {
        active: activeInventories.length,
        completed: completedInventories.length,
        latest: latestInventory.status
      });

      return {
        exists: true,
        status: latestInventory.status,
        totalScans: latestInventory.totalScans,
        createdAt: latestInventory.createdAt,
        completedAt: latestInventory.completedAt,
        totalInventories: inventories.length,
        activeInventories: activeInventories.length,
        completedInventories: completedInventories.length,
        inventories: inventories, // Include all inventories for detailed view
        message: `Found ${inventories.length} inventory(ies) for ${agency} - ${this.getMonthName(month)} ${year}. Latest: ${latestInventory.status.toLowerCase()}`
      };
    } catch (error) {
      console.error(`❌ Error checking monthly inventory:`, error);
      throw new GoogleSheetsError(`Failed to check monthly inventory: ${error.message}`);
    }
  }

  // Get all monthly inventories for an agency/month/year (supports multiple inventories per month)
  async getAllMonthlyInventories(agency, month, year) {
    try {
      const data = await googleSheets.getSheetData(this.summarySheetName);
      
      // Find all monthly summaries for this agency/month/year
      const summaries = data.filter(row => {
        if (row.length < 3) return false;
        return row[0] === this.getMonthName(month) && 
               row[1] === year.toString() && 
               row[2] === agency;
      });

      if (summaries.length === 0) return [];

      return summaries.map(summary => ({
        month: summary[0],           // Month (1st column)
        year: summary[1],            // Year (2nd column)
        agency: summary[2],          // Agency (3rd column)
        status: summary[3] || 'Active', // Status (4th column)
        createdAt: summary[4],       // Created At (5th column)
        createdBy: summary[5],       // Created By (6th column)
        userName: summary[6],        // User Name (7th column)
        totalScans: parseInt(summary[7]) || 0, // Total Scans (8th column)
        inventoryId: summary[8],     // Inventory ID (9th column)
        completedAt: summary[9],     // Completed At (10th column)
        finishedBy: summary[10] || '' // Finished By (11th column)
      }));
    } catch (error) {
      throw new GoogleSheetsError(`Failed to get all monthly inventories: ${error.message}`);
    }
  }

  // Get monthly summary for an agency/month/year (returns the most recent one for backward compatibility)
  async getMonthlySummary(agency, month, year) {
    try {
      const inventories = await this.getAllMonthlyInventories(agency, month, year);
      
      if (inventories.length === 0) return null;
      
      // Return the active inventory if it exists, otherwise the most recent one
      const activeInventory = inventories.find(inv => inv.status === 'Active');
      if (activeInventory) {
        return activeInventory;
      }
      
      // If no active inventory, return the most recent one
      return inventories[inventories.length - 1];
    } catch (error) {
      throw new GoogleSheetsError(`Failed to get monthly summary: ${error.message}`);
    }
  }

  // Update monthly summary scan count only
  async updateMonthlySummaryScanCount(agency, month, year, newScanCount, inventoryId = null) {
    try {
      
      const data = await googleSheets.getSheetData(this.summarySheetName);
      
      // Find the row to update
      const rowIndex = data.findIndex(row => {
        if (row.length < 3) return false;
        const monthMatch = row[0] === this.getMonthName(month);
        const yearMatch = row[1] === year.toString();
        const agencyMatch = row[2] === agency;
        
        // If inventoryId is provided, also match the session ID (column 8)
        const inventoryMatch = inventoryId ? row[8] === inventoryId : true;
        
        
        return monthMatch && yearMatch && agencyMatch && inventoryMatch;
      });

      if (rowIndex !== -1) {
        // Update only the scan count field (column 8)
        const existingRow = data[rowIndex];
        const updatedRow = [...existingRow];
        updatedRow[7] = newScanCount.toString(); // Total Scans (8th column)
        
        // Update the entire row
        await googleSheets.updateRow(this.summarySheetName, rowIndex + 1, updatedRow);
      } else {
        throw new GoogleSheetsError(`Monthly summary row not found for ${agency} - ${this.getMonthName(month)} ${year}`);
      }
    } catch (error) {
      console.error(`❌ Error updating monthly summary scan count:`, error);
      throw new GoogleSheetsError(`Failed to update monthly summary scan count: ${error.message}`);
    }
  }

  // Find or create monthly summary (atomic operation)
  async findOrCreateMonthlySummary(agency, month, year, user, userName) {
    try {
      // First, check all existing inventories for this agency/month/year
      const allInventories = await this.getAllMonthlyInventories(agency, month, year);
      
      if (allInventories.length > 0) {
        
        // Look for an active inventory first
        const activeInventory = allInventories.find(inv => inv.status === 'Active');
        
        if (activeInventory) {
          return activeInventory;
        } else {
          if (allInventories.length >= 2) {
            throw new ValidationError(`Monthly inventory limit reached for ${agency}. Maximum 2 inventories per month allowed.`);
          }
          // Continue to create new inventory below
        }
      } else {
        // Continue to create new inventory below
      }
      
      // Create new inventory (either first inventory or additional inventory)
      console.log(`📝 Step 2: Creating new inventory...`);
      console.log(`   Agency: ${agency}`);
      console.log(`   Month: ${this.getMonthName(month)} (${month})`);
      console.log(`   Year: ${year}`);
      console.log(`   User: ${user}`);
      console.log(`   UserName: ${userName || user}`);
      
      // Note: We do NOT clear the agency sheet when creating a new inventory
      // This preserves data from previous inventories for download purposes
      // The agency sheet will accumulate data from all inventories in the same month
      console.log(`📋 Preserving agency sheet data for download access`);
      
      const inventoryId = `inv_${uuidv4()}`;
      console.log(`   Generated Inventory ID: ${inventoryId}`);
      
      const values = [
        this.getMonthName(month),           // Month
        year.toString(),                    // Year
        agency,                             // Agency
        'Active',                           // Status
        new Date().toISOString(),           // Created At (ISO format for frontend compatibility)
        user,                               // Created By
        userName || user,                   // User Name
        '0',                                // Total Scans ← Start with 0, not 1
        inventoryId,                        // Session ID
        '',                                 // Completed At
        ''                                  // Finished By
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
          inventoryId: newSummary.inventoryId
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
        existingRow[4] || new Date().toISOString(),           // Created At (ISO format)
        existingRow[5] || user,                               // Created By
        existingRow[6] || userName || user,                   // User Name
        newScanCount.toString(),                              // Total Scans (increment)
        existingRow[8] || `inv_${uuidv4()}`,                  // Inventory ID
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
  async updateMonthlySummaryStatus(agency, month, year, status, completedAt, totalScans, inventoryId = null, finishedBy = null) {
    try {
      const data = await googleSheets.getSheetData(this.summarySheetName);
      
      // Find the row to update
      const rowIndex = data.findIndex(row => {
        if (row.length < 3) return false;
        const monthMatch = row[0] === this.getMonthName(month);
        const yearMatch = row[1] === year.toString();
        const agencyMatch = row[2] === agency;
        
        // If inventoryId is provided, also match the session ID (column 8)
        const inventoryMatch = inventoryId ? row[8] === inventoryId : true;
        
        return monthMatch && yearMatch && agencyMatch && inventoryMatch;
      });

      if (rowIndex !== -1) {
        // Instead of updating individual cells, update the entire row
        const existingRow = data[rowIndex];
        const updatedRow = [...existingRow];
        
        // Update the specific fields
        updatedRow[3] = status;                    // Status (4th column)
        updatedRow[7] = (totalScans || 0).toString(); // Total Scans (8th column)
        updatedRow[9] = completedAt ? new Date(completedAt).toISOString() : ''; // Completed At (10th column) - ISO format
        updatedRow[10] = finishedBy || '';         // Finished By (11th column)
        
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
        'Month', 'Year', 'Location', 'Status', 'Created At', 'Created By', 
        'User Name', 'Total Scans', 'Session ID', 'Completed At', 'Finished By'
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

      console.log(`🔍 Found entry at row ${rowIndex + 1}: ${deletedDate} - ${barcode}`);

      // Create new data array without the deleted row
      const newData = data.filter((row, index) => index !== rowIndex);
      
      console.log(`📊 Original rows: ${data.length}, New rows: ${newData.length}`);

      // Prepare rows for batch update (skip header row)
      const rowsToUpdate = newData.slice(1).filter(row => 
        row.length >= 2 && row[0] && row[1]
      ).map(row => [row[0], row[1]]);

      // Use batch update for better performance
      await googleSheets.batchUpdateRows(agency, rowsToUpdate);

      console.log(`✅ Successfully deleted row and rebuilt sheet without gaps`);

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

  async deleteMultipleScannedEntries(agency, barcodes) {
    try {
      console.log(`\n🗑️ === DELETE MULTIPLE SCANNED ENTRIES START ===`);
      console.log(`📋 Deleting ${barcodes.length} entries for ${agency}:`, barcodes);
      
      // Validate input
      if (!agency || !barcodes || !Array.isArray(barcodes) || barcodes.length === 0) {
        throw new ValidationError('Missing required fields: agency, barcodes (non-empty array)');
      }

      // Get current data from agency sheet
      const data = await googleSheets.getSheetData(agency);
      
      // Find all rows to delete (matching barcodes)
      const deletedEntries = [];
      const newData = data.filter((row, index) => {
        if (row.length < 2) return true; // Keep rows with insufficient data
        
        const barcode = row[1];
        if (barcodes.includes(barcode)) {
          deletedEntries.push({
            date: row[0],
            barcode: barcode,
            scannedBy: row[2] || ''
          });
          console.log(`🔍 Found entry at row ${index + 1}: ${row[0]} - ${barcode}`);
          return false; // Remove this row
        }
        return true; // Keep this row
      });

      if (deletedEntries.length === 0) {
        throw new ValidationError(`No scanned entries found for the provided barcodes: ${barcodes.join(', ')}`);
      }

      console.log(`📊 Original data rows: ${data.length}, New data rows: ${newData.length}`);
      console.log(`🗑️ Deleted ${deletedEntries.length} out of ${barcodes.length} requested entries`);

      // Prepare rows for batch update (skip header row)
      const rowsToUpdate = newData.slice(1).filter(row => 
        row.length >= 2 && row[0] && row[1]
      ).map(row => [row[0], row[1], row[2] || '']); // Include scannedBy column

      // Use batch update for better performance
      await googleSheets.batchUpdateRows(agency, rowsToUpdate);
      console.log(`✅ Successfully deleted ${deletedEntries.length} entries and rebuilt sheet without gaps`);

      // Update the monthly summary scan count for each deleted entry
      const monthYearCounts = {};
      deletedEntries.forEach(entry => {
        const scanDate = new Date(entry.date);
        const month = (scanDate.getMonth() + 1).toString();
        const year = scanDate.getFullYear().toString();
        const key = `${month}-${year}`;
        monthYearCounts[key] = (monthYearCounts[key] || 0) + 1;
      });

      // Update scan counts for each affected month/year
      for (const [monthYear, count] of Object.entries(monthYearCounts)) {
        const [month, year] = monthYear.split('-');
        const summary = await this.getMonthlySummary(agency, month, year);
        if (summary) {
          const newScanCount = Math.max(0, summary.totalScans - count);
          await this.updateMonthlySummaryScanCount(agency, month, year, newScanCount);
          console.log(`✅ Updated scan count for ${this.getMonthName(month)} ${year}: ${summary.totalScans} → ${newScanCount} (deleted ${count} entries)`);
        }
      }

      console.log(`🏁 === DELETE MULTIPLE SCANNED ENTRIES COMPLETE ===\n`);
      
      return {
        success: true,
        message: `Successfully deleted ${deletedEntries.length} out of ${barcodes.length} scanned entries`,
        deletedEntries: deletedEntries,
        notFound: barcodes.filter(barcode => !deletedEntries.some(entry => entry.barcode === barcode)),
        remainingScans: newData.length - 1 // Subtract 1 for header row
      };

    } catch (error) {
      console.error(`❌ Error deleting multiple scanned entries:`, error);
      if (error instanceof ValidationError || error instanceof GoogleSheetsError) {
        throw error;
      }
      throw new GoogleSheetsError(`Failed to delete multiple scanned entries: ${error.message}`);
    }
  }

  /**
   * Check if inventory was completed (which would terminate all active sessions)
   */
  async checkInventoryCompletion(agency, month, year) {
    try {
      const inventories = await this.getAllMonthlyInventories(agency, month, year);
      
      if (inventories.length === 0) {
        return {
          completed: false,
          hasActiveInventory: false,
          completedInventories: 0,
          totalInventories: 0,
          message: 'No inventories found for this month'
        };
      }
      
      const activeInventories = inventories.filter(inv => inv.status === 'Active');
      const completedInventories = inventories.filter(inv => inv.status === 'Completed');
      
      const isCompleted = completedInventories.length > 0;
      const hasActiveInventory = activeInventories.length > 0;
      
      return {
        completed: isCompleted,
        hasActiveInventory: hasActiveInventory,
        completedInventories: completedInventories.length,
        totalInventories: inventories.length,
        activeInventories: activeInventories.length,
        message: isCompleted 
          ? `Inventory completed. ${completedInventories.length} completed, ${activeInventories.length} active.`
          : `Inventory not completed. ${activeInventories.length} active, ${completedInventories.length} completed.`
      };
    } catch (error) {
      console.error(`❌ Error checking inventory completion:`, error);
      throw new GoogleSheetsError(`Failed to check inventory completion: ${error.message}`);
    }
  }

  /**
   * Clear agency sheet data after successful download
   * This keeps the inventory status as "Completed" but cleans the agency sheet
   * and preserves the total scan count in MonthlySummary
   */
  async clearAgencyDataAfterDownload(agency, month, year, inventoryId) {
    try {
      // Get current scan count before clearing
      const summary = await this.getMonthlySummary(agency, month, year);
      const currentScanCount = summary ? summary.totalScans : 0;
      
      // Clear the agency sheet data (keeps headers, removes all scan data)
      await googleSheets.clearSheet(agency);
      
      // Update MonthlySummary to ensure scan count is preserved
      if (summary && inventoryId) {
        // Only update the scan count, preserve the original completedAt date
        await this.updateMonthlySummaryScanCount(agency, month, year, currentScanCount, inventoryId);
      }
      
      return {
        success: true,
        message: 'Agency sheet data cleared successfully',
        preservedScanCount: currentScanCount
      };
    } catch (error) {
      console.error(`❌ Error clearing agency sheet data:`, error);
      throw new GoogleSheetsError(`Failed to clear agency sheet data: ${error.message}`);
    }
  }

  // Check if inventory was completed by another user
  async checkCompletionByOther(agency, month, year, currentUserId) {
    try {
      console.log(`\n🔍 === CHECK COMPLETION BY OTHER ===`);
      console.log(`📋 Checking: ${agency} - ${this.getMonthName(month)} ${year}`);
      console.log(`👤 Current user: ${currentUserId}`);

      // Get all inventories for this agency/month/year
      const inventories = await this.getAllMonthlyInventories(agency, month, year);
      
      if (inventories.length === 0) {
        return {
          completed: false,
          completedBy: null,
          completedAt: null,
          message: `No inventories found for ${agency} - ${this.getMonthName(month)} ${year}`
        };
      }

      // Find active inventories (not completed)
      const activeInventories = inventories.filter(inv => inv.status === 'Active');
      
      if (activeInventories.length === 0) {
        // No active inventory - check if there's a completed one
        const completedInventories = inventories.filter(inv => inv.status === 'Completed');
        
        if (completedInventories.length === 0) {
          return {
            completed: false,
            completedBy: null,
            completedAt: null,
            message: `No active or completed inventories found for ${agency} - ${this.getMonthName(month)} ${year}`
          };
        }

        // Get the most recent completed inventory
        const latestCompleted = completedInventories[completedInventories.length - 1];
        
        // Check if it was completed by a different user
        const completedByDifferentUser = latestCompleted.finishedBy && 
                                       latestCompleted.finishedBy !== currentUserId;

        console.log(`📊 Latest completed inventory:`, {
          completedBy: latestCompleted.finishedBy,
          completedAt: latestCompleted.completedAt,
          currentUser: currentUserId,
          differentUser: completedByDifferentUser
        });

        if (completedByDifferentUser) {
          return {
            completed: true,
            completedBy: latestCompleted.finishedBy,
            completedAt: latestCompleted.completedAt,
            message: `Inventory was completed by ${latestCompleted.finishedBy}`
          };
        } else {
          return {
            completed: false,
            completedBy: latestCompleted.finishedBy,
            completedAt: latestCompleted.completedAt,
            message: `Inventory was completed by the same user (${currentUserId})`
          };
        }
      } else {
        // There's an active inventory - check if it was completed by someone else
        const activeInventory = activeInventories[activeInventories.length - 1];
        
        // Check if the active inventory was completed by a different user
        const completedByDifferentUser = activeInventory.finishedBy && 
                                       activeInventory.finishedBy !== currentUserId;

        console.log(`📊 Active inventory:`, {
          status: activeInventory.status,
          createdBy: activeInventory.createdBy,
          finishedBy: activeInventory.finishedBy,
          currentUser: currentUserId,
          differentUser: completedByDifferentUser
        });

        if (completedByDifferentUser) {
          return {
            completed: true,
            completedBy: activeInventory.finishedBy,
            completedAt: activeInventory.completedAt,
            message: `Active inventory was completed by ${activeInventory.finishedBy}`
          };
        } else {
          return {
            completed: false,
            completedBy: activeInventory.finishedBy,
            completedAt: activeInventory.completedAt,
            message: `Active inventory is available for scanning`
          };
        }
      }
    } catch (error) {
      console.error(`❌ Error checking completion by other:`, error);
      throw new GoogleSheetsError(`Failed to check completion by other: ${error.message}`);
    }
  }

  // Get inventory data for download
  async getInventoryDataForDownload(agency, month, year) {
    try {
      console.log(`\n📊 === GET INVENTORY DATA FOR DOWNLOAD ===`);
      console.log(`📋 Getting data for: ${agency} - ${this.getMonthName(month)} ${year}`);
      
      // Get all inventories for this agency/month/year
      const allInventories = await this.getAllMonthlyInventories(agency, month, year);
      if (allInventories.length === 0) {
        throw new ValidationError(`No inventory found for ${agency} - ${this.getMonthName(month)} ${year}`);
      }

      // Find the most recent completed inventory for download
      const completedInventories = allInventories.filter(inv => inv.status === 'Completed');
      if (completedInventories.length === 0) {
        throw new ValidationError(`No completed inventory found for ${agency} - ${this.getMonthName(month)} ${year}. Only completed inventories can be downloaded.`);
      }

      // Get the most recent completed inventory
      const summary = completedInventories[completedInventories.length - 1];

      console.log(`📊 Found ${completedInventories.length} completed inventory(ies), using most recent:`, {
        totalScans: summary.totalScans,
        status: summary.status,
        inventoryId: summary.inventoryId
      });

      // Get all scanned data from agency sheet
      const data = await googleSheets.getSheetData(agency);
      console.log(`📊 Total rows in agency sheet: ${data.length}`);
      
      // Skip header row (first row) and filter scans for the specific month/year
      const dataRows = data.slice(1); // Skip first row (headers)
      console.log(`📊 Data rows (excluding headers): ${dataRows.length}`);
      
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
          
          const targetMonth = parseInt(month) - 1; // JavaScript months are 0-based
          const targetYear = parseInt(year);
          
          const matches = scanDate.getMonth() === targetMonth && scanDate.getFullYear() === targetYear;
          
          if (matches) {
            console.log(`✅ Match found: ${dateStr} -> ${scanDate.toDateString()}`);
          }
          
          return matches;
        } catch (error) {
          console.log(`⚠️ Error parsing date: ${row[0]}`, error.message);
          return false;
        }
      });

      console.log(`📊 Found ${monthScans.length} scans for download (expected: ${summary.totalScans})`);

      // Use the actual count from monthly summary as the authoritative source
      const totalScans = summary.totalScans || monthScans.length;

      return {
        agency,
        month: this.getMonthName(month),
        year,
        totalScans: totalScans, // Use monthly summary count
        status: summary.status,
        createdAt: summary.createdAt,
        completedAt: summary.completedAt,
        inventoryId: summary.inventoryId, // Include inventoryId for download tracking
        scans: monthScans.map(row => ({
          date: row[0],
          identifier: row[1], // Can be barcode or serie
          scannedBy: row[2] || '',
          // Enhanced car data from new format
          serie: row[3] || '',
          marca: row[4] || '',
          color: row[5] || '',
          ubicaciones: row[6] || '',
          // Legacy compatibility
          barcode: row[1] // Keep for backward compatibility
        }))
      };
    } catch (error) {
      console.error(`❌ Error in getInventoryDataForDownload:`, error);
      if (error instanceof ValidationError || error instanceof GoogleSheetsError) {
        throw error;
      }
      throw new GoogleSheetsError(`Failed to get inventory data for download: ${error.message}`);
    }
  }
}

module.exports = new InventoryService();
