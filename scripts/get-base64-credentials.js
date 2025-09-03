const fs = require('fs');
const path = require('path');

const credentialsPath = path.join(__dirname, '../credentials/google-credentials.json');

console.log('🔐 Google Credentials Base64 Generator\n');

if (!fs.existsSync(credentialsPath)) {
  console.error(`❌ Error: Google credentials file not found at ${credentialsPath}`);
  console.error('Please ensure your google-credentials.json is in the credentials/ directory.');
  process.exit(1);
}

try {
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const base64Credentials = Buffer.from(JSON.stringify(credentials)).toString('base64');

  console.log('✅ Google credentials file found');
  console.log(`📧 Service Account Email: ${credentials.client_email}`);
  console.log(`🆔 Project ID: ${credentials.project_id}\n`);

  console.log('📋 COPY THIS ENTIRE STRING TO RENDER:');
  console.log('=====================================');
  console.log(base64Credentials);
  console.log('=====================================\n');

  console.log('📝 Instructions:');
  console.log('1. Copy the ENTIRE string above (including the = at the end)');
  console.log('2. Go to Render dashboard → Your service → Environment tab');
  console.log('3. Update GOOGLE_CREDENTIALS_BASE64 with the complete string');
  console.log('4. Save and redeploy\n');

  console.log(`📊 String length: ${base64Credentials.length} characters`);
  console.log('🔒 Security: This string contains your Google service account credentials');

} catch (error) {
  console.error('❌ Error processing Google credentials:', error);
  console.error('Please ensure your google-credentials.json is a valid JSON file.');
  process.exit(1);
}

