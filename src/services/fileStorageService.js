const path = require('path');
const fs = require('fs');
const googleDrive = require('./oauthGoogleDrive');
const downloadService = require('./downloadService');
const inventoryService = require('./inventoryService');
const googleSheets = require('./googleSheets');
const { GoogleSheetsError, ValidationError } = require('../middleware/errorHandler');
const config = require('../config/googleSheets');

class FileStorageService {
  constructor() {
    this.storageSheetName = 'FileStorage';
    this.retentionDays = config.drive.retentionDays;
  }

  // Ensure storage tracking sheet exists
  async ensureStorageSheet() {
    try {
      await googleSheets.ensureSheetExists(this.storageSheetName);
      
      // Check if headers exist, if not add them
      const data = await googleSheets.getSheetData(this.storageSheetName);
      if (data.length === 0) {
        const headers = [
          'File ID', 'Filename', 'Agency', 'Month', 'Year', 'Type', 
          'Size', 'Uploaded At', 'Expires At', 'Download Count', 'Status'
        ];
        await googleSheets.appendRow(this.storageSheetName, headers);
        console.log('✅ Created FileStorage sheet with headers');
      }
    } catch (error) {
      throw new GoogleSheetsError(`Failed to ensure storage sheet: ${error.message}`);
    }
  }

  // Store inventory file on Google Drive (simplified - no Google Sheets tracking)
  async storeInventoryFile(agency, month, year, fileType = 'csv', inventoryId = null) {
    try {
      console.log(`\n📁 === STORE INVENTORY FILE ===`);
      console.log(`📋 Storing: ${agency} - ${month} ${year} (${fileType})`);
      if (inventoryId) {
        console.log(`🆔 Inventory ID: ${inventoryId}`);
      }

      // Get inventory data from the agency sheet
      const inventoryData = await inventoryService.getInventoryDataForDownload(agency, month, year);
      
      // Generate file locally first
      let fileInfo;
      if (fileType === 'csv') {
        fileInfo = await downloadService.generateCSV(inventoryData);
      } else if (fileType === 'xlsx') {
        fileInfo = await downloadService.generateExcel(inventoryData);
      } else {
        throw new ValidationError(`Unsupported file type: ${fileType}`);
      }

      console.log(`📊 Generated ${fileType} file: ${fileInfo.filename}`);

      // Generate metadata for Google Drive with inventory ID and creation date for uniqueness
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Handle createdAt format - it might be in human-readable format from formatDate()
      let createdAt = new Date().toISOString(); // Default to current time
      if (inventoryData.createdAt) {
        // Try to parse the createdAt date
        const parsedDate = new Date(inventoryData.createdAt);
        if (!isNaN(parsedDate.getTime())) {
          createdAt = parsedDate.toISOString();
        } else {
          console.log(`⚠️ Could not parse createdAt: ${inventoryData.createdAt}, using current time`);
        }
      }
      
      const metadata = googleDrive.generateFileMetadata(agency, month, year, fileType, timestamp, inventoryId, createdAt);

      // Upload to Google Drive
      const folderId = process.env.GOOGLE_DRIVE_INVENTORY_FOLDER_ID || 'root';
      const driveFile = await googleDrive.uploadFile(fileInfo.filepath, metadata, folderId);
      console.log(`☁️ Uploaded to Google Drive: ${driveFile.name} (${driveFile.fileId})`);

      // Clean up local file
      downloadService.cleanupFile(fileInfo.filepath);

      console.log(`✅ File stored successfully: ${driveFile.name}`);
      console.log(`🏁 === STORE INVENTORY FILE COMPLETE ===\n`);

      return {
        success: true,
        fileId: driveFile.fileId,
        filename: driveFile.name,
        downloadUrl: driveFile.downloadUrl,
        webViewLink: driveFile.webViewLink,
        size: driveFile.size,
        message: 'File stored successfully on Google Drive'
      };
    } catch (error) {
      console.error(`❌ Error storing inventory file:`, error);
      if (error instanceof ValidationError || error instanceof GoogleSheetsError) {
        throw error;
      }
      throw new GoogleSheetsError(`Failed to store inventory file: ${error.message}`);
    }
  }

