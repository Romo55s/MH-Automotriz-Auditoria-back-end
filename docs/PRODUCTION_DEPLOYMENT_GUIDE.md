# Production Deployment Guide - Google Drive Integration

## Overview

This guide covers deploying the Google Drive integration to production, including OAuth setup, environment configuration, and monitoring.

## Prerequisites

- Google Cloud Console access
- Production server access
- Domain name configured
- SSL certificate installed

## Step 1: Google Cloud Console Configuration

### 1.1 OAuth Consent Screen

1. **Go to Google Cloud Console**
   - Navigate to [Google Cloud Console](https://console.cloud.google.com/)
   - Select your project

2. **Configure OAuth Consent Screen**
   - Go to **APIs & Services** → **OAuth consent screen**
   - Select **External** (if not already selected)
   - Fill in required information:
     - **App name**: `Car Inventory System - Production`
     - **User support email**: `support@yourdomain.com`
     - **Developer contact information**: `admin@yourdomain.com`

3. **Add Scopes**
   - Click **Add or Remove Scopes**
   - Add: `https://www.googleapis.com/auth/drive.file`
   - Click **Update**

4. **Add Test Users**
   - Add production admin emails
   - Add any users who will access the system

5. **Publish the App**
   - Click **Publish App**
   - **Important**: The app must be published, not just saved

### 1.2 Create OAuth Client ID

1. **Create Desktop Application Client**
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Select **Desktop Application**
   - Name: `Car Inventory System - Production`
   - Click **Create**

2. **Download Credentials**
   - Download the JSON file
   - Rename to `google-drive-credentials.json`
   - Upload to production server in `credentials/` folder

### 1.3 Create API Key

1. **Create API Key**
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **API Key**
   - Name: `MH-Automotriz-Production-Download`

2. **Restrict API Key**
   - Click **Restrict Key**
   - **Application restrictions**: HTTP referrers
   - Add your production domain: `https://yourdomain.com/*`
   - **API restrictions**: Restrict to Google Drive API
   - Click **Save**

## Step 2: Generate Production OAuth Tokens

### 2.1 Create Setup Script

Create `scripts/setup-oauth-production.js`:

```javascript
const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');

async function setupProductionOAuth() {
  try {
    // Load credentials
    const credentialsPath = './credentials/google-drive-credentials.json';
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    const oauth2Client = new google.auth.OAuth2(
      credentials.installed.client_id,
      credentials.installed.client_secret,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file']
    });

    console.log('🔗 Production OAuth Setup');
    console.log('========================');
    console.log('1. Visit this URL in your browser:');
    console.log(authUrl);
    console.log('\n2. Sign in with your production Google account');
    console.log('3. Grant permissions to the application');
    console.log('4. Copy the authorization code from the browser');
    console.log('\nEnter the authorization code:');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const code = await new Promise((resolve) => {
      rl.question('Authorization code: ', resolve);
    });

    rl.close();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('\n✅ OAuth tokens generated successfully!');
    console.log('\n📋 Add these to your production .env file:');
    console.log('=====================================');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log(`GOOGLE_ACCESS_TOKEN=${tokens.access_token}`);
    console.log(`GOOGLE_API_KEY=your_api_key_here`);
    console.log(`GOOGLE_DRIVE_INVENTORY_FOLDER_ID=your_folder_id_here`);
    console.log(`GOOGLE_DRIVE_RETENTION_DAYS=30`);
    console.log(`GOOGLE_DRIVE_CREDENTIALS_PATH=./credentials/google-drive-credentials.json`);

  } catch (error) {
    console.error('❌ Error setting up OAuth:', error.message);
    process.exit(1);
  }
}

setupProductionOAuth();
```

### 2.2 Run Setup Script

```bash
# Run the production OAuth setup
node scripts/setup-oauth-production.js

# Follow the prompts to get tokens
# Copy the generated tokens to your production .env file
```

## Step 3: Production Environment Configuration

### 3.1 Environment Variables

Create/update your production `.env` file. You have two options for Google Drive credentials:

#### **Option A: Base64 Encoded Credentials (Recommended for Production)**

```env
# Production Environment
NODE_ENV=production
PORT=5000

# Google Drive Configuration
GOOGLE_DRIVE_INVENTORY_FOLDER_ID=your_production_folder_id
GOOGLE_DRIVE_RETENTION_DAYS=30

# Google Drive OAuth (Base64 encoded - recommended for production)
GOOGLE_DRIVE_CREDENTIALS_BASE64=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Iiwi...

# OAuth Tokens (from setup script)
GOOGLE_REFRESH_TOKEN=your_production_refresh_token
GOOGLE_ACCESS_TOKEN=your_production_access_token

# API Key (from Google Cloud Console)
GOOGLE_API_KEY=your_production_api_key
```

#### **Option B: File Path Credentials (Alternative)**

```env
# Production Environment
NODE_ENV=production
PORT=5000

# Google Drive Configuration
GOOGLE_DRIVE_INVENTORY_FOLDER_ID=your_production_folder_id
GOOGLE_DRIVE_RETENTION_DAYS=30
GOOGLE_DRIVE_CREDENTIALS_PATH=./credentials/google-drive-credentials.json

# OAuth Tokens (from setup script)
GOOGLE_REFRESH_TOKEN=your_production_refresh_token
GOOGLE_ACCESS_TOKEN=your_production_access_token

# API Key (from Google Cloud Console)
GOOGLE_API_KEY=your_production_api_key
```

#### **How to Generate Base64 Credentials:**

1. **Run the encoding script:**
```bash
node scripts/encode-google-drive-credentials.js
```

2. **Copy the generated base64 string** to your production environment variables

3. **Benefits of Base64 approach:**
   - No need to upload JSON files to production server
   - More secure (credentials stored as environment variable)
   - Easier to manage in cloud platforms
   - No file path dependencies

# Google Sheets (existing)
GOOGLE_SHEETS_SPREADSHEET_ID=your_production_spreadsheet_id
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/google-credentials.json

# Database (if applicable)
DATABASE_URL=your_production_database_url

# Security
JWT_SECRET=your_production_jwt_secret
CORS_ORIGIN=https://yourdomain.com

# Logging
LOG_LEVEL=info
```

### 3.2 File Structure

Ensure your production server has this structure:

```
/var/www/car-inventory-backend/
├── credentials/
│   ├── google-drive-credentials.json
│   └── google-credentials.json
├── src/
├── docs/
├── scripts/
├── .env
├── package.json
└── ecosystem.config.js
```

## Step 4: Create Google Drive Folder Structure

### 4.1 Create Main Folder

1. **Create Main Inventory Folder**
   - Go to [Google Drive](https://drive.google.com)
   - Create a new folder: `Car Inventory Backups`
   - Copy the folder ID from the URL
   - Add to `.env` as `GOOGLE_DRIVE_INVENTORY_FOLDER_ID`

2. **Set Folder Permissions**
   - Right-click the folder → **Share**
   - Add your production Google account
   - Set permissions to **Editor**

### 4.2 Test Folder Creation

```bash
# Test that the system can create agency folders
curl -X GET "https://yourdomain.com/api/download/stored-files/TestAgency"
```

## Step 5: Deploy Application

### 5.1 Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### 5.2 Using Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["node", "src/index.js"]
```

```bash
# Build and run
docker build -t car-inventory-backend .
docker run -d --name car-inventory -p 5000:5000 --env-file .env car-inventory-backend
```

### 5.3 Using Systemd

Create `/etc/systemd/system/car-inventory.service`:

```ini
[Unit]
Description=Car Inventory Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/car-inventory-backend
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/var/www/car-inventory-backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable car-inventory
sudo systemctl start car-inventory
sudo systemctl status car-inventory
```

## Step 6: Monitoring and Logging

### 6.1 Application Logs

```bash
# PM2 logs
pm2 logs car-inventory-backend

# Systemd logs
sudo journalctl -u car-inventory -f

# Docker logs
docker logs -f car-inventory
```

### 6.2 Health Check Endpoint

```bash
# Test health endpoint
curl https://yourdomain.com/health

# Expected response
{
  "status": "OK",
  "timestamp": "2025-09-23T15:30:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

### 6.3 Google Drive Integration Test

```bash
# Test Google Drive connection
curl -X GET "https://yourdomain.com/api/download/stored-files/TestAgency"

# Expected response
{
  "success": true,
  "agency": "TestAgency",
  "files": [],
  "count": 0
}
```

## Step 7: Security Considerations

### 7.1 Environment Variables Security

- Never commit `.env` files to version control
- Use environment variable management tools
- Rotate credentials regularly
- Use different credentials for different environments

### 7.2 API Key Security

- Restrict API key to specific domains
- Monitor API key usage
- Set up alerts for unusual activity
- Rotate API keys periodically

### 7.3 OAuth Token Security

- Store tokens securely
- Implement token refresh logic
- Monitor for token expiration
- Use HTTPS for all communications

## Step 8: Backup and Recovery

### 8.1 Application Backup

```bash
# Backup application files
tar -czf car-inventory-backup-$(date +%Y%m%d).tar.gz \
  /var/www/car-inventory-backend \
  --exclude=node_modules \
  --exclude=temp

# Backup environment configuration
cp .env .env.backup.$(date +%Y%m%d)
```

### 8.2 Google Drive Backup

- Google Drive files are automatically backed up by Google
- Monitor storage usage
- Set up alerts for storage limits
- Regular cleanup of expired files

## Step 9: Performance Optimization

### 9.1 Caching

- Implement Redis for session caching
- Cache Google Drive API responses
- Use CDN for static assets

### 9.2 Database Optimization

- Index frequently queried fields
- Optimize Google Sheets API calls
- Implement connection pooling

### 9.3 Monitoring

- Set up application performance monitoring
- Monitor Google Drive API quotas
- Track download/upload metrics
- Set up alerts for errors

## Step 10: Troubleshooting

### 10.1 Common Issues

#### OAuth Token Expired
```bash
# Check token status
curl -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  "https://www.googleapis.com/oauth2/v1/tokeninfo"

# Regenerate tokens if needed
node scripts/setup-oauth-production.js
```

#### API Key Issues
```bash
# Test API key
curl "https://www.googleapis.com/drive/v3/files?key=$GOOGLE_API_KEY"
```

#### Google Drive Permissions
- Verify folder permissions
- Check OAuth consent screen status
- Ensure app is published

### 10.2 Debug Commands

```bash
# Test Google Drive connection
node -e "
const { OAuthGoogleDrive } = require('./src/services/oauthGoogleDrive');
const drive = new OAuthGoogleDrive();
drive.initialize().then(() => {
  console.log('✅ Google Drive connection successful');
}).catch(err => {
  console.error('❌ Google Drive connection failed:', err.message);
});
"

# Test file operations
curl -X GET "https://yourdomain.com/api/download/stored-files/TestAgency"
```

## Step 11: Maintenance

### 11.1 Regular Tasks

- **Daily**: Check application logs
- **Weekly**: Monitor Google Drive storage usage
- **Monthly**: Review and rotate credentials
- **Quarterly**: Update dependencies and security patches

### 11.2 Monitoring Alerts

Set up alerts for:
- Application downtime
- Google Drive API errors
- Storage quota exceeded
- Unusual download patterns
- Authentication failures

## Support

For production deployment issues:

1. Check application logs
2. Verify environment configuration
3. Test Google Drive connectivity
4. Review security settings
5. Contact the development team with specific error messages and logs

## Rollback Plan

If issues occur:

1. **Immediate**: Revert to previous version
2. **Short-term**: Disable Google Drive integration
3. **Long-term**: Fix issues and redeploy

```bash
# Rollback to previous version
pm2 stop car-inventory-backend
pm2 start ecosystem.config.js --env production --revert

# Or disable Google Drive integration temporarily
export GOOGLE_DRIVE_ENABLED=false
pm2 restart car-inventory-backend
```