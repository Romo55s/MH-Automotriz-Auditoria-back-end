const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { GoogleSheetsError } = require('../middleware/errorHandler');
const config = require('../config/googleSheets');

// Cache for sheet data to reduce API calls
const sheetDataCache = new Map();

// Rate limiting
let lastRequestTime = 0;
let requestCount = 0;
let requestWindowStart = Date.now();

class GoogleSheetsService {
  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    this.auth = null;
    this.sheets = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      let credentials;

      // Check for base64 encoded credentials first (for Render deployment)
      if (process.env.GOOGLE_CREDENTIALS_BASE64) {
        console.log('🔐 Using base64 encoded Google credentials');
        const base64Credentials = process.env.GOOGLE_CREDENTIALS_BASE64;
        
        // Validate base64 string length
        if (base64Credentials.length < 1000) {
          throw new Error(`Base64 credentials too short (${base64Credentials.length} chars). Expected ~2000+ chars. Check if the environment variable was truncated.`);
        }
        
        try {
          const credentialsJson = Buffer.from(base64Credentials, 'base64').toString('utf8');
          credentials = JSON.parse(credentialsJson);
          console.log(`✅ Successfully parsed base64 credentials (${credentialsJson.length} chars)`);
        } catch (parseError) {
          console.error('❌ Failed to parse base64 credentials:', parseError.message);
          console.error(`Base64 length: ${base64Credentials.length} chars`);
          console.error(`First 100 chars: ${base64Credentials.substring(0, 100)}...`);
          console.error(`Last 100 chars: ...${base64Credentials.substring(base64Credentials.length - 100)}`);
          throw new Error(`Invalid base64 credentials: ${parseError.message}`);
        }
      }
      // Fallback to file-based credentials (for local development)
      else if (process.env.GOOGLE_SHEETS_CREDENTIALS_PATH) {
        console.log('📁 Using file-based Google credentials');
        const credentialsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
        const resolvedPath = path.resolve(credentialsPath);
        credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      }
      else {
        throw new Error('Neither GOOGLE_CREDENTIALS_BASE64 nor GOOGLE_SHEETS_CREDENTIALS_PATH environment variable is set');
      }
      
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.initialized = true;
      console.log('✅ Google Sheets service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Google Sheets service:', error);
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Rate limiting function to prevent quota exceeded errors
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    const timeSinceWindowStart = now - requestWindowStart;
    
    // Reset request count every minute
    if (timeSinceWindowStart >= 60000) {
      requestCount = 0;
      requestWindowStart = now;
    }
    
    // Check if we're approaching the rate limit
    const maxRequests = Math.floor(config.quota.readRequestsPerMinute * config.quota.safetyMargin);
    if (requestCount >= maxRequests) {
      const waitTime = 60000 - timeSinceWindowStart;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      requestCount = 0;
      requestWindowStart = Date.now();
    }
    
    // Minimum interval between requests
    if (timeSinceLastRequest < config.rateLimiting.minRequestInterval) {
      const delay = config.rateLimiting.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    lastRequestTime = Date.now();
    requestCount++;
  }

  // Retry mechanism with exponential backoff for quota errors
  async retryWithBackoff(operation, maxRetries = null) {
    const retries = maxRetries || config.retry.maxRetries;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const isQuotaError = error.message && error.message.includes('Quota exceeded');
        
        if (isQuotaError && attempt < retries) {
          const delay = Math.min(
            Math.pow(2, attempt) * config.retry.baseDelay,
            config.retry.maxDelay
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }
  }

  // Get cached data or fetch from API
  getCachedData(sheetName) {
    if (!config.caching.enabled) return null;
    
    const cacheKey = `${this.spreadsheetId}_${sheetName}`;
    const cached = sheetDataCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < config.caching.duration) {
      return cached.data;
    }
    
    return null;
  }

  // Set cached data
  setCachedData(sheetName, data) {
    if (!config.caching.enabled) return;
    
    // Limit cache size
    if (sheetDataCache.size >= config.caching.maxCacheSize) {
      const firstKey = sheetDataCache.keys().next().value;
      sheetDataCache.delete(firstKey);
    }
    
    const cacheKey = `${this.spreadsheetId}_${sheetName}`;
    sheetDataCache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
  }

  // Clear cache for a specific sheet
  clearCache(sheetName = null) {
    if (sheetName) {
      const cacheKey = `${this.spreadsheetId}_${sheetName}`;
      sheetDataCache.delete(cacheKey);
    } else {
      sheetDataCache.clear();
    }
  }

  async ensureSheetExists(sheetName) {
    await this.ensureInitialized();
    
    try {
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const sheetExists = spreadsheet.data.sheets.some(
        sheet => sheet.properties.title === sheetName
      );

      if (!sheetExists) {
        if (sheetName === 'MonthlySummary') {
          // MonthlySummary with all required fields - Updated to use "Location" instead of "Agency"
          const headers = [
            'Month', 'Year', 'Location', 'Status', 'Created At', 'Created By', 'User Name', 
            'Total Scans', 'Session ID', 'Completed At', 'Finished By'
          ];
          await this.createSheet(sheetName, headers);
        } else {
          // Location sheets: simple and clean, only current month data
          // Updated to handle both agencies and bodegas
          const headers = ['Date', 'Identifier', 'Scanned By', 'Serie', 'Marca', 'Color', 'Ubicaciones'];
          await this.createSheet(sheetName, headers);
        }
        console.log(`✅ Created sheet: ${sheetName}`);
      }
    } catch (error) {
      throw new GoogleSheetsError(`Failed to ensure sheet exists: ${error.message}`);
    }
  }

