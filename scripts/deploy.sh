#!/bin/bash

# Car Inventory Backend - Production Deployment Script
# Usage: ./scripts/deploy.sh [environment]

set -e  # Exit on any error

ENVIRONMENT=${1:-production}
APP_NAME="car-inventory-backend"
APP_DIR="/var/www/car-inventory-backend"
BACKUP_DIR="/var/backups/car-inventory-backend"

echo "🚀 Starting deployment for environment: $ENVIRONMENT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed. Please install it first: npm install -g pm2"
    exit 1
fi

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
    print_status "Creating backup directory: $BACKUP_DIR"
    sudo mkdir -p "$BACKUP_DIR"
    sudo chown $USER:$USER "$BACKUP_DIR"
fi

# Create application directory if it doesn't exist
if [ ! -d "$APP_DIR" ]; then
    print_status "Creating application directory: $APP_DIR"
    sudo mkdir -p "$APP_DIR"
    sudo chown $USER:$USER "$APP_DIR"
fi

# Navigate to application directory
cd "$APP_DIR"

# Create backup of current deployment
if [ -d ".git" ]; then
    print_status "Creating backup of current deployment..."
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    cp -r "$APP_DIR" "$BACKUP_DIR/$BACKUP_NAME"
    print_status "Backup created: $BACKUP_DIR/$BACKUP_NAME"
fi

# Stop the application
print_status "Stopping application..."
pm2 stop "$APP_NAME" || print_warning "Application was not running"

# Pull latest changes
print_status "Pulling latest changes from repository..."
git pull origin main

# Install dependencies
print_status "Installing dependencies..."
npm ci --only=production

# Verify environment file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create it from .env.example"
    exit 1
fi

# Verify Google credentials exist
if [ ! -f "credentials/google-credentials.json" ]; then
    print_error "Google credentials file not found at credentials/google-credentials.json"
    exit 1
fi

# Set proper permissions
print_status "Setting proper file permissions..."
chmod 600 .env
chmod 600 credentials/google-credentials.json

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the application
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js --env "$ENVIRONMENT"

# Save PM2 configuration
pm2 save

# Show application status
print_status "Application status:"
pm2 status "$APP_NAME"

# Show logs
print_status "Recent logs:"
pm2 logs "$APP_NAME" --lines 20

# Health check
print_status "Performing health check..."
sleep 5

if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    print_status "✅ Health check passed - Application is running correctly"
else
    print_error "❌ Health check failed - Application may not be running correctly"
    print_status "Check logs with: pm2 logs $APP_NAME"
    exit 1
fi

print_status "🎉 Deployment completed successfully!"
print_status "Application is running at: http://localhost:5000"
print_status "Health check: http://localhost:5000/health"
print_status "Monitor with: pm2 monit"

# Optional: Setup log rotation
if [ ! -f "/etc/logrotate.d/$APP_NAME" ]; then
    print_status "Setting up log rotation..."
    sudo tee "/etc/logrotate.d/$APP_NAME" > /dev/null <<EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
    print_status "Log rotation configured"
fi

echo ""
print_status "Deployment Summary:"
echo "  - Environment: $ENVIRONMENT"
echo "  - Application: $APP_NAME"
echo "  - Directory: $APP_DIR"
echo "  - Backup: $BACKUP_DIR"
echo "  - Health: http://localhost:5000/health"
echo ""
print_status "Next steps:"
echo "  1. Configure Nginx reverse proxy"
echo "  2. Setup SSL certificate"
echo "  3. Configure monitoring alerts"
echo "  4. Test all API endpoints"
