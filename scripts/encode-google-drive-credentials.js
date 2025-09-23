#!/usr/bin/env node

/**
 * Script to encode Google Drive OAuth credentials for production deployment
 * 
 * This script converts your google-drive-credentials.json file to base64
 * so you can use it as an environment variable in production.
 * 
 * Usage:
 *   node scripts/encode-google-drive-credentials.js
 * 
 * Make sure you have google-drive-credentials.json in the project root
 */

const fs = require('fs');
const path = require('path');

function encodeGoogleDriveCredentials() {
  try {
    console.log('🔧 Encoding Google Drive OAuth credentials for production...\n');

    // Check if credentials file exists (try both locations)
    let credentialsPath = path.join(__dirname, '..', 'google-drive-credentials.json');
    
    if (!fs.existsSync(credentialsPath)) {
      // Try in credentials folder
      credentialsPath = path.join(__dirname, '..', 'credentials', 'google-drive-credentials.json');
    }
    
    if (!fs.existsSync(credentialsPath)) {
      console.error('❌ Error: google-drive-credentials.json not found');
      console.log('📋 Please make sure you have the OAuth credentials file in one of these locations:');
      console.log('   1. Project root: google-drive-credentials.json');
      console.log('   2. Credentials folder: credentials/google-drive-credentials.json');
      console.log('');
      console.log('💡 If you don\'t have the file yet, follow the OAuth setup guide first');
      process.exit(1);
    }

    // Read and validate the credentials file
    const credentialsData = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    // Validate OAuth credentials format
    if (!credentialsData.installed && !credentialsData.web) {
      console.error('❌ Error: Invalid OAuth credentials format');
      console.log('📋 Expected OAuth 2.0 credentials with "installed" or "web" property');
      process.exit(1);
    }

    // Encode to base64
    const base64Credentials = Buffer.from(JSON.stringify(credentialsData)).toString('base64');
    
    console.log('✅ Successfully encoded Google Drive OAuth credentials!\n');
    
    console.log('📋 Add this to your production environment variables:');
    console.log('=' .repeat(80));
    console.log(`GOOGLE_DRIVE_CREDENTIALS_BASE64=${base64Credentials}`);
    console.log('=' .repeat(80));
    
    console.log('\n🔧 Production Environment Variables Needed:');
    console.log('1. GOOGLE_DRIVE_CREDENTIALS_BASE64 (the value above)');
    console.log('2. GOOGLE_REFRESH_TOKEN (your OAuth refresh token)');
    console.log('3. GOOGLE_ACCESS_TOKEN (your OAuth access token)');
    console.log('4. GOOGLE_API_KEY (your Google API key)');
    console.log('5. GOOGLE_DRIVE_INVENTORY_FOLDER_ID (your Google Drive folder ID)');
    
    console.log('\n📝 Example .env for production:');
    console.log('=' .repeat(50));
    console.log('# Google Drive OAuth (Base64 encoded)');
    console.log(`GOOGLE_DRIVE_CREDENTIALS_BASE64=${base64Credentials}`);
    console.log('');
    console.log('# Google Drive OAuth Tokens');
    console.log('GOOGLE_REFRESH_TOKEN=your_refresh_token_here');
    console.log('GOOGLE_ACCESS_TOKEN=your_access_token_here');
    console.log('');
    console.log('# Google API Key');
    console.log('GOOGLE_API_KEY=your_api_key_here');
    console.log('');
    console.log('# Google Drive Folder');
    console.log('GOOGLE_DRIVE_INVENTORY_FOLDER_ID=your_folder_id_here');
    console.log('=' .repeat(50));
    
    console.log('\n✅ Ready for production deployment!');
    console.log('📁 The system will automatically use base64 credentials when GOOGLE_DRIVE_CREDENTIALS_BASE64 is set');
    
  } catch (error) {
    console.error('❌ Error encoding credentials:', error.message);
    process.exit(1);
  }
}

// Run the script
encodeGoogleDriveCredentials();
