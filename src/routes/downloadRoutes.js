const express = require('express');
const router = express.Router();
const path = require('path');
const inventoryService = require('../services/inventoryService');
const downloadService = require('../services/downloadService');
const fileStorageService = require('../services/fileStorageService');
const { asyncHandler, ValidationError, GoogleSheetsError } = require('../middleware/errorHandler');


// GET /api/inventory/location/:agency/:month/:year - Get all inventories for a location
router.get('/inventory/location/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  try {
    // Get all stored files for this agency
    const storedFiles = await fileStorageService.getStoredFilesByAgency(agency);
    
    // Filter files for this month/year and sort by creation date (most recent first)
    const monthFiles = storedFiles.filter(file => 
      file.name.includes(`${agency}`) && 
      file.name.includes(`${month}`) && 
      file.name.includes(`${year}`)
    ).sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

    // Extract inventory information from filenames
    const inventories = monthFiles.map((file, index) => {
      // Extract inventory ID from filename (last 8 characters before .csv)
      const filenameWithoutExt = file.name.replace('.csv', '');
      const parts = filenameWithoutExt.split('_');
      const inventoryId = parts[parts.length - 1]; // Last part should be the short inventory ID
      
      // Extract creation date from filename (first part: YYYY-MM-DD)
      const creationDate = parts[0]; // First part should be the creation date
      
      return {
        inventoryId: `inv_${inventoryId}`, // Reconstruct full inventory ID
        filename: file.name,
        createdAt: file.createdTime,
        creationDate: creationDate, // Date when inventory was created
        size: file.size,
        inventoryNumber: index + 1, // 1st, 2nd, etc.
        downloadUrl: `/api/download/inventory/${agency}/${month}/${year}/csv/inv_${inventoryId}`,
        displayName: `Inventory #${index + 1} (${creationDate})`
      };
    });

    res.json({
      success: true,
      location: agency,
      month: month,
      year: year,
      totalInventories: inventories.length,
      inventories: inventories,
      message: inventories.length > 0 
        ? `Found ${inventories.length} inventory(ies) for ${agency}` 
        : `No inventories found for ${agency} ${month}/${year}`
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get location inventories',
      error: error.message
    });
  }
}));

// GET /api/download/inventory/:agency/:month/:year/csv/location - Download most recent inventory for location
router.get('/inventory/:agency/:month/:year/csv/location', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;
  const { strategy = 'most_recent' } = req.query; // Strategy: most_recent, first, last, all

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  try {
    // Get all stored files for this agency
    const storedFiles = await fileStorageService.getStoredFilesByAgency(agency);
    
    // Filter files for this month/year and sort by creation date
    const monthFiles = storedFiles.filter(file => 
      file.name.includes(`${agency}`) && 
      file.name.includes(`${month}`) && 
      file.name.includes(`${year}`)
    ).sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

    if (monthFiles.length === 0) {
      // No backup files found, generate from Google Sheets
      const inventoryData = await inventoryService.getInventoryDataForDownload(agency, month, year);
      const fileInfo = await downloadService.generateCSV(inventoryData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.filename}"`);
      res.setHeader('Content-Length', fileInfo.size);

      res.sendFile(fileInfo.filepath, (err) => {
        if (err) {
          console.error('Error sending file:', err);
        } else {
          // Store file on Google Drive before clearing data (first time only)
          fileStorageService.storeInventoryFile(agency, month, year, 'csv', inventoryData.inventoryId)
            .then((result) => {
              console.log('✅ File stored on Google Drive:', result.filename);
            })
            .catch((error) => {
              console.error('❌ Failed to store file on Google Drive:', error);
            })
            .finally(() => {
              inventoryService.clearAgencyDataAfterDownload(agency, month, year, inventoryData.inventoryId)
                .catch((error) => {
                  console.error('❌ Failed to clear agency sheet data:', error);
                });
            });
        }
        downloadService.cleanupFile(fileInfo.filepath);
      });
      return;
    }

    // Handle different download strategies
    let selectedFile;
    switch (strategy) {
      case 'first':
        selectedFile = monthFiles[monthFiles.length - 1]; // Oldest (first created)
        break;
      case 'last':
        selectedFile = monthFiles[0]; // Newest (last created)
        break;
      case 'date_based':
        // Smart date-based selection
        const currentDate = new Date();
        const currentDay = currentDate.getDate();
        
        if (currentDay <= 15) {
          // First half of month - get first inventory
          selectedFile = monthFiles[monthFiles.length - 1]; // Oldest
          console.log(`📅 Date-based selection: First half of month (day ${currentDay}) - selecting first inventory`);
        } else {
          // Second half of month - get second inventory
          selectedFile = monthFiles[0]; // Newest
          console.log(`📅 Date-based selection: Second half of month (day ${currentDay}) - selecting second inventory`);
        }
        break;
      case 'most_recent':
      default:
        selectedFile = monthFiles[0]; // Most recent (default)
        break;
    }

    // Download the selected file
    const fileData = await fileStorageService.downloadStoredFile(selectedFile.id);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${selectedFile.name}"`);
    res.setHeader('Content-Length', fileData.size);
    res.send(fileData.content);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to download inventory file',
      error: error.message
    });
  }
}));

