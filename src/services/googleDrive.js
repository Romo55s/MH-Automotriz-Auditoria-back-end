const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { GoogleSheetsError } = require('../middleware/errorHandler');
const config = require('../config/googleSheets');

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.auth = null;
    this.initialized = false;
    this.inventoryFolderId = config.drive.inventoryFolderId;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      let credentials;

      // Check for base64 encoded credentials first (for Render deployment)
      if (process.env.GOOGLE_CREDENTIALS_BASE64) {
        console.log('🔐 Using base64 encoded Google credentials for Drive API');
        const base64Credentials = process.env.GOOGLE_CREDENTIALS_BASE64;
        
        // Validate base64 string length
        if (base64Credentials.length < 1000) {
          throw new Error(`Base64 credentials too short (${base64Credentials.length} chars). Expected ~2000+ chars. Check if the environment variable was truncated.`);
        }
        
        try {
          const credentialsJson = Buffer.from(base64Credentials, 'base64').toString('utf8');
          credentials = JSON.parse(credentialsJson);
          console.log(`✅ Successfully parsed base64 credentials for Drive API (${credentialsJson.length} chars)`);
        } catch (parseError) {
          console.error('❌ Failed to parse base64 credentials for Drive API:', parseError.message);
          throw new Error(`Invalid base64 credentials: ${parseError.message}`);
        }
      }
      // Fallback to file-based credentials (for local development)
      else if (process.env.GOOGLE_SHEETS_CREDENTIALS_PATH) {
        console.log('📁 Using file-based Google credentials for Drive API');
        const credentialsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
        const resolvedPath = path.resolve(credentialsPath);
        credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      }
      else {
        throw new Error('Neither GOOGLE_CREDENTIALS_BASE64 nor GOOGLE_SHEETS_CREDENTIALS_PATH environment variable is set');
      }
      
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive'
        ]
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.initialized = true;
      console.log('✅ Google Drive service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive service:', error);
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Create inventory folder if it doesn't exist
  async ensureInventoryFolder() {
    await this.ensureInitialized();
    
    try {
      // Check if folder already exists
      if (this.inventoryFolderId !== 'root') {
        try {
          const folder = await this.drive.files.get({
            fileId: this.inventoryFolderId,
            fields: 'id,name'
          });
          console.log(`✅ Inventory folder exists: ${folder.data.name} (${this.inventoryFolderId})`);
          return this.inventoryFolderId;
        } catch (error) {
          if (error.code === 404) {
            console.log('📁 Inventory folder not found, creating new one...');
          } else {
            throw error;
          }
        }
      }

      // Create inventory folder
      const folderMetadata = {
        name: 'Car Inventory Files',
        mimeType: 'application/vnd.google-apps.folder',
        parents: this.inventoryFolderId === 'root' ? [] : [this.inventoryFolderId]
      };

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id,name'
      });

      this.inventoryFolderId = folder.data.id;
      console.log(`✅ Created inventory folder: ${folder.data.name} (${this.inventoryFolderId})`);
      
      return this.inventoryFolderId;
    } catch (error) {
      console.error('❌ Failed to ensure inventory folder:', error);
      throw new GoogleSheetsError(`Failed to create inventory folder: ${error.message}`);
    }
  }

  // Upload file to Google Drive
  async uploadFile(filePath, metadata) {
    await this.ensureInitialized();
    await this.ensureInventoryFolder();

    try {
      const fileMetadata = {
        name: metadata.filename,
        parents: [this.inventoryFolderId],
        description: `Inventory file for ${metadata.agency} - ${metadata.month} ${metadata.year}`,
        properties: {
          agency: metadata.agency,
          month: metadata.month,
          year: metadata.year,
          type: metadata.type,
          uploadedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + (config.drive.retentionDays * 24 * 60 * 60 * 1000)).toISOString()
        }
      };

      const media = {
        mimeType: this.getMimeType(metadata.type),
        body: fs.createReadStream(filePath)
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,webViewLink,size,createdTime,properties'
      });

      console.log(`✅ File uploaded to Google Drive: ${file.data.name} (${file.data.id})`);
      
      return {
        fileId: file.data.id,
        name: file.data.name,
        webViewLink: file.data.webViewLink,
        size: parseInt(file.data.size),
        createdTime: file.data.createdTime,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${file.data.id}`
      };
    } catch (error) {
      console.error('❌ Failed to upload file to Google Drive:', error);
      throw new GoogleSheetsError(`Failed to upload file: ${error.message}`);
    }
  }

  // Get file from Google Drive
  async getFile(fileId) {
    await this.ensureInitialized();

    try {
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'id,name,webViewLink,size,createdTime,properties,mimeType'
      });

      return {
        fileId: file.data.id,
        name: file.data.name,
        webViewLink: file.data.webViewLink,
        size: parseInt(file.data.size),
        createdTime: file.data.createdTime,
        mimeType: file.data.mimeType,
        properties: file.data.properties,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${file.data.id}`
      };
    } catch (error) {
      if (error.code === 404) {
        throw new GoogleSheetsError(`File not found: ${fileId}`);
      }
      console.error('❌ Failed to get file from Google Drive:', error);
      throw new GoogleSheetsError(`Failed to get file: ${error.message}`);
    }
  }

  // Download file from Google Drive
  async downloadFile(fileId, outputPath) {
    await this.ensureInitialized();

    try {
      const dest = fs.createWriteStream(outputPath);
      
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'stream' });

      return new Promise((resolve, reject) => {
        response.data
          .on('end', () => {
            console.log(`✅ File downloaded: ${outputPath}`);
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('❌ Error downloading file:', err);
            reject(new GoogleSheetsError(`Failed to download file: ${err.message}`));
          })
          .pipe(dest);
      });
    } catch (error) {
      console.error('❌ Failed to download file from Google Drive:', error);
      throw new GoogleSheetsError(`Failed to download file: ${error.message}`);
    }
  }

  // List files in inventory folder
  async listFiles(filters = {}) {
    await this.ensureInitialized();
    await this.ensureInventoryFolder();

    try {
      let query = `'${this.inventoryFolderId}' in parents and trashed=false`;
      
      if (filters.agency) {
        query += ` and properties has {key='agency' and value='${filters.agency}'}`;
      }
      if (filters.type) {
        query += ` and name contains '.${filters.type}'`;
      }
      if (filters.month && filters.year) {
        query += ` and properties has {key='month' and value='${filters.month}'} and properties has {key='year' and value='${filters.year}'}`;
      }

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id,name,webViewLink,size,createdTime,properties,mimeType)',
        orderBy: 'createdTime desc'
      });

      return response.data.files.map(file => ({
        fileId: file.id,
        name: file.name,
        webViewLink: file.webViewLink,
        size: parseInt(file.size),
        createdTime: file.createdTime,
        mimeType: file.mimeType,
        properties: file.properties,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`
      }));
    } catch (error) {
      console.error('❌ Failed to list files from Google Drive:', error);
      throw new GoogleSheetsError(`Failed to list files: ${error.message}`);
    }
  }

  // Delete file from Google Drive
  async deleteFile(fileId) {
    await this.ensureInitialized();

    try {
      await this.drive.files.delete({
        fileId: fileId
      });

      console.log(`✅ File deleted from Google Drive: ${fileId}`);
      return { success: true, fileId };
    } catch (error) {
      if (error.code === 404) {
        console.log(`⚠️ File not found for deletion: ${fileId}`);
        return { success: true, fileId, message: 'File not found' };
      }
      console.error('❌ Failed to delete file from Google Drive:', error);
      throw new GoogleSheetsError(`Failed to delete file: ${error.message}`);
    }
  }

  // Clean up expired files
  async cleanupExpiredFiles() {
    await this.ensureInitialized();
    await this.ensureInventoryFolder();

    try {
      const now = new Date();
      const expiredFiles = await this.listFiles();
      
      const filesToDelete = expiredFiles.filter(file => {
        if (!file.properties || !file.properties.expiresAt) {
          return false;
        }
        
        const expiresAt = new Date(file.properties.expiresAt);
        return expiresAt < now;
      });

      console.log(`🧹 Found ${filesToDelete.length} expired files to clean up`);

      const results = [];
      for (const file of filesToDelete) {
        try {
          const result = await this.deleteFile(file.fileId);
          results.push({ ...result, name: file.name });
        } catch (error) {
          console.error(`❌ Failed to delete expired file ${file.name}:`, error);
          results.push({ 
            success: false, 
            fileId: file.fileId, 
            name: file.name, 
            error: error.message 
          });
        }
      }

      return {
        totalFiles: filesToDelete.length,
        deletedFiles: results.filter(r => r.success).length,
        failedFiles: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      console.error('❌ Failed to cleanup expired files:', error);
      throw new GoogleSheetsError(`Failed to cleanup expired files: ${error.message}`);
    }
  }

  // Get MIME type for file type
  getMimeType(type) {
    const mimeTypes = {
      'csv': 'text/csv',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel'
    };
    return mimeTypes[type] || 'application/octet-stream';
  }

  // Generate file metadata
  generateFileMetadata(agency, month, year, type, timestamp) {
    const filename = config.drive.fileNamingPattern
      .replace('{agency}', agency)
      .replace('{month}', month)
      .replace('{year}', year)
      .replace('{type}', type)
      .replace('{timestamp}', timestamp);

    return {
      filename,
      agency,
      month,
      year,
      type,
      timestamp
    };
  }
}

module.exports = new GoogleDriveService();
