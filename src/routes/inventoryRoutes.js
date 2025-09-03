const express = require('express');
const router = express.Router();
const inventoryService = require('../services/inventoryService');
const { asyncHandler, ValidationError, GoogleSheetsError } = require('../middleware/errorHandler');

// POST /api/inventory/save-scan
router.post('/save-scan', asyncHandler(async (req, res) => {
  const { agency, month, year, code, user, userName } = req.body;

  // Validate required fields
  if (!agency || !month || !year || !code || !user) {
    throw new ValidationError('Missing required fields: agency, month, year, code, user');
  }

  const result = await inventoryService.saveScan({
    agency,
    month,
    year,
    code,
    user,
    userName: userName || user
  });

  res.status(200).json(result);
}));

// POST /api/inventory/finish-session
router.post('/finish-session', asyncHandler(async (req, res) => {
  const { agency, month, year, user } = req.body;

  // Validate required fields
  if (!agency || !month || !year || !user) {
    throw new ValidationError('Missing required fields: agency, month, year, user');
  }

  const result = await inventoryService.finishSession({
    agency,
    month,
    year,
    user
  });

  res.status(200).json(result);
}));

// GET /api/inventory/monthly-inventory/:agency/:month/:year
router.get('/monthly-inventory/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.getMonthlyInventory(agency, month, year);
  
  // Safari-specific response handling
  const isSafari = req.get('User-Agent') && req.get('User-Agent').includes('Safari');
  
  if (isSafari) {
    // Add ETag for Safari caching
    const etag = `"${agency}-${month}-${year}-${Date.now()}"`;
    res.set('ETag', etag);
    
    // Check if client has the same ETag
    if (req.get('If-None-Match') === etag) {
      return res.status(304).end();
    }
  }
  
  res.status(200).json(result);
}));

// GET /api/inventory/agency-inventories/:agency
router.get('/agency-inventories/:agency', asyncHandler(async (req, res) => {
  const { agency } = req.params;

  // Validate parameters
  if (!agency) {
    throw new ValidationError('Missing required parameter: agency');
  }

  const result = await inventoryService.getAgencyInventories(agency);
  res.status(200).json(result);
}));

// GET /api/inventory/check-monthly-inventory/:agency/:month/:year
router.get('/check-monthly-inventory/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.checkMonthlyInventory(agency, month, year);
  
  // Safari-specific response handling
  const isSafari = req.get('User-Agent') && req.get('User-Agent').includes('Safari');
  
  if (isSafari) {
    // Add ETag for Safari caching
    const etag = `"check-${agency}-${month}-${year}-${Date.now()}"`;
    res.set('ETag', etag);
    
    // Check if client has the same ETag
    if (req.get('If-None-Match') === etag) {
      return res.status(304).end();
    }
  }
  
  res.status(200).json(result);
}));

// GET /api/inventory/duplicate-barcodes/:agency/:month/:year
router.get('/duplicate-barcodes/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.getDuplicateBarcodes(agency, month, year);
  res.status(200).json(result);
}));

// GET /api/inventory/scan-count/:agency/:month/:year
router.get('/scan-count/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.getScanCount(agency, month, year);
  res.status(200).json(result);
}));

// DELETE /api/inventory/delete-scanned-entry
router.delete('/delete-scanned-entry', asyncHandler(async (req, res) => {
  const { agency, barcode } = req.body;

  // Validate required fields
  if (!agency || !barcode) {
    throw new ValidationError('Missing required fields: agency, barcode');
  }

  const result = await inventoryService.deleteScannedEntry(agency, barcode);
  res.status(200).json(result);
}));

// DELETE /api/inventory/delete-multiple
router.delete('/delete-multiple', asyncHandler(async (req, res) => {
  const { agency, barcodes } = req.body;

  // Validate required fields
  if (!agency || !barcodes || !Array.isArray(barcodes) || barcodes.length === 0) {
    throw new ValidationError('Missing required fields: agency, barcodes (non-empty array)');
  }

  const result = await inventoryService.deleteMultipleScannedEntries(agency, barcodes);
  res.status(200).json(result);
}));

