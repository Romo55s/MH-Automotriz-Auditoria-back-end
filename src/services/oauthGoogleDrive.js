const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { GoogleSheetsError } = require('../middleware/errorHandler');
const config = require('../config/googleSheets');

class OAuthGoogleDriveService {
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

      // Use OAuth credentials for Google Drive
      if (process.env.GOOGLE_DRIVE_CREDENTIALS_BASE64) {
        console.log('📁 Using OAuth Google Drive credentials (Base64)');
        const credentialsBase64 = process.env.GOOGLE_DRIVE_CREDENTIALS_BASE64;
        const credentialsData = JSON.parse(Buffer.from(credentialsBase64, 'base64').toString('utf8'));
        
        // Handle OAuth 2.0 credentials format
        if (credentialsData.installed) {
          credentials = credentialsData.installed;
        } else {
          credentials = credentialsData;
        }
      } else if (process.env.GOOGLE_DRIVE_CREDENTIALS_PATH) {
        console.log('📁 Using OAuth Google Drive credentials (File Path)');
        const credentialsPath = process.env.GOOGLE_DRIVE_CREDENTIALS_PATH;
        const resolvedPath = path.resolve(credentialsPath);
        const credentialsData = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        
        // Handle OAuth 2.0 credentials format
        if (credentialsData.installed) {
          credentials = credentialsData.installed;
        } else {
          credentials = credentialsData;
        }
      } else {
        throw new Error('Neither GOOGLE_DRIVE_CREDENTIALS_BASE64 nor GOOGLE_DRIVE_CREDENTIALS_PATH environment variable is set');
      }

