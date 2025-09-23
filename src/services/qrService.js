const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const csv = require('csv-parse');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { ValidationError, GoogleSheetsError } = require('../middleware/errorHandler');
const { validateCSVRowData, validateQRData, validateSerie } = require('../utils/validation');

class QRService {
  constructor() {
    this.tempDir = path.join(__dirname, '../../temp');
    this.ensureTempDirectory();
  }

  // Ensure temp directory exists
  ensureTempDirectory() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Parse CSV file and validate structure
  async parseCSVFile(filePath) {
    try {
      
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const records = [];
      
      return new Promise((resolve, reject) => {
        csv.parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        }, (err, data) => {
          if (err) {
            reject(new ValidationError(`Failed to parse CSV file: ${err.message}`));
            return;
          }

          // Validate required columns
          const requiredColumns = ['serie', 'marca', 'color', 'ubicaciones'];
          if (data.length === 0) {
            reject(new ValidationError('CSV file is empty'));
            return;
          }

          const firstRow = data[0];
          const missingColumns = requiredColumns.filter(col => 
            !Object.keys(firstRow).some(key => key.toLowerCase() === col.toLowerCase())
          );

          if (missingColumns.length > 0) {
            reject(new ValidationError(`Missing required columns: ${missingColumns.join(', ')}`));
            return;
          }

          // Normalize column names and validate data
          const normalizedData = data.map((row, index) => {
            const normalizedRow = {};
            
            // Find columns case-insensitively
            Object.keys(row).forEach(key => {
              const normalizedKey = key.toLowerCase().trim();
              if (requiredColumns.includes(normalizedKey)) {
                normalizedRow[normalizedKey] = row[key]?.toString().trim() || '';
              }
            });

            // Validate row data
            const missingFields = requiredColumns.filter(col => !normalizedRow[col]);
            if (missingFields.length > 0) {
              throw new ValidationError(`Row ${index + 2} is missing data for: ${missingFields.join(', ')}`);
            }

            // Validate using comprehensive validation
            const validation = validateCSVRowData(normalizedRow);
            if (!validation.isValid) {
              throw new ValidationError(`Row ${index + 2} validation failed: ${validation.errors.join(', ')}`);
            }

            return {
              ...normalizedRow,
              rowNumber: index + 2 // +2 because CSV is 1-based and we skip header
            };
          });

          resolve(normalizedData);
        });
      });
    } catch (error) {
      console.error(`❌ Error parsing CSV file:`, error);
      throw error instanceof ValidationError ? error : new ValidationError(`Failed to parse CSV file: ${error.message}`);
    }
  }

  // Generate QR code data string
  generateQRData(record, location) {
    // Create QR data in JSON format for easy parsing when scanned
    const qrData = {
      serie: record.serie,
      marca: record.marca,
      color: record.color,
      ubicaciones: record.ubicaciones,
      location: location,
      timestamp: new Date().toISOString(),
      type: 'car_inventory'
    };
    
    return JSON.stringify(qrData);
  }

  // Generate 5x5cm QR code with super big QR and small text
  async generateQRCodeImage(data, filename, carInfo, targetDir = null) {
    try {
      // Use provided directory or default temp directory
      const outputDir = targetDir || this.tempDir;
      const qrImagePath = path.join(outputDir, filename);
      
      // Calculate size for 5x5 cm at 300 DPI (print quality)
      // 5 cm = ~590 pixels at 300 DPI
      const canvasSize = 590; // 5x5 cm at 300 DPI
      const qrSize = 560; // Much bigger QR code to match your mockup
      const margin = 20;
      const textHeight = 40; // Smaller space for text
      const totalWidth = canvasSize;
      const totalHeight = canvasSize;
      
      // Generate QR code (clean format like your example)
      const qrBuffer = await QRCode.toBuffer(data, {
        type: 'png',
        width: qrSize,
        margin: 4,  // Standard quiet zone like your example
        color: {
          dark: '#000000',  // Pure black
          light: '#FFFFFF'  // Pure white
        },
        errorCorrectionLevel: 'M'
      });
      
      // Load QR code image
      const qrImage = await loadImage(qrBuffer);
      
      // Create canvas for 5x5cm
      const canvas = createCanvas(totalWidth, totalHeight);
      const ctx = canvas.getContext('2d');
      
      // Fill background with white
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, totalWidth, totalHeight);
      
      // Draw bigger QR code at the top (like your mockup)
      const qrX = (canvasSize - qrSize) / 2; // Center horizontally
      const qrY = margin; // Top margin
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
      
      // Add text below QR code in horizontal row (flex-row)
      const textStartY = qrY + qrSize + 4; // Start text closer to QR
      const textX = canvasSize / 2; // Center text
      
      // Configure text style
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      
      // Create horizontal layout: Serie | Marca-Color | Ubicaciones
      const textY = textStartY;
      const separator = ' | '; // Separator between items
      
      // Combine all text in one line
      const fullText = `${carInfo.serie}${separator}${carInfo.marca} - ${carInfo.color}${separator}${carInfo.ubicaciones}`;
      
      // Draw the combined text
      ctx.font = '14px Arial';
      ctx.fillText(fullText, textX, textY);
      
      // Save the canvas as PNG
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(qrImagePath, buffer);
      
      return qrImagePath;
    } catch (error) {
      throw new Error(`Failed to generate QR code image: ${error.message}`);
    }
  }

  // Generate QR codes for all CSV records
  async generateQRCodes(csvData, location, user, userName) {
    try {
      const qrCodePaths = [];
      const sessionId = `qr_${Date.now()}`;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Create a folder for this batch
      const batchFolderName = `QR_Codes_${location}_${timestamp}`;
      const batchFolderPath = path.join(this.tempDir, batchFolderName);
      
      if (!fs.existsSync(batchFolderPath)) {
        fs.mkdirSync(batchFolderPath, { recursive: true });
      }

      // Generate QR codes for each record
      for (let i = 0; i < csvData.length; i++) {
        const record = csvData[i];
        
        // Generate QR data
        const qrData = this.generateQRData(record, location);
        
        // Create filename
        const filename = `QR_${record.serie}_${record.marca}_${i + 1}.png`.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        // Generate enhanced QR code image with car information
        const qrImagePath = await this.generateQRCodeImage(qrData, filename, {
          serie: record.serie,
          marca: record.marca,
          color: record.color,
          ubicaciones: record.ubicaciones
        }, batchFolderPath);
        
        // Verify the file was created
        if (!fs.existsSync(qrImagePath)) {
          throw new Error(`Failed to create QR code image: ${qrImagePath}`);
        }
        
        const stats = fs.statSync(qrImagePath);
        
        qrCodePaths.push({
          imagePath: qrImagePath,
          filename: filename,
          data: record,
          qrData: qrData
        });
      }

      // Create info file with metadata
      const infoFile = path.join(batchFolderPath, 'QR_Codes_Info.txt');
      const infoContent = [
        `Enhanced QR Codes Generation Report`,
        `===================================`,
        `Generated on: ${new Date().toLocaleString()}`,
        `Location: ${location}`,
        `Generated by: ${userName} (${user})`,
        `Session ID: ${sessionId}`,
        `Total QR Codes: ${qrCodePaths.length}`,
        `Size: 5x5 cm (590x590 pixels at 300 DPI)`,
        `QR Code Size: 560x560 pixels (Large format for easy scanning)`,
        `Features: Large QR Code + Horizontal Car Information Text`,
        ``,
        `QR Code Details:`,
        `================`
      ];

      qrCodePaths.forEach((qr, index) => {
        infoContent.push(`${index + 1}. ${qr.filename}`);
        infoContent.push(`   Serie: ${qr.data.serie}`);
        infoContent.push(`   Marca: ${qr.data.marca}`);
        infoContent.push(`   Color: ${qr.data.color}`);
        infoContent.push(`   Ubicaciones: ${qr.data.ubicaciones}`);
        infoContent.push('');
      });

      fs.writeFileSync(infoFile, infoContent.join('\n'));


      return {
        success: true,
        sessionId: sessionId,
        batchFolder: batchFolderPath,
        batchFolderName: batchFolderName,
        qrCodes: qrCodePaths,
        totalGenerated: qrCodePaths.length,
        location: location,
        generatedBy: userName,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error generating QR codes:`, error);
      throw new Error(`Failed to generate QR codes: ${error.message}`);
    }
  }

  // Create ZIP file with all QR codes
  async createQRCodesZip(qrResult) {
    try {
      
      // Use sessionId for consistent naming
      const zipFilename = `${qrResult.sessionId}.zip`;
      const zipFilePath = path.join(this.tempDir, zipFilename);
      
      return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', {
          zlib: { level: 9 } // Maximum compression
        });

        output.on('close', () => {
          const stats = fs.statSync(zipFilePath);
          resolve({
            zipPath: zipFilePath,
            zipFilename: zipFilename,
            size: stats.size
          });
        });

        archive.on('error', (err) => {
          console.error(`❌ ZIP creation error:`, err);
          reject(err);
        });

        archive.pipe(output);

        // Add all files from the batch folder
        archive.directory(qrResult.batchFolder, false);

        archive.finalize();
      });
    } catch (error) {
      console.error(`❌ Error creating ZIP file:`, error);
      throw new Error(`Failed to create ZIP file: ${error.message}`);
    }
  }

  // Parse QR code data when scanned
  parseQRData(qrString) {
    try {
      const qrData = JSON.parse(qrString);
      
      // Use comprehensive validation
      const validation = validateQRData(qrData);
      if (!validation.isValid) {
        throw new ValidationError(`Invalid QR code data: ${validation.errors.join(', ')}`);
      }

      return {
        serie: qrData.serie,
        marca: qrData.marca,
        color: qrData.color,
        ubicaciones: qrData.ubicaciones,
        location: qrData.location,
        timestamp: qrData.timestamp,
        scannedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Invalid QR code format. Expected JSON format with car inventory data.');
    }
  }

  // Clean up temporary files
  async cleanupFiles(filePaths) {
    try {
      const pathsArray = Array.isArray(filePaths) ? filePaths : [filePaths];
      
      for (const filePath of pathsArray) {
        if (fs.existsSync(filePath)) {
          if (fs.lstatSync(filePath).isDirectory()) {
            // Remove directory recursively
            fs.rmSync(filePath, { recursive: true, force: true });
            console.log(`🧹 Cleaned up directory: ${filePath}`);
          } else {
            // Remove file
            fs.unlinkSync(filePath);
            console.log(`🧹 Cleaned up file: ${filePath}`);
          }
        }
      }
    } catch (error) {
      console.error(`⚠️ Cleanup warning:`, error.message);
      // Don't throw error for cleanup failures
    }
  }

  // Clean up old temporary files (older than 1 hour)
  cleanupOldFiles() {
    try {
      const files = fs.readdirSync(this.tempDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          console.log(`🧹 Cleaned up old file: ${file}`);
        }
      });
    } catch (error) {
      console.error(`⚠️ Old files cleanup warning:`, error.message);
    }
  }
}

module.exports = new QRService();
