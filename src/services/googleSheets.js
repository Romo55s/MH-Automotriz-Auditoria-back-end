const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { GoogleSheetsError } = require('../middleware/errorHandler');

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
      const credentialsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
      if (!credentialsPath) {
        throw new Error('GOOGLE_SHEETS_CREDENTIALS_PATH environment variable is not set');
      }

      const resolvedPath = path.resolve(credentialsPath);
      const credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      
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
          // MonthlySummary with all required fields
          const headers = [
            'Month', 'Year', 'Agency', 'Status', 'Created At', 'Created By', 'User Name', 
            'Total Scans', 'Session ID', 'Completed At'
          ];
          await this.createSheet(sheetName, headers);
        } else {
          // Agency sheets: simple and clean, only current month data
          const headers = ['Date', 'Barcode'];
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
    
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [values] }
      });
      
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
    
    // Ensure the sheet exists before trying to read
    await this.ensureSheetExists(sheetName);
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`
      });

      return response.data.values || [];
    } catch (error) {
      console.error('Error reading from Google Sheets:', error);
      throw new GoogleSheetsError('Failed to read from Google Sheets', error);
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

  async updateRow(sheetName, rowNumber, values) {
    await this.ensureInitialized();
    try {
      // Ensure all values are strings to avoid type issues
      const stringValues = values.map(value => value !== null && value !== undefined ? value.toString() : '');
      
      console.log(`📝 Updating row ${rowNumber} in ${sheetName}:`, stringValues);
      
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${rowNumber}:${String.fromCharCode(65 + stringValues.length - 1)}${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [stringValues]
        }
      });

      console.log(`✅ Successfully updated row ${rowNumber} in ${sheetName}`);
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
