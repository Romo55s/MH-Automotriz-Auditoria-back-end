# 🚀 Production Deployment Guide

This guide will help you deploy the Car Inventory Backend to production with proper security, monitoring, and configuration.

## 📋 Prerequisites

- Node.js 18+ installed on production server
- PM2 or similar process manager
- SSL certificate for HTTPS
- Domain name configured
- Google Cloud Console project with Sheets API enabled
- Auth0 account and application configured

## 🔧 Environment Configuration

### 1. Environment Variables

Create a `.env` file in your production directory with the following variables:

```bash
# Application
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# Google Sheets API
GOOGLE_SHEETS_SPREADSHEET_ID=your_production_spreadsheet_id
GOOGLE_APPLICATION_CREDENTIALS=./credentials/google-credentials.json

# Auth0 Configuration
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-identifier
AUTH0_ISSUER=https://your-domain.auth0.com/

# Rate Limiting (Production Settings)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.com

# Logging
LOG_LEVEL=info
```

### 2. Google Sheets Setup

1. **Create Production Spreadsheet**:
   - Create a new Google Spreadsheet for production
   - Copy the spreadsheet ID from the URL
   - Update `GOOGLE_SHEETS_SPREADSHEET_ID` in your `.env`

2. **Service Account Setup**:
   - Create a new service account in Google Cloud Console
   - Download the JSON credentials file
   - Place it in `./credentials/google-credentials.json`
   - Share the spreadsheet with the service account email

3. **Sheet Structure**:
   - The system will automatically create required sheets:
     - `MonthlySummary` (with headers)
     - Agency-specific sheets (created on first scan)

### 3. Auth0 Configuration

#### Production Application Setup:
1. **Create Auth0 Application**:
   - Go to Auth0 Dashboard → Applications
   - Create new "Single Page Application"
   - Note the Domain and Client ID

2. **API Configuration**:
   - Go to APIs section
   - Create new API or use existing
   - Set Identifier (this becomes your `AUTH0_AUDIENCE`)
   - Enable RBAC and Add Permissions in Access Token

3. **Environment Variables**:
   ```bash
   AUTH0_DOMAIN=your-domain.auth0.com
   AUTH0_AUDIENCE=https://your-api-identifier
   AUTH0_ISSUER=https://your-domain.auth0.com/
   ```

4. **CORS Configuration**:
   - Add your frontend domain to allowed origins
   - Update `CORS_ORIGIN` in your `.env`

## 🚀 Deployment Steps

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Create application directory
sudo mkdir -p /var/www/car-inventory-backend
sudo chown $USER:$USER /var/www/car-inventory-backend
cd /var/www/car-inventory-backend
```

### 2. Application Deployment

```bash
# Clone repository
git clone https://github.com/your-username/car-inventory-backend.git .

# Install dependencies
npm ci --only=production

# Create credentials directory
mkdir -p credentials

# Copy your Google credentials file
cp /path/to/your/google-credentials.json ./credentials/

# Create production .env file
cp .env.example .env
# Edit .env with your production values
nano .env

# Set proper permissions
chmod 600 .env
chmod 600 credentials/google-credentials.json
```

### 3. PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'car-inventory-backend',
    script: 'src/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### 4. Start Application

```bash
# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions provided by PM2
```

## 🔒 Security Configuration

### 1. Firewall Setup

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Nginx Configuration

Create `/etc/nginx/sites-available/car-inventory-backend`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://localhost:5000/health;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/car-inventory-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 📊 Monitoring & Logging

### 1. PM2 Monitoring

```bash
# Monitor application
pm2 monit

# View logs
pm2 logs car-inventory-backend

# Restart application
pm2 restart car-inventory-backend

# Stop application
pm2 stop car-inventory-backend
```

### 2. Log Rotation

Create `/etc/logrotate.d/car-inventory-backend`:

```
/var/www/car-inventory-backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. Health Check

The application includes a health check endpoint at `/health` that returns:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX...",
  "uptime": 12345,
  "environment": "production"
}
```

## 🔄 CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /var/www/car-inventory-backend
          git pull origin main
          npm ci --only=production
          pm2 restart car-inventory-backend
```

## 🧪 Testing Production Setup

### 1. Health Check
```bash
curl https://your-domain.com/health
```

### 2. API Endpoints Test
```bash
# Test with proper authentication
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://your-domain.com/api/inventory/monthly-inventory/TestAgency/01/2025
```

### 3. Google Sheets Integration
- Verify service account has access to spreadsheet
- Test a scan operation to ensure sheets are created properly

## 🚨 Troubleshooting

### Common Issues:

1. **Google Sheets API Errors**:
   - Check service account permissions
   - Verify spreadsheet ID is correct
   - Ensure credentials file is properly formatted

2. **Auth0 Issues**:
   - Verify domain and audience settings
   - Check CORS configuration
   - Ensure JWT tokens are properly formatted

3. **Rate Limiting**:
   - Adjust `RATE_LIMIT_MAX_REQUESTS` if needed
   - Monitor logs for 429 errors

4. **Memory Issues**:
   - Increase `max_memory_restart` in PM2 config
   - Monitor with `pm2 monit`

## 📈 Performance Optimization

### 1. Database Optimization
- Google Sheets API has quotas - monitor usage
- Implement proper caching for frequently accessed data
- Use batch operations when possible

### 2. Application Optimization
- Enable gzip compression in Nginx
- Use CDN for static assets
- Implement proper error handling and logging

### 3. Monitoring
- Set up alerts for application downtime
- Monitor API response times
- Track Google Sheets API quota usage

## 🔐 Security Checklist

- [ ] HTTPS enabled with valid SSL certificate
- [ ] Environment variables properly secured
- [ ] Google credentials file has restricted permissions (600)
- [ ] Firewall configured to only allow necessary ports
- [ ] Auth0 properly configured with correct domains
- [ ] Rate limiting enabled and configured
- [ ] Security headers implemented in Nginx
- [ ] Log rotation configured
- [ ] Regular security updates scheduled
- [ ] Backup strategy implemented

## 📞 Support

For issues or questions:
1. Check application logs: `pm2 logs car-inventory-backend`
2. Verify environment configuration
3. Test individual components (Auth0, Google Sheets)
4. Check server resources and connectivity

---

**Remember**: Always test your production setup in a staging environment first!
