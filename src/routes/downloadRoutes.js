const express = require('express');
const router = express.Router();
const path = require('path');
const inventoryService = require('../services/inventoryService');
const downloadService = require('../services/downloadService');
const fileStorageService = require('../services/fileStorageService');
const { asyncHandler, ValidationError, GoogleSheetsError } = require('../middleware/errorHandler');


// GET /api/download/inventory/:agency/:month/:year/csv/:sessionId - Download specific inventory by session ID
router.get('/inventory/:agency/:month/:year/csv/:sessionId', asyncHandler(async (req, res) => {
  const { agency, month, year, sessionId } = req.params;

  // Validate parameters
  if (!agency || !month || !year || !sessionId) {
    throw new ValidationError('Missing required parameters: agency, month, year, sessionId');
  }

  try {
    // First, check if there's a backup file with this specific session ID
    const storedFiles = await fileStorageService.getStoredFilesByAgency(agency);
    
    // Look for file with specific session ID in filename
    const shortSessionId = sessionId.replace('sess_', '').slice(-8);
    
    const sessionFile = storedFiles.find(file => {
      const hasAgency = file.name.includes(`${agency}`);
      const hasMonth = file.name.includes(`${month}`);
      const hasYear = file.name.includes(`${year}`);
      const hasSessionId = file.name.includes(shortSessionId);
      
      return hasAgency && hasMonth && hasYear && hasSessionId;
    });

    if (sessionFile) {
      // Download from Google Drive backup
      const fileData = await fileStorageService.downloadStoredFile(sessionFile.id);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${sessionFile.name}"`);
      res.setHeader('Content-Length', fileData.size);
      res.send(fileData.content);
      
      return;
    }

    // If no specific session file found, fall back to most recent
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
        // Pass session ID for unique filename
        fileStorageService.storeInventoryFile(agency, month, year, 'csv', inventoryData.sessionId)
          .then((result) => {
            console.log('✅ File stored on Google Drive:', result.filename);
          })
          .catch((error) => {
            console.error('❌ Failed to store file on Google Drive:', error);
          })
          .finally(() => {
            // Clear agency sheet data after Google Drive storage (or attempt)
            inventoryService.clearAgencyDataAfterDownload(agency, month, year, inventoryData.sessionId)
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
          inventoryService.clearAgencyDataAfterDownload(agency, month, year, inventoryData.sessionId)
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