// GET /api/download/inventory/:agency/:month/:year/csv/:inventoryId - Download specific inventory by inventory ID
router.get('/inventory/:agency/:month/:year/csv/:inventoryId', asyncHandler(async (req, res) => {
  const { agency, month, year, inventoryId } = req.params;

  // Validate parameters
  if (!agency || !month || !year || !inventoryId) {
    throw new ValidationError('Missing required parameters: agency, month, year, inventoryId');
  }

  try {
    // First, check if there's a backup file with this specific session ID
    const storedFiles = await fileStorageService.getStoredFilesByAgency(agency);
    
    // Look for file with specific inventory ID in filename
    const shortInventoryId = inventoryId.replace('inv_', '').slice(-8);
    
    const inventoryFile = storedFiles.find(file => {
      const hasAgency = file.name.includes(`${agency}`);
      const hasMonth = file.name.includes(`${month}`);
      const hasYear = file.name.includes(`${year}`);
      const hasInventoryId = file.name.includes(shortInventoryId);
      
      return hasAgency && hasMonth && hasYear && hasInventoryId;
    });

    if (inventoryFile) {
      // Download from Google Drive backup
      const fileData = await fileStorageService.downloadStoredFile(inventoryFile.id);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${inventoryFile.name}"`);
      res.setHeader('Content-Length', fileData.size);
      res.send(fileData.content);
      
      return;
    }

    // If no specific inventory file found, fall back to most recent
    const monthFiles = storedFiles.filter(file => 
      file.name.includes(`${agency}`) && 
      file.name.includes(`${month}`) && 
      file.name.includes(`${year}`)
    ).sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

    if (monthFiles.length > 0) {
      const existingFile = monthFiles[0];
      const fileData = await fileStorageService.downloadStoredFile(existingFile.id);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${existingFile.name}"`);
      res.setHeader('Content-Length', fileData.size);
      res.send(fileData.content);
      
      return;
    }

    // No backup found at all
    throw new ValidationError(`No inventory files found for ${agency} ${month}/${year}`);

  } catch (error) {
    console.error('Error in specific inventory download:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download specific inventory file',
      error: error.message
    });
  }
}));

// GET /api/download/inventory/:agency/:month/:year/csv
router.get('/inventory/:agency/:month/:year/csv', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  try {
    // First, check if there's already a backup file in Google Drive
    const storedFiles = await fileStorageService.getStoredFilesByAgency(agency);
    
    // Filter files for this specific month/year and sort by creation date (most recent first)
    const monthFiles = storedFiles.filter(file => 
      file.name.includes(`${agency}`) && 
      file.name.includes(`${month}`) && 
      file.name.includes(`${year}`)
    ).sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

    if (monthFiles.length > 0) {
      // Download the most recent file from Google Drive backup
      const existingFile = monthFiles[0];
      const fileData = await fileStorageService.downloadStoredFile(existingFile.id);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${existingFile.name}"`);
      res.setHeader('Content-Length', fileData.size);
      res.send(fileData.content);
      
      return;
    }

    // No backup found, generate from Google Sheets (first time)
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
        // Store file on Google Drive before clearing data (first time only)
        // Pass inventory ID for unique filename
        fileStorageService.storeInventoryFile(agency, month, year, 'csv', inventoryData.inventoryId)
          .then((result) => {
            console.log('✅ File stored on Google Drive:', result.filename);
          })
          .catch((error) => {
            console.error('❌ Failed to store file on Google Drive:', error);
          })
          .finally(() => {
            // Clear agency sheet data after Google Drive storage (or attempt)
            inventoryService.clearAgencyDataAfterDownload(agency, month, year, inventoryData.inventoryId)
              .catch((error) => {
                console.error('❌ Failed to clear agency sheet data:', error);
              });
          });
      }
      // Cleanup temporary file after sending
      downloadService.cleanupFile(fileInfo.filepath);
    });

  } catch (error) {
    console.error('Error in download flow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download inventory file',
      error: error.message
    });
  }
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
      // Store file on Google Drive before clearing data
      fileStorageService.storeInventoryFile(agency, month, year, 'xlsx')
        .then((result) => {
          console.log('✅ File stored on Google Drive:', result.filename);
        })
        .catch((error) => {
          console.error('❌ Failed to store file on Google Drive:', error);
        })
        .finally(() => {
          // Clear agency sheet data after Google Drive storage (or attempt)
          inventoryService.clearAgencyDataAfterDownload(agency, month, year, inventoryData.inventoryId)
            .catch((error) => {
              console.error('❌ Failed to clear agency sheet data:', error);
            });
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

// POST /api/download/store/:agency/:month/:year/:type
router.post('/store/:agency/:month/:year/:type', asyncHandler(async (req, res) => {
  const { agency, month, year, type } = req.params;

  // Validate parameters
  if (!agency || !month || !year || !type) {
    throw new ValidationError('Missing required parameters: agency, month, year, type');
  }

  if (!['csv', 'xlsx'].includes(type)) {
    throw new ValidationError('Invalid file type. Supported types: csv, xlsx');
  }

  // Store file on Google Drive
  const result = await fileStorageService.storeInventoryFile(agency, month, year, type);

  res.status(200).json({
    success: true,
    message: 'File stored successfully on Google Drive',
    data: result
  });
}));

// GET /api/download/stored/:agency/:month/:year
router.get('/stored/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  // Get stored files
  const files = await fileStorageService.getStoredFiles(agency, month, year);

  res.status(200).json({
    success: true,
    message: 'Stored files retrieved successfully',
    data: {
      agency,
      month,
      year,
      files
    }
  });
}));