      // Create OAuth2 client
      this.auth = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        'urn:ietf:wg:oauth:2.0:oob' // For desktop applications
      );

      // Set refresh token if available
      if (process.env.GOOGLE_REFRESH_TOKEN) {
        this.auth.setCredentials({
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        });
        console.log('✅ OAuth credentials set from environment variables');
        console.log('🔍 Environment Variables Debug:');
        console.log('  - GOOGLE_REFRESH_TOKEN:', process.env.GOOGLE_REFRESH_TOKEN ? 'Present' : 'Missing');
        console.log('  - GOOGLE_ACCESS_TOKEN:', process.env.GOOGLE_ACCESS_TOKEN ? 'Present' : 'Missing');
        console.log('  - GOOGLE_DRIVE_CREDENTIALS_PATH:', process.env.GOOGLE_DRIVE_CREDENTIALS_PATH || 'Not set');
      } else {
        console.log('⚠️ No OAuth tokens found in environment variables');
        console.log('🔍 Available environment variables:');
        console.log('  - GOOGLE_REFRESH_TOKEN:', process.env.GOOGLE_REFRESH_TOKEN ? 'Present' : 'Missing');
        console.log('  - GOOGLE_ACCESS_TOKEN:', process.env.GOOGLE_ACCESS_TOKEN ? 'Present' : 'Missing');
        console.log('  - GOOGLE_DRIVE_CREDENTIALS_PATH:', process.env.GOOGLE_DRIVE_CREDENTIALS_PATH || 'Not set');
      }

      // Add API key for download operations
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_DRIVE_API_KEY;
      if (apiKey) {
        console.log('✅ Google API key found for download operations');
        this.drive = google.drive({ 
          version: 'v3', 
          auth: this.auth,
          key: apiKey
        });
      } else {
        console.log('⚠️ No Google API key found - download operations may fail');
        this.drive = google.drive({ version: 'v3', auth: this.auth });
      }
      
      this.initialized = true;
      console.log('✅ OAuth Google Drive service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize OAuth Google Drive service:', error);
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Get OAuth URL for authorization
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file'
    ];

    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  // Exchange authorization code for tokens
  async getTokens(code) {
    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    return tokens;
  }

  // Create location-specific folder
  async ensureLocationFolder(locationName, parentFolderId) {
    await this.ensureInitialized();
    
    try {
      // Check if location folder already exists
      const query = `'${parentFolderId}' in parents and name='${locationName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id,name)'
      });

      if (response.data.files.length > 0) {
        const folderId = response.data.files[0].id;
        console.log(`✅ Location folder exists: ${locationName} (${folderId})`);
        return folderId;
      }

      // Create location folder
      const folderMetadata = {
        name: locationName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      };

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id,name'
      });

      console.log(`✅ Created location folder: ${locationName} (${folder.data.id})`);
      return folder.data.id;
    } catch (error) {
      console.error(`❌ Failed to create location folder ${locationName}:`, error);
      throw new GoogleSheetsError(`Failed to create location folder: ${error.message}`);
    }
  }

  // Upload file to Google Drive
  async uploadFile(filePath, metadata, parentFolderId) {
    await this.ensureInitialized();

    try {
      // Create location-specific folder
      const locationFolderId = await this.ensureLocationFolder(metadata.agency, parentFolderId);

      const fileMetadata = {
        name: metadata.filename,
        parents: [locationFolderId], // Store in location-specific folder
        description: `Inventory file for ${metadata.agency} - ${metadata.month} ${metadata.year}`,
        properties: {
          agency: metadata.agency,
          month: metadata.month,
          year: metadata.year,
          type: metadata.type,
          uploadedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString() // 30 days
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
  generateFileMetadata(agency, month, year, type, timestamp, inventoryId = null, createdAt = null) {
    // Create a more organized filename: YYYY-MM-DD_Agency_Month_Year_CreationDate.type
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const monthName = this.getMonthName(month);
    
    // Use creation date if provided and valid, otherwise use current date
    let fileDate = date;
    if (createdAt) {
      const createdDate = new Date(createdAt);
      if (!isNaN(createdDate.getTime())) {
        fileDate = createdDate.toISOString().split('T')[0];
      } else {
        console.log(`⚠️ Invalid createdAt date: ${createdAt}, using current date instead`);
      }
    }
    
    // Include inventory ID for uniqueness when multiple inventories per month
    let filename;
    if (inventoryId) {
      // Extract short inventory ID (last 8 characters of UUID)
      const shortInventoryId = inventoryId.replace('inv_', '').slice(-8);
      filename = `${fileDate}_${agency}_${monthName}_${year}_${shortInventoryId}.${type}`;
    } else {
      filename = `${fileDate}_${agency}_${monthName}_${year}.${type}`;
    }

    return {
      filename,
      agency,
      month,
      year,
      type,
      timestamp,
      inventoryId
    };
  }

  // Get month name from number
  getMonthName(month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[parseInt(month) - 1] || 'Unknown';
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
      console.error(`❌ Failed to delete file ${fileId}:`, error.message);
      throw new GoogleSheetsError(`Failed to delete file: ${error.message}`);
    }
  }

  // Get file information
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
        size: parseInt(file.data.size) || 0,
        webViewLink: file.data.webViewLink,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${file.data.id}`,
        mimeType: file.data.mimeType,
        createdTime: file.data.createdTime
      };
    } catch (error) {
      throw new GoogleSheetsError(`Failed to get file: ${error.message}`);
    }
  }

  // List files in a specific folder
  async listFilesInFolder(parentFolderId, agencyName) {
    try {
      await this.ensureInitialized();
      
      // Debug: Check OAuth client credentials
      console.log('🔍 OAuth Client Debug Info:');
      console.log('  - Client ID:', this.auth._clientId);
      console.log('  - Has credentials:', !!this.auth.credentials);
      console.log('  - Access token:', this.auth.credentials?.access_token ? 'Present' : 'Missing');
      console.log('  - Refresh token:', this.auth.credentials?.refresh_token ? 'Present' : 'Missing');
      
      // First, find the agency folder
      const agencyFolderId = await this.ensureLocationFolder(agencyName, parentFolderId);
      
      // List files in the agency folder
      const drive = google.drive({ version: 'v3', auth: this.auth });
      
      const response = await drive.files.list({
        q: `'${agencyFolderId}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)',
        orderBy: 'modifiedTime desc'
      });
      
      const files = response.data.files.map(file => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: parseInt(file.size) || 0,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink
      }));
      
      console.log(`📁 Found ${files.length} files in ${agencyName} folder`);
      return files;
    } catch (error) {
      console.error(`Error listing files in folder:`, error);
      throw new GoogleSheetsError(`Failed to list files in folder: ${error.message}`);
    }
  }

  // Download file content
  async downloadFile(fileId, filePath = null) {
    try {
      await this.ensureInitialized();
      // Use the initialized Drive client which includes OAuth and API key
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      });
      
      const buffer = Buffer.from(response.data);
      
      // If filePath is provided, write the file to disk
      if (filePath) {
        const fs = require('fs');
        const path = require('path');
        
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write file to disk
        fs.writeFileSync(filePath, buffer);
        console.log(`📁 File written to: ${filePath}`);
      }
      
      return buffer;
    } catch (error) {
      console.error(`Error downloading file:`, error);
      throw new GoogleSheetsError(`Failed to download file: ${error.message}`);
    }
  }
}

module.exports = new OAuthGoogleDriveService();
