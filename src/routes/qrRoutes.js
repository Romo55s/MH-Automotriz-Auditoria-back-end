const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const qrService = require('../services/qrService');
const inventoryService = require('../services/inventoryService');
const { asyncHandler, ValidationError, GoogleSheetsError } = require('../middleware/errorHandler');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../temp/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${originalName}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV and Excel files
    const allowedTypes = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new ValidationError('Only CSV and Excel files are allowed'));
    }
  }
});

// POST /api/qr/upload-csv - Upload CSV file and generate QR codes
router.post('/upload-csv', upload.single('csvFile'), asyncHandler(async (req, res) => {
  const { location, user, userName } = req.body;

  // Validate required fields
  if (!location || !user) {
    throw new ValidationError('Missing required fields: location, user');
  }

  if (!req.file) {
    throw new ValidationError('No CSV file uploaded');
  }

  try {

    // Parse CSV file
    const csvData = await qrService.parseCSVFile(req.file.path);

    // Generate QR codes
    const qrResult = await qrService.generateQRCodes(csvData, location, user, userName || user);

    // Create ZIP file
    const zipResult = await qrService.createQRCodesZip(qrResult);

    // Cleanup uploaded CSV file
    await qrService.cleanupFiles(req.file.path);


    res.status(200).json({
      success: true,
      message: `Successfully generated ${qrResult.totalGenerated} QR codes`,
      result: {
        sessionId: qrResult.sessionId,
        totalGenerated: qrResult.totalGenerated,
        location: qrResult.location,
        generatedBy: qrResult.generatedBy,
        generatedAt: qrResult.generatedAt,
        downloadInfo: {
          filename: zipResult.zipFilename,
          size: zipResult.size,
          downloadUrl: `/api/qr/download/${path.basename(zipResult.zipFilename, '.zip')}`
        }
      }
    });

  } catch (error) {
    // Cleanup uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      await qrService.cleanupFiles(req.file.path);
    }
    throw error;
  }
}));

// GET /api/qr/download/:sessionId - Download generated QR codes ZIP
router.get('/download/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    throw new ValidationError('Missing session ID');
  }

  // Try both possible filename formats
  let zipFilePath = path.join(__dirname, '../../temp', `${sessionId}.zip`);
  
  // If the direct sessionId.zip doesn't exist, look for files with the sessionId in the name
  if (!fs.existsSync(zipFilePath)) {
    const tempDir = path.join(__dirname, '../../temp');
    const files = fs.readdirSync(tempDir);
    const matchingFile = files.find(file => 
      file.includes(sessionId.replace('qr_', '')) && file.endsWith('.zip')
    );
    
    if (matchingFile) {
      zipFilePath = path.join(tempDir, matchingFile);
    } else {
      throw new ValidationError('QR codes file not found or has expired');
    }
  }

  const stats = fs.statSync(zipFilePath);
  const actualZipFilename = path.basename(zipFilePath);

  // Set response headers for file download
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${actualZipFilename}"`);
  res.setHeader('Content-Length', stats.size);

  // Send file and cleanup after download
  res.sendFile(zipFilePath, (err) => {
    if (err) {
      console.error('Error sending QR codes ZIP file:', err);
    } else {
      // Cleanup ZIP file after successful download (optional - you may want to keep it for a while)
      setTimeout(() => {
        qrService.cleanupFiles(zipFilePath);
      }, 60000); // Delete after 1 minute
    }
  });
}));

// POST /api/qr/scan - Process scanned QR code
router.post('/scan', asyncHandler(async (req, res) => {
  const { qrData, user, userName } = req.body;

  // Validate required fields
  if (!qrData || !user) {
    throw new ValidationError('Missing required fields: qrData, user');
  }

  try {

    // Parse QR code data
    const parsedData = qrService.parseQRData(qrData);

    // Extract month and year from current date (or you could use the QR timestamp)
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString();

    // Create a unique identifier for this car (using serie as the main identifier)
    const carIdentifier = parsedData.serie;

    // Save the scan using the existing inventory service
    const scanResult = await inventoryService.saveScan({
      agency: parsedData.location, // Use location from QR as agency
      code: carIdentifier, // Use serie as the code
      user: user,
      userName: userName || user,
      month: month,
      year: year,
      timestamp: new Date().toISOString(),
      // Additional data from QR
      carData: {
        serie: parsedData.serie,
        marca: parsedData.marca,
        color: parsedData.color,
        ubicaciones: parsedData.ubicaciones
      }
    });


    res.status(200).json({
      success: true,
      message: 'QR code scan processed successfully',
      scanResult: scanResult,
      carData: {
        serie: parsedData.serie,
        marca: parsedData.marca,
        color: parsedData.color,
        ubicaciones: parsedData.ubicaciones,
        location: parsedData.location
      }
    });

  } catch (error) {
    console.error(`❌ Error processing QR scan:`, error);
    throw error;
  }
}));

// POST /api/qr/cleanup-temp-files - Cleanup old temporary files
router.post('/cleanup-temp-files', asyncHandler(async (req, res) => {
  try {
    qrService.cleanupOldFiles();
    res.status(200).json({
      success: true,
      message: 'Temporary files cleanup completed'
    });
  } catch (error) {
    throw new GoogleSheetsError(`Failed to cleanup temporary files: ${error.message}`);
  }
}));

// GET /api/qr/locations - Get available locations (agencies + bodegas)
router.get('/locations', asyncHandler(async (req, res) => {
  const locations = [
    // Existing agencies
    { id: 'suzuki', name: 'Suzuki', type: 'agency' },
    { id: 'nissan', name: 'Nissan', type: 'agency' },
    { id: 'honda', name: 'Honda', type: 'agency' },
    { id: 'toyota', name: 'Toyota', type: 'agency' },
    { id: 'mazda', name: 'Mazda', type: 'agency' },
    { id: 'hyundai', name: 'Hyundai', type: 'agency' },
    { id: 'kia', name: 'Kia', type: 'agency' },
    { id: 'volkswagen', name: 'Volkswagen', type: 'agency' },
    { id: 'chevrolet', name: 'Chevrolet', type: 'agency' },
    { id: 'ford', name: 'Ford', type: 'agency' },
    
    // New bodegas
    { id: 'bodega_coyote', name: 'Bodega Coyote', type: 'bodega' },
    { id: 'bodega_goyo', name: 'Bodega Goyo', type: 'bodega' }
  ];

  res.status(200).json({
    success: true,
    locations: locations,
    totalLocations: locations.length,
    agencies: locations.filter(loc => loc.type === 'agency').length,
    bodegas: locations.filter(loc => loc.type === 'bodega').length
  });
}));

module.exports = router;