// GET /api/inventory/inventory-data/:agency/:month/:year
router.get('/inventory-data/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.getInventoryDataForDownload(agency, month, year);
  res.status(200).json(result);
}));

// GET /api/inventory/check-inventory-limits/:agency/:month/:year
router.get('/check-inventory-limits/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.checkInventoryLimits(agency, month, year);
  res.status(200).json(result);
}));

// POST /api/inventory/check-completion
router.post('/check-completion', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.body;
  
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required fields: agency, month, year');
  }
  
  try {
    const result = await inventoryService.checkInventoryCompletion(agency, month, year);
    res.json(result);
  } catch (error) {
    console.error('Error checking inventory completion:', error);
    throw error;
  }
}));

// GET /api/inventory/diagnose-google-sheets
router.get('/diagnose-google-sheets', asyncHandler(async (req, res) => {
  const googleSheets = require('../services/googleSheets');
  
  try {
    console.log('🔍 === GOOGLE SHEETS DIAGNOSTIC START ===');
    
    // Test basic connectivity
    await googleSheets.ensureInitialized();
    console.log('✅ Google Sheets service initialized');
    
    // Test spreadsheet access
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID environment variable not set');
    }
    console.log(`📊 Spreadsheet ID: ${spreadsheetId}`);
    
    // Test reading MonthlySummary sheet
    let monthlySummaryData = null;
    try {
      monthlySummaryData = await googleSheets.getSheetData('MonthlySummary');
      console.log(`✅ MonthlySummary sheet accessible (${monthlySummaryData.length} rows)`);
    } catch (error) {
      console.log(`❌ MonthlySummary sheet error: ${error.message}`);
    }
    
    // Test creating a test sheet (if it doesn't exist)
    const testSheetName = 'DiagnosticTest';
    try {
      await googleSheets.ensureSheetExists(testSheetName);
      console.log(`✅ Test sheet creation/access successful`);
      
      // Clean up test sheet
      try {
        await googleSheets.clearSheet(testSheetName);
        console.log(`✅ Test sheet cleanup successful`);
      } catch (cleanupError) {
        console.log(`⚠️ Test sheet cleanup failed: ${cleanupError.message}`);
      }
    } catch (error) {
      console.log(`❌ Test sheet creation failed: ${error.message}`);
    }
    
    // Check credentials info (without exposing sensitive data)
    const credentialsInfo = {
      hasBase64Credentials: !!process.env.GOOGLE_CREDENTIALS_BASE64,
      hasFileCredentials: !!process.env.GOOGLE_SHEETS_CREDENTIALS_PATH,
      base64Length: process.env.GOOGLE_CREDENTIALS_BASE64 ? process.env.GOOGLE_CREDENTIALS_BASE64.length : 0
    };
    console.log(`🔐 Credentials info:`, credentialsInfo);
    
    console.log('🏁 === GOOGLE SHEETS DIAGNOSTIC COMPLETE ===');
    
    res.json({
      success: true,
      message: 'Google Sheets diagnostic completed',
      results: {
        serviceInitialized: true,
        spreadsheetId: spreadsheetId,
        monthlySummaryAccessible: !!monthlySummaryData,
        monthlySummaryRows: monthlySummaryData ? monthlySummaryData.length : 0,
        testSheetCreation: true,
        credentialsConfigured: credentialsInfo.hasBase64Credentials || credentialsInfo.hasFileCredentials,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Google Sheets diagnostic failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Google Sheets diagnostic failed',
      error: error.message,
      details: {
        serviceInitialized: false,
        spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || 'Not set',
        credentialsConfigured: !!(process.env.GOOGLE_CREDENTIALS_BASE64 || process.env.GOOGLE_SHEETS_CREDENTIALS_PATH),
        timestamp: new Date().toISOString()
      }
    });
  }
}));

module.exports = router;