  // Get stored files for an agency/month/year
  async getStoredFiles(agency, month, year) {
    try {
      await this.ensureStorageSheet();

      const data = await googleSheets.getSheetData(this.storageSheetName);
      
      // Filter files for the specific agency/month/year
      const files = data.filter(row => {
        if (row.length < 8) return false;
        return row[2] === agency && 
               row[3] === month && 
               row[4] === year &&
               row[10] === 'Active'; // Status = Active
      });

      return files.map(row => ({
        fileId: row[0],
        filename: row[1],
        agency: row[2],
        month: row[3],
        year: row[4],
        type: row[5],
        size: parseInt(row[6]) || 0,
        uploadedAt: row[7],
        expiresAt: row[8],
        downloadCount: parseInt(row[9]) || 0,
        status: row[10]
      }));
    } catch (error) {
      throw new GoogleSheetsError(`Failed to get stored files: ${error.message}`);
    }
  }

  // Get all stored files
  async getAllStoredFiles(filters = {}) {
    try {
      await this.ensureStorageSheet();

      const data = await googleSheets.getSheetData(this.storageSheetName);
      
      // Skip header row
      const files = data.slice(1).filter(row => {
        if (row.length < 8) return false;
        
        // Apply filters
        if (filters.agency && row[2] !== filters.agency) return false;
        if (filters.month && row[3] !== filters.month) return false;
        if (filters.year && row[4] !== filters.year) return false;
        if (filters.type && row[5] !== filters.type) return false;
        if (filters.status && row[10] !== filters.status) return false;
        
        return true;
      });

      return files.map(row => ({
        fileId: row[0],
        filename: row[1],
        agency: row[2],
        month: row[3],
        year: row[4],
        type: row[5],
        size: parseInt(row[6]) || 0,
        uploadedAt: row[7],
        expiresAt: row[8],
        downloadCount: parseInt(row[9]) || 0,
        status: row[10]
      }));
    } catch (error) {
      throw new GoogleSheetsError(`Failed to get all stored files: ${error.message}`);
    }
  }

