// OAuth Setup for Production
const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

async function setupOAuthProduction() {
  console.log('🔧 === OAUTH SETUP FOR PRODUCTION ===\n');

  try {
    // Check if credentials file exists
    const credentialsPath = path.resolve('./credentials/google-drive-credentials.json');
    if (!fs.existsSync(credentialsPath)) {
      console.error('❌ Google Drive credentials file not found!');
      console.log('📁 Please place your google-drive-credentials.json file in the credentials folder');
      console.log('📋 You can download it from Google Cloud Console → APIs & Services → Credentials');
      return;
    }

    // Load credentials
    const credentialsData = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    const credentials = credentialsData.installed || credentialsData;

    console.log('✅ Credentials loaded successfully');
    console.log(`📧 Client ID: ${credentials.client_id}`);

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      'http://localhost'
    );

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive'
      ],
      prompt: 'consent'
    });

    console.log('\n📋 === OAUTH SETUP INSTRUCTIONS ===');
    console.log('1. Open this URL in your browser:');
    console.log(`   ${authUrl}`);
    console.log('\n2. Sign in with your Google account');
    console.log('3. Grant permissions to the application');
    console.log('4. Copy the authorization code from the page');
    console.log('5. Paste it below\n');

    // Get authorization code from user
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Enter the authorization code: ', async (code) => {
      try {
        console.log('\n🔄 Exchanging code for tokens...');
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('\n✅ === TOKENS GENERATED SUCCESSFULLY ===');
        console.log('📝 Add these to your production environment:');
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log(`GOOGLE_ACCESS_TOKEN=${tokens.access_token}`);
        
        console.log('\n🔧 === PRODUCTION SETUP ===');
        console.log('1. Add these environment variables to your production server');
        console.log('2. Restart your application');
        console.log('3. Test the integration with: curl -X GET "https://your-domain.com/health/detailed"');
        
        console.log('\n📁 === CREDENTIALS FILE ===');
        console.log('Make sure this file is uploaded to production:');
        console.log('credentials/google-drive-credentials.json');
        
        console.log('\n📁 === GOOGLE DRIVE FOLDER ===');
        console.log('1. Create folder "Inventarios-Hojas-de-Trabajo" in Google Drive');
        console.log('2. Get folder ID from URL');
        console.log('3. Set GOOGLE_DRIVE_INVENTORY_FOLDER_ID environment variable');
        
        console.log('\n🎉 === SETUP COMPLETE ===');
        console.log('Your OAuth tokens are ready for production!');
        
        rl.close();
      } catch (error) {
        console.error('\n❌ === TOKEN EXCHANGE FAILED ===');
        console.error('Error:', error.message);
        console.log('\n💡 Common solutions:');
        console.log('1. Make sure the authorization code is correct');
        console.log('2. Try generating a new authorization code');
        console.log('3. Check your internet connection');
        rl.close();
      }
    });

  } catch (error) {
    console.error('\n❌ === SETUP FAILED ===');
    console.error('Error:', error.message);
  }
}

// Run setup
setupOAuthProduction();