// GET /api/download/stored-files/:agency - List files stored in Google Drive for an agency
router.get('/stored-files/:agency', asyncHandler(async (req, res) => {
  const { agency } = req.params;
  
  if (!agency) {
    throw new ValidationError('Missing required parameter: agency');
  }

  try {
    // Debug: Check environment variables
    console.log('🔍 Environment Variables Debug:');
    console.log('  - GOOGLE_REFRESH_TOKEN:', process.env.GOOGLE_REFRESH_TOKEN ? 'Present' : 'Missing');
    console.log('  - GOOGLE_ACCESS_TOKEN:', process.env.GOOGLE_ACCESS_TOKEN ? 'Present' : 'Missing');
    console.log('  - GOOGLE_DRIVE_CREDENTIALS_PATH:', process.env.GOOGLE_DRIVE_CREDENTIALS_PATH || 'Not set');
    
    // Try to get real files from Google Drive
    const files = await fileStorageService.getStoredFilesByAgency(agency);
    
    res.status(200).json({
      success: true,
      agency,
      files,
      count: files.length
    });
  } catch (error) {
    console.error(`Error getting stored files for ${agency}:`, error);
    
    // Return mock data as fallback
    const mockFiles = [
      {
        id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        name: '2025-09-23_Alfa Romeo_September_2025.csv',
        mimeType: 'text/csv',
        size: 352,
        createdTime: '2025-09-23T08:37:00.000Z',
        modifiedTime: '2025-09-23T08:37:00.000Z',
        webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view'
      }
    ];
    
    res.status(200).json({
      success: true,
      agency,
      files: mockFiles,
      count: mockFiles.length,
      message: 'Mock data - OAuth error occurred',
      error: error.message
    });
  }
}));

// GET /api/download/stored-files
router.get('/stored-files', asyncHandler(async (req, res) => {
  const { agency, month, year, type, status } = req.query;

  // Get all stored files with optional filters
  const files = await fileStorageService.getAllStoredFiles({
    agency,
    month,
    year,
    type,
    status
  });

  res.status(200).json({
    success: true,
    message: 'Stored files retrieved successfully',
    data: {
      files,
      count: files.length
    }
  });
}));

// GET /api/download/stored-file/:fileId
router.get('/stored-file/:fileId', asyncHandler(async (req, res) => {
  const { fileId } = req.params;

  if (!fileId) {
    throw new ValidationError('Missing required parameter: fileId');
  }

  // Download file from Google Drive
  const fileInfo = await fileStorageService.downloadStoredFile(fileId);

  // Validate file path exists
  if (!fileInfo.filepath) {
    throw new ValidationError('File path is missing from download response');
  }

  // Check if file exists
  const fs = require('fs');
  if (!fs.existsSync(fileInfo.filepath)) {
    throw new ValidationError(`File not found at path: ${fileInfo.filepath}`);
  }

  // Set response headers for file download
  res.setHeader('Content-Type', fileInfo.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.filename}"`);
  res.setHeader('Content-Length', fileInfo.size);

  // Send file and cleanup
  res.sendFile(fileInfo.filepath, (err) => {
    if (err) {
      console.error('Error sending stored file:', err);
    }
    // Cleanup temporary file after sending
    downloadService.cleanupFile(fileInfo.filepath);
  });
}));

// POST /api/download/cleanup-expired
router.post('/cleanup-expired', asyncHandler(async (req, res) => {
  try {
    const result = await fileStorageService.cleanupExpiredFiles();
    res.status(200).json({
      success: true,
      message: 'Expired files cleanup completed',
      data: result
    });
  } catch (error) {
    throw new GoogleSheetsError(`Failed to cleanup expired files: ${error.message}`);
  }
}));

// GET /api/download/storage-stats
router.get('/storage-stats', asyncHandler(async (req, res) => {
  try {
    const stats = await fileStorageService.getFileStatistics();
    res.status(200).json({
      success: true,
      message: 'Storage statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    throw new GoogleSheetsError(`Failed to get storage statistics: ${error.message}`);
  }
}));

module.exports = router;
