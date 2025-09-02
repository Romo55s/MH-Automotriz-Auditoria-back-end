const express = require('express');
const router = express.Router();
const path = require('path');
const inventoryService = require('../services/inventoryService');
const downloadService = require('../services/downloadService');
const { asyncHandler, ValidationError, GoogleSheetsError } = require('../middleware/errorHandler');

// GET /api/download/inventory/:agency/:month/:year/csv
router.get('/inventory/:agency/:month/:year/csv', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  // Get inventory data
  const inventoryData = await inventoryService.getInventoryDataForDownload(agency, month, year);
  
  // Generate CSV file
  const fileInfo = await downloadService.generateCSV(inventoryData);

  // Set response headers for file download
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.filename}"`);
  res.setHeader('Content-Length', fileInfo.size);

  // Send file and cleanup
  res.sendFile(fileInfo.filepath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
    } else {
      // Clear agency sheet data after successful download
      inventoryService.clearAgencyDataAfterDownload(agency, month, year, inventoryData.sessionId)
        .catch((error) => {
          console.error('❌ Failed to clear agency sheet data:', error);
        });
    }
    // Cleanup temporary file after sending
    downloadService.cleanupFile(fileInfo.filepath);
  });
}));

// GET /api/download/inventory/:agency/:month/:year/excel
router.get('/inventory/:agency/:month/:year/excel', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  // Get inventory data
  const inventoryData = await inventoryService.getInventoryDataForDownload(agency, month, year);
  
  // Generate Excel file
  const fileInfo = await downloadService.generateExcel(inventoryData);

  // Set response headers for file download
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.filename}"`);
  res.setHeader('Content-Length', fileInfo.size);

  // Send file and cleanup
  res.sendFile(fileInfo.filepath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
    } else {
      // Clear agency sheet data after successful download
      inventoryService.clearAgencyDataAfterDownload(agency, month, year, inventoryData.sessionId)
        .catch((error) => {
          console.error('❌ Failed to clear agency sheet data:', error);
        });
    }
    // Cleanup temporary file after sending
    downloadService.cleanupFile(fileInfo.filepath);
  });
}));

// POST /api/download/cleanup-temp-files
router.post('/cleanup-temp-files', asyncHandler(async (req, res) => {
  try {
    downloadService.cleanupOldFiles();
    res.status(200).json({
      success: true,
      message: 'Temporary files cleanup completed'
    });
  } catch (error) {
    throw new GoogleSheetsError(`Failed to cleanup temporary files: ${error.message}`);
  }
}));

module.exports = router;
