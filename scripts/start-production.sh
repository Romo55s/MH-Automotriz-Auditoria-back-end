#!/bin/bash

# Car Inventory Backend - Production Startup Script
# This script starts the application in production mode with proper configuration

set -e

echo "🚀 Starting Car Inventory Backend in Production Mode"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create it from .env.example"
    exit 1
fi

# Check if Google credentials exist
if [ ! -f "credentials/google-credentials.json" ]; then
    print_error "Google credentials file not found at credentials/google-credentials.json"
    exit 1
fi

# Set proper permissions
print_status "Setting file permissions..."
chmod 600 .env
chmod 600 credentials/google-credentials.json

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p temp

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed. Please install it first: npm install -g pm2"
    exit 1
fi

# Stop any existing instances
print_status "Stopping any existing instances..."
pm2 stop car-inventory-backend 2>/dev/null || true
pm2 delete car-inventory-backend 2>/dev/null || true

# Start the application
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Show status
print_status "Application status:"
pm2 status car-inventory-backend

# Wait a moment for startup
sleep 3

# Health check
print_status "Performing health check..."
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    print_status "✅ Application started successfully!"
    print_status "🌐 Health check: http://localhost:5000/health"
    print_status "📊 Monitor with: pm2 monit"
    print_status "📝 View logs with: pm2 logs car-inventory-backend"
else
    print_error "❌ Health check failed. Check logs with: pm2 logs car-inventory-backend"
    exit 1
fi

echo ""
print_status "🎉 Production startup completed!"
print_status "Application is running at: http://localhost:5000"