  async createSheet(sheetName, headers = null) {
    try {
      // First, create the sheet
      const response = await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }
          ]
        }
      });

      // If headers are provided, add them to the first row
      if (headers) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [headers] }
        });
      }

      console.log(`✅ Created sheet: ${sheetName}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to create sheet ${sheetName}:`, error);
      throw new GoogleSheetsError(`Failed to create sheet: ${sheetName}`, error);
    }
  }

  async appendRow(sheetName, values) {
    await this.ensureInitialized();
    await this.ensureSheetExists(sheetName);
    
    // Apply rate limiting
    await this.rateLimit();
    
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [values] }
      });
      
      // Clear cache since data has changed
      this.clearCache(sheetName);
      
      return response.data;
    } catch (error) {
      throw new GoogleSheetsError(`Failed to append row to ${sheetName}: ${error.message}`);
    }
  }

  async clearSheet(sheetName) {
    await this.ensureInitialized();
    
    try {
      // Clear all data except headers
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A2:Z`
      });
      
      console.log(`✅ Cleared sheet: ${sheetName}`);
      return true;
    } catch (error) {
      throw new GoogleSheetsError(`Failed to clear sheet ${sheetName}: ${error.message}`);
    }
  }

  async getSheetData(sheetName, range = 'A:Z') {
    await this.ensureInitialized();
    
    // Check cache first
    const cachedData = this.getCachedData(sheetName);
    if (cachedData) {
      return cachedData;
    }
    
    // Apply rate limiting
    await this.rateLimit();
    
    // Ensure the sheet exists before trying to read
    await this.ensureSheetExists(sheetName);
    
    try {
      const data = await this.retryWithBackoff(async () => {
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!${range}`
        });
        return response.data.values || [];
      });
      
      // Cache the data
      this.setCachedData(sheetName, data);
      
      return data;
    } catch (error) {
      console.error('Error reading from Google Sheets:', error);
      
      // Provide more specific error messages based on the error type
      if (error.code === 403) {
        throw new GoogleSheetsError('Access denied to Google Sheets. Please check if the service account has permission to access the spreadsheet.', error);
      } else if (error.code === 404) {
        throw new GoogleSheetsError('Google Sheets document not found. Please check the spreadsheet ID and ensure it exists.', error);
      } else if (error.message && error.message.includes('Quota exceeded')) {
        throw new GoogleSheetsError('Google Sheets API quota exceeded. Please try again later.', error);
      } else if (error.message && error.message.includes('permission')) {
        throw new GoogleSheetsError('Permission denied. The service account may not have access to this spreadsheet.', error);
      } else {
        throw new GoogleSheetsError(`Failed to read from Google Sheets: ${error.message}`, error);
      }
    }
  }

  async updateCell(sheetName, cell, value) {
    await this.ensureInitialized();
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${cell}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[value]]
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating cell in Google Sheets:', error);
      throw new GoogleSheetsError('Failed to update Google Sheets', error);
    }
  }

  async clearRow(sheetName, rowNumber) {
    await this.ensureInitialized();
    try {
      console.log(`🧹 Clearing row ${rowNumber} in ${sheetName}`);
      
      const response = await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${rowNumber}:Z${rowNumber}`
      });

      console.log(`✅ Successfully cleared row ${rowNumber} in ${sheetName}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error clearing row ${rowNumber} in ${sheetName}:`, error);
      throw new GoogleSheetsError(`Failed to clear row in Google Sheets: ${error.message}`);
    }
  }

  // Batch update multiple rows at once (more efficient for rebuilding sheets)
  async batchUpdateRows(sheetName, rows) {
    await this.ensureInitialized();
    try {
      // Clear the sheet first (except headers)
      await this.clearSheet(sheetName);
      
      // Add all rows in batch
      if (rows.length > 0) {
        const response = await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A2:C${rows.length + 1}`, // Start from row 2 (after headers), include Scanned By column
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: rows
          }
        });
        
        return { success: true, updatedCells: response.data.updatedCells };
      }
      
      return { success: true, updatedCells: 0 };
    } catch (error) {
      console.error(`❌ Error batch updating rows in ${sheetName}:`, error);
      throw new GoogleSheetsError(`Failed to batch update rows in Google Sheets: ${error.message}`);
    }
  }

  async updateRow(sheetName, rowNumber, values) {
    await this.ensureInitialized();
    
    // Apply rate limiting
    await this.rateLimit();
    
    try {
      // Ensure all values are strings to avoid type issues
      const stringValues = values.map(value => value !== null && value !== undefined ? value.toString() : '');
      
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${rowNumber}:${String.fromCharCode(65 + stringValues.length - 1)}${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [stringValues]
        }
      });

      // Clear cache since data has changed
      this.clearCache(sheetName);
      
      return { success: true, updatedCells: response.data.updatedCells };
    } catch (error) {
      console.error(`❌ Error updating row ${rowNumber} in ${sheetName}:`, error);
      throw new GoogleSheetsError(`Failed to update row in Google Sheets: ${error.message}`);
    }
  }

  async findRow(sheetName, searchColumn, searchValue) {
    await this.ensureInitialized();
    try {
      const data = await this.getSheetData(sheetName);
      if (!data || data.length === 0) return null;

      const headers = data[0];
      const searchColumnIndex = headers.findIndex(header => header === searchColumn);
      
      if (searchColumnIndex === -1) return null;

      for (let i = 1; i < data.length; i++) {
        if (data[i][searchColumnIndex] === searchValue) {
          return {
            rowIndex: i + 1,
            data: data[i],
            headers: headers
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding row in Google Sheets:', error);
      throw new GoogleSheetsError('Failed to search Google Sheets', error);
    }
  }
}

module.exports = new GoogleSheetsService();