  // Download file from Google Drive
  async downloadStoredFile(fileId) {
    try {
      console.log(`\n📥 === DOWNLOAD STORED FILE ===`);
      console.log(`📋 Downloading file: ${fileId}`);

      // Get file info from Google Drive
      const driveFile = await googleDrive.getFile(fileId);
      console.log(`☁️ File found on Google Drive: ${driveFile.name}`);

      // Update download count in tracking sheet
      await this.incrementDownloadCount(fileId);

      // Create temporary file for download
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `download_${Date.now()}_${driveFile.name}`);
      
      // Download file from Google Drive
      await googleDrive.downloadFile(fileId, tempFilePath);
      console.log(`📥 File downloaded to: ${tempFilePath}`);

      // Verify file was created
      if (!fs.existsSync(tempFilePath)) {
        throw new Error(`File was not created at path: ${tempFilePath}`);
      }

      console.log(`✅ File ready for download: ${driveFile.name}`);

      return {
        success: true,
        filepath: tempFilePath,
        filename: driveFile.name,
        size: driveFile.size,
        mimeType: driveFile.mimeType,
        downloadUrl: driveFile.downloadUrl
      };
    } catch (error) {
      console.error(`❌ Error downloading stored file:`, error);
      throw new GoogleSheetsError(`Failed to download stored file: ${error.message}`);
    }
  }

  // Increment download count
  async incrementDownloadCount(fileId) {
    try {
      const data = await googleSheets.getSheetData(this.storageSheetName);
      
      const rowIndex = data.findIndex(row => {
        if (row.length < 1) return false;
        return row[0] === fileId;
      });

      if (rowIndex !== -1) {
        const currentCount = parseInt(data[rowIndex][9]) || 0;
        const newCount = currentCount + 1;
        
        // Update download count (column 10)
        data[rowIndex][9] = newCount.toString();
        
        await googleSheets.updateRow(this.storageSheetName, rowIndex + 1, data[rowIndex]);
        console.log(`📊 Updated download count for ${fileId}: ${currentCount} → ${newCount}`);
      }
    } catch (error) {
      console.error(`❌ Error incrementing download count:`, error);
      // Don't throw error here as it's not critical
    }
  }

  // Clean up expired files
  async cleanupExpiredFiles() {
    try {
      console.log(`\n🧹 === CLEANUP EXPIRED FILES ===`);
      
      await this.ensureStorageSheet();

      const data = await googleSheets.getSheetData(this.storageSheetName);
      const now = new Date();
      
      // Find expired files
      const expiredFiles = data.filter(row => {
        if (row.length < 9 || row[10] !== 'Active') return false;
        
        const expiresAt = new Date(row[8]);
        return expiresAt < now;
      });

      console.log(`📊 Found ${expiredFiles.length} expired files to clean up`);

      const results = [];
      for (const file of expiredFiles) {
        try {
          const fileId = file[0];
          const filename = file[1];
          
          console.log(`🗑️ Cleaning up expired file: ${filename} (${fileId})`);
          
          // Delete from Google Drive
          const driveResult = await googleDrive.deleteFile(fileId);
          
          // Update status in tracking sheet
          const rowIndex = data.findIndex(row => row[0] === fileId);
          if (rowIndex !== -1) {
            data[rowIndex][10] = 'Expired'; // Status
            await googleSheets.updateRow(this.storageSheetName, rowIndex + 1, data[rowIndex]);
          }
          
          results.push({
            fileId,
            filename,
            success: true,
            message: 'File cleaned up successfully'
          });
          
          console.log(`✅ Cleaned up: ${filename}`);
        } catch (error) {
          console.error(`❌ Failed to cleanup file ${file[1]}:`, error);
          results.push({
            fileId: file[0],
            filename: file[1],
            success: false,
            error: error.message
          });
        }
      }

      console.log(`🏁 === CLEANUP EXPIRED FILES COMPLETE ===\n`);
      console.log(`📊 Results: ${results.filter(r => r.success).length} successful, ${results.filter(r => !r.success).length} failed`);

      return {
        totalFiles: expiredFiles.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      console.error(`❌ Error cleaning up expired files:`, error);
      throw new GoogleSheetsError(`Failed to cleanup expired files: ${error.message}`);
    }
  }

  // Get file statistics
  async getFileStatistics() {
    try {
      await this.ensureStorageSheet();

      const data = await googleSheets.getSheetData(this.storageSheetName);
      const files = data.slice(1).filter(row => row.length >= 8);

      const stats = {
        totalFiles: files.length,
        activeFiles: files.filter(f => f[10] === 'Active').length,
        expiredFiles: files.filter(f => f[10] === 'Expired').length,
        totalSize: files.reduce((sum, f) => sum + (parseInt(f[6]) || 0), 0),
        totalDownloads: files.reduce((sum, f) => sum + (parseInt(f[9]) || 0), 0),
        byAgency: {},
        byType: {},
        byMonth: {}
      };

      // Group by agency
      files.forEach(file => {
        const agency = file[2];
        const type = file[5];
        const month = file[3];
        
        stats.byAgency[agency] = (stats.byAgency[agency] || 0) + 1;
        stats.byType[type] = (stats.byType[type] || 0) + 1;
        stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
      });

      return stats;
    } catch (error) {
      throw new GoogleSheetsError(`Failed to get file statistics: ${error.message}`);
    }
  }

  // Get stored files by agency (from Google Drive directly)
  async getStoredFilesByAgency(agency) {
    try {
      console.log(`\n📁 === GET STORED FILES BY AGENCY ===`);
      console.log(`📋 Agency: ${agency}`);

      // Get the main inventory folder
      const folderId = process.env.GOOGLE_DRIVE_INVENTORY_FOLDER_ID || 'root';
      
      // List files in the agency folder
      const files = await googleDrive.listFilesInFolder(folderId, agency);
      
      console.log(`📊 Found ${files.length} files for ${agency}`);
      files.forEach(file => {
        console.log(`  📄 ${file.name} (${file.id})`);
      });

      return files;
    } catch (error) {
      console.error(`Error getting stored files for ${agency}:`, error);
      throw new GoogleSheetsError(`Failed to get stored files for ${agency}: ${error.message}`);
    }
  }

}

module.exports = new FileStorageService();
