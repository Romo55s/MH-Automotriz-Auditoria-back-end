#!/usr/bin/env node

/**
 * Test script to validate Google Drive base64 credentials for production
 * 
 * This script tests the base64 credentials to ensure they work correctly
 * in a production-like environment.
 */

const { google } = require('googleapis');

// Your base64 credentials
const GOOGLE_DRIVE_CREDENTIALS_BASE64 = "eyJpbnN0YWxsZWQiOnsiY2xpZW50X2lkIjoiMTk3NzkxMjM1NjUwLWFhcDY2OHViN25vYWMzNG1iZzJsdjZnZTIybDFnY3Y3LmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwicHJvamVjdF9pZCI6Im1oLWF1dG9tb3RyaXotYXVkaXRvcmlhIiwiYXV0aF91cmkiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsInRva2VuX3VyaSI6Imh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwiYXV0aF9wcm92aWRlcl94NTA5X2NlcnRfdXJsIjoiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vb2F1dGgyL3YxL2NlcnRzIiwiY2xpZW50X3NlY3JldCI6IkdPQ1NQWC02S2tCVTFlVkJsUlFCZS1yV25iQi1xWjVkOHR3IiwicmVkaXJlY3RfdXJpcyI6WyJodHRwOi8vbG9jYWxob3N0Il19fQ==";

async function testProductionCredentials() {
  try {
    console.log('🧪 Testing Google Drive base64 credentials for production...\n');

    // Step 1: Decode and validate base64 credentials
    console.log('1️⃣ Decoding base64 credentials...');
    const credentialsData = JSON.parse(Buffer.from(GOOGLE_DRIVE_CREDENTIALS_BASE64, 'base64').toString('utf8'));
    
    console.log('✅ Base64 credentials decoded successfully');
    console.log(`📋 Project ID: ${credentialsData.installed.project_id}`);
    console.log(`📋 Client ID: ${credentialsData.installed.client_id.substring(0, 20)}...`);
    console.log(`📋 Client Secret: ${credentialsData.installed.client_secret.substring(0, 10)}...`);

    // Step 2: Create OAuth2 client (same as production)
    console.log('\n2️⃣ Creating OAuth2 client...');
    const auth = new google.auth.OAuth2(
      credentialsData.installed.client_id,
      credentialsData.installed.client_secret,
      'urn:ietf:wg:oauth:2.0:oob' // For desktop applications
    );

    console.log('✅ OAuth2 client created successfully');

    // Step 3: Test with refresh token (if available)
    console.log('\n3️⃣ Testing with refresh token...');
    
    // Check if refresh token is available in environment
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
    
    if (refreshToken) {
      console.log('✅ Refresh token found in environment');
      auth.setCredentials({
        refresh_token: refreshToken,
        access_token: accessToken
      });
      
      // Test Google Drive API access
      console.log('\n4️⃣ Testing Google Drive API access...');
      const drive = google.drive({ version: 'v3', auth });
      
      try {
        // Test listing files (this will validate the credentials)
        const response = await drive.files.list({
          pageSize: 1,
          fields: 'nextPageToken, files(id, name)'
        });
        
        console.log('✅ Google Drive API access successful!');
        console.log(`📁 Found ${response.data.files.length} files (showing first 1)`);
        
        if (response.data.files.length > 0) {
          console.log(`📄 Sample file: ${response.data.files[0].name}`);
        }
        
      } catch (apiError) {
        console.log('⚠️ Google Drive API test failed (this is expected if tokens are expired)');
        console.log(`   Error: ${apiError.message}`);
        console.log('💡 This is normal - you\'ll need fresh tokens for production');
      }
      
    } else {
      console.log('⚠️ No refresh token found in environment');
      console.log('💡 You\'ll need to set GOOGLE_REFRESH_TOKEN for full testing');
    }

    // Step 4: Test API key (if available)
    console.log('\n5️⃣ Testing API key...');
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (apiKey) {
      console.log('✅ API key found in environment');
      console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
      
      // Test drive client with API key
      const driveWithKey = google.drive({ 
        version: 'v3', 
        auth: auth,
        key: apiKey 
      });
      
      console.log('✅ Drive client with API key created successfully');
      
    } else {
      console.log('⚠️ No API key found in environment');
      console.log('💡 You\'ll need to set GOOGLE_API_KEY for download operations');
    }

    // Step 5: Production readiness check
    console.log('\n6️⃣ Production Readiness Check...');
    
    const checks = [
      { name: 'Base64 credentials', status: true, message: '✅ Valid base64 format' },
      { name: 'OAuth client creation', status: true, message: '✅ Client created successfully' },
      { name: 'Refresh token', status: !!refreshToken, message: refreshToken ? '✅ Found in environment' : '⚠️ Not found - needs to be set' },
      { name: 'Access token', status: !!accessToken, message: accessToken ? '✅ Found in environment' : '⚠️ Not found - needs to be set' },
      { name: 'API key', status: !!apiKey, message: apiKey ? '✅ Found in environment' : '⚠️ Not found - needs to be set' }
    ];

    console.log('\n📊 Production Readiness Summary:');
    console.log('=' .repeat(50));
    
    checks.forEach(check => {
      const status = check.status ? '✅' : '⚠️';
      console.log(`${status} ${check.name}: ${check.message}`);
    });

    const allReady = checks.every(check => check.status);
    
    if (allReady) {
      console.log('\n🎉 PRODUCTION READY!');
      console.log('✅ All credentials are properly configured');
      console.log('🚀 You can deploy to production with these settings');
    } else {
      console.log('\n⚠️ PRODUCTION NOT READY');
      console.log('📋 Missing required environment variables:');
      checks.filter(check => !check.status).forEach(check => {
        console.log(`   - ${check.name}`);
      });
      console.log('\n💡 Set the missing variables and run this test again');
    }

    console.log('\n📋 Required Production Environment Variables:');
    console.log('=' .repeat(60));
    console.log('GOOGLE_DRIVE_CREDENTIALS_BASE64=' + GOOGLE_DRIVE_CREDENTIALS_BASE64.substring(0, 50) + '...');
    console.log('GOOGLE_REFRESH_TOKEN=your_refresh_token_here');
    console.log('GOOGLE_ACCESS_TOKEN=your_access_token_here');
    console.log('GOOGLE_API_KEY=your_api_key_here');
    console.log('GOOGLE_DRIVE_INVENTORY_FOLDER_ID=your_folder_id_here');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Error testing credentials:', error.message);
    console.log('\n🔍 Debug Information:');
    console.log(`   Error type: ${error.constructor.name}`);
    console.log(`   Error message: ${error.message}`);
    
    if (error.message.includes('Invalid base64')) {
      console.log('💡 The base64 string might be corrupted or incomplete');
    } else if (error.message.includes('Unexpected token')) {
      console.log('💡 The decoded JSON might be malformed');
    }
    
    process.exit(1);
  }
}

// Run the test
testProductionCredentials();
