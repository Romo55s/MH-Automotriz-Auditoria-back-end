#!/usr/bin/env node

/**
 * Setup script for Render deployment
 * This script helps you prepare your Google credentials for Render deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Render Deployment Setup\n');

// Check if credentials file exists
const credentialsPath = path.join(__dirname, '../credentials/google-credentials.json');

if (!fs.existsSync(credentialsPath)) {
  console.error('❌ Google credentials file not found!');
  console.log('Please place your google-credentials.json file in the credentials/ directory');
  process.exit(1);
}

// Read and validate credentials
try {
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  
  console.log('✅ Google credentials file found');
  console.log(`📧 Service Account Email: ${credentials.client_email}`);
  console.log(`🆔 Project ID: ${credentials.project_id}`);
  
  // Convert to base64 for Render environment variable
  const base64Credentials = Buffer.from(JSON.stringify(credentials)).toString('base64');
  
  console.log('\n📋 Render Environment Variables Setup:');
  console.log('=====================================');
  console.log('Add these environment variables in your Render dashboard:');
  console.log('');
  console.log('GOOGLE_CREDENTIALS_BASE64=' + base64Credentials);
  console.log('');
  console.log('📝 Instructions:');
  console.log('1. Go to your Render dashboard');
  console.log('2. Select your web service');
  console.log('3. Go to Environment tab');
  console.log('4. Add the GOOGLE_CREDENTIALS_BASE64 variable');
  console.log('5. Paste the value above');
  console.log('');
  console.log('🔒 Security Note:');
  console.log('- Never commit credentials to git');
  console.log('- Use Render\'s environment variables for sensitive data');
  console.log('- The credentials/ directory should be in .gitignore');
  
} catch (error) {
  console.error('❌ Error reading credentials file:', error.message);
  process.exit(1);
}

console.log('\n🎉 Setup complete! Your backend is ready for Render deployment.');
