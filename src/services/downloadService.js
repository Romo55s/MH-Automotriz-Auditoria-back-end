const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { GoogleSheetsError } = require('../middleware/errorHandler');

class DownloadService {
  constructor() {
    this.tempDir = path.join(__dirname, '../../temp');
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Generate CSV file from inventory data
  async generateCSV(inventoryData) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${inventoryData.agency}_${inventoryData.month}_${inventoryData.year}_${timestamp}.csv`;
      const filepath = path.join(this.tempDir, filename);

      console.log(`📊 Generating CSV with ${inventoryData.scans.length} scans`);

      const csvWriter = createCsvWriter({
        path: filepath,
        header: [
          { id: 'date', title: 'Date' },
          { id: 'identifier', title: 'Identifier' },
          { id: 'scannedBy', title: 'Scanned By' },
          { id: 'serie', title: 'Serie' },
          { id: 'marca', title: 'Marca' },
          { id: 'color', title: 'Color' },
          { id: 'ubicaciones', title: 'Ubicaciones' }
        ]
      });

      // Prepare data for CSV - Enhanced with car data
      const csvData = inventoryData.scans.map(scan => ({
        date: scan.date,
        identifier: scan.identifier || scan.barcode, // Support both formats
        scannedBy: scan.scannedBy || '',
        serie: scan.serie || '',
        marca: scan.marca || '',
        color: scan.color || '',
        ubicaciones: scan.ubicaciones || ''
      }));

      console.log(`📊 CSV data prepared:`, csvData.slice(0, 3)); // Log first 3 rows for debugging

      await csvWriter.writeRecords(csvData);

      return {
        filename,
        filepath,
        size: fs.statSync(filepath).size,
        type: 'csv'
      };
    } catch (error) {
      console.error(`❌ CSV generation error:`, error);
      throw new GoogleSheetsError(`Failed to generate CSV: ${error.message}`);
    }
  }

  // Generate Excel file from inventory data
  async generateExcel(inventoryData) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${inventoryData.agency}_${inventoryData.month}_${inventoryData.year}_${timestamp}.xlsx`;
      const filepath = path.join(this.tempDir, filename);

      console.log(`📊 Generating Excel with ${inventoryData.scans.length} scans`);

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Prepare data for Excel - Enhanced with car data
      const excelData = [
        // Header row
        ['Date', 'Identifier', 'Scanned By', 'Serie', 'Marca', 'Color', 'Ubicaciones'],
        // Data rows
        ...inventoryData.scans.map(scan => [
          scan.date,
          scan.identifier || scan.barcode, // Support both formats
          scan.scannedBy || '',
          scan.serie || '',
          scan.marca || '',
          scan.color || '',
          scan.ubicaciones || ''
        ])
      ];

      console.log(`📊 Excel data prepared:`, excelData.slice(0, 4)); // Log first 4 rows for debugging

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Data');

      // Write file
      XLSX.writeFile(workbook, filepath);

      console.log(`✅ Excel file generated: ${filepath}`);

      return {
        filename,
        filepath,
        size: fs.statSync(filepath).size,
        type: 'excel'
      };
    } catch (error) {
      console.error(`❌ Excel generation error:`, error);
      throw new GoogleSheetsError(`Failed to generate Excel file: ${error.message}`);
    }
  }

  // Clean up temporary files
  cleanupFile(filepath) {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`✅ Cleaned up temporary file: ${filepath}`);
      }
    } catch (error) {
      console.error(`❌ Failed to cleanup file ${filepath}:`, error);
    }
  }

  // Clean up old temporary files (older than 1 hour)
  cleanupOldFiles() {
    try {
      const files = fs.readdirSync(this.tempDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      files.forEach(file => {
        const filepath = path.join(this.tempDir, file);
        const stats = fs.statSync(filepath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          this.cleanupFile(filepath);
        }
      });
    } catch (error) {
      console.error('❌ Failed to cleanup old files:', error);
    }
  }
}

module.exports = new DownloadService();
