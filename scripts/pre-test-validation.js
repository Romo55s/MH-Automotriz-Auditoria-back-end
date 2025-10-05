#!/usr/bin/env node

/**
 * Pre-Test Validation Script
 * 
 * This script validates that the system is ready for year-long infrastructure testing.
 * It checks all prerequisites and dependencies before running the comprehensive tests.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
  requiredServices: [
    'google-sheets',
    'google-drive', 
    'websocket',
    'api-endpoints'
  ],
  testTimeout: 10000, // 10 seconds
  healthCheckInterval: 2000 // 2 seconds
};

// Validation results
const validationResults = {
  serverRunning: false,
  services: {},
  prerequisites: {},
  errors: [],
  warnings: []
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    progress: '🔄',
    check: '🔍'
  }[type] || '📋';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if server is running
async function checkServerRunning() {
  log('🔍 Checking if server is running...', 'check');
  
  try {
    const response = await axios.get(`${CONFIG.apiBaseUrl}/health`, {
      timeout: CONFIG.testTimeout
    });
    
    if (response.status === 200) {
      validationResults.serverRunning = true;
      log('✅ Server is running and responding', 'success');
      return true;
    } else {
      throw new Error(`Server returned status ${response.status}`);
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      validationResults.errors.push('Server is not running. Start with: npm start');
      log('❌ Server is not running. Please start the server first.', 'error');
    } else if (error.code === 'ETIMEDOUT') {
      validationResults.errors.push('Server is not responding within timeout period');
      log('❌ Server is not responding. Check if it\'s running properly.', 'error');
    } else {
      validationResults.errors.push(`Server check failed: ${error.message}`);
      log(`❌ Server check failed: ${error.message}`, 'error');
    }
    return false;
  }
}

// Check API endpoints
async function checkApiEndpoints() {
  log('🔍 Checking API endpoints...', 'check');
  
  const endpoints = [
    { path: '/health', method: 'GET', required: true },
    { path: '/health/detailed', method: 'GET', required: true },
    { path: '/api/inventory/diagnose-google-sheets', method: 'GET', required: true }
  ];
  
  const results = {
    working: 0,
    failed: 0,
    errors: []
  };
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios({
        method: endpoint.method.toLowerCase(),
        url: `${CONFIG.apiBaseUrl}${endpoint.path}`,
        timeout: CONFIG.testTimeout
      });
      
      if (response.status === 200) {
        results.working++;
        log(`  ✅ ${endpoint.method} ${endpoint.path}`, 'success');
      } else {
        results.failed++;
        results.errors.push(`${endpoint.path}: Status ${response.status}`);
        log(`  ❌ ${endpoint.method} ${endpoint.path}: Status ${response.status}`, 'error');
      }
      
    } catch (error) {
      results.failed++;
      const errorMsg = `${endpoint.path}: ${error.message}`;
      results.errors.push(errorMsg);
      
      if (endpoint.required) {
        log(`  ❌ ${endpoint.method} ${endpoint.path}: ${error.message}`, 'error');
        validationResults.errors.push(errorMsg);
      } else {
        log(`  ⚠️ ${endpoint.method} ${endpoint.path}: ${error.message}`, 'warning');
        validationResults.warnings.push(errorMsg);
      }
    }
  }
  
  validationResults.services['api-endpoints'] = results;
  
  if (results.working === endpoints.filter(e => e.required).length) {
    log('✅ API endpoints are working', 'success');
    return true;
  } else {
    log(`❌ API endpoints check failed: ${results.failed} failed`, 'error');
    return false;
  }
}

// Check Google Sheets integration
async function checkGoogleSheets() {
  log('🔍 Checking Google Sheets integration...', 'check');
  
  try {
    const response = await axios.get(`${CONFIG.apiBaseUrl}/api/inventory/diagnose-google-sheets`, {
      timeout: CONFIG.testTimeout
    });
    
    if (response.status === 200 && response.data.success) {
      validationResults.services['google-sheets'] = {
        status: 'working',
        details: response.data
      };
      log('✅ Google Sheets integration is working', 'success');
      return true;
    } else {
      throw new Error(response.data?.message || 'Google Sheets check failed');
    }
    
  } catch (error) {
    validationResults.services['google-sheets'] = {
      status: 'failed',
      error: error.message
    };
    validationResults.errors.push(`Google Sheets: ${error.message}`);
    log(`❌ Google Sheets integration failed: ${error.message}`, 'error');
    return false;
  }
}

// Check Google Drive integration
async function checkGoogleDrive() {
  log('🔍 Checking Google Drive integration...', 'check');
  
  try {
    // Try to get detailed health info which includes Google Drive status
    const response = await axios.get(`${CONFIG.apiBaseUrl}/health/detailed`, {
      timeout: CONFIG.testTimeout
    });
    
    if (response.status === 200) {
      const driveInfo = response.data.googleDrive || {};
      
      if (driveInfo.initialized || driveInfo.status === 'working') {
        validationResults.services['google-drive'] = {
          status: 'working',
          details: driveInfo
        };
        log('✅ Google Drive integration is working', 'success');
        return true;
      } else {
        validationResults.warnings.push('Google Drive status unknown or not initialized');
        log('⚠️ Google Drive status unknown', 'warning');
        return false;
      }
    } else {
      throw new Error(`Health check returned status ${response.status}`);
    }
    
  } catch (error) {
    validationResults.services['google-drive'] = {
      status: 'failed',
      error: error.message
    };
    validationResults.warnings.push(`Google Drive: ${error.message}`);
    log(`⚠️ Google Drive check failed: ${error.message}`, 'warning');
    return false;
  }
}

// Check WebSocket server
async function checkWebSocket() {
  log('🔍 Checking WebSocket server...', 'check');
  
  return new Promise((resolve) => {
    const WebSocket = require('ws');
    const ws = new WebSocket(`${CONFIG.apiBaseUrl.replace('http', 'ws')}/ws/inventory/Test%20Agency/1/2025`);
    
    const timeout = setTimeout(() => {
      ws.close();
      validationResults.services['websocket'] = {
        status: 'failed',
        error: 'Connection timeout'
      };
      validationResults.errors.push('WebSocket: Connection timeout');
      log('❌ WebSocket connection timeout', 'error');
      resolve(false);
    }, CONFIG.testTimeout);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      ws.close();
      validationResults.services['websocket'] = {
        status: 'working',
        details: 'Connection successful'
      };
      log('✅ WebSocket server is working', 'success');
      resolve(true);
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      validationResults.services['websocket'] = {
        status: 'failed',
        error: error.message
      };
      validationResults.errors.push(`WebSocket: ${error.message}`);
      log(`❌ WebSocket server failed: ${error.message}`, 'error');
      resolve(false);
    });
  });
}

// Check prerequisites
async function checkPrerequisites() {
  log('🔍 Checking prerequisites...', 'check');
  
  const prerequisites = {
    nodeVersion: false,
    npmPackages: false,
    credentials: false,
    tempDirectory: false
  };
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  
  if (majorVersion >= 16) {
    prerequisites.nodeVersion = true;
    log('  ✅ Node.js version is compatible', 'success');
  } else {
    validationResults.errors.push(`Node.js version ${nodeVersion} is too old. Required: 16+`);
    log(`  ❌ Node.js version ${nodeVersion} is too old`, 'error');
  }
  
  // Check required npm packages
  const requiredPackages = ['axios', 'ws'];
  const packageJson = require('../package.json');
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const missingPackages = requiredPackages.filter(pkg => !dependencies[pkg]);
  
  if (missingPackages.length === 0) {
    prerequisites.npmPackages = true;
    log('  ✅ Required npm packages are installed', 'success');
  } else {
    validationResults.errors.push(`Missing npm packages: ${missingPackages.join(', ')}`);
    log(`  ❌ Missing npm packages: ${missingPackages.join(', ')}`, 'error');
  }
  
  // Check credentials
  const credentialsPath = path.join(__dirname, '..', 'credentials', 'google-credentials.json');
  if (fs.existsSync(credentialsPath)) {
    prerequisites.credentials = true;
    log('  ✅ Google credentials file exists', 'success');
  } else {
    validationResults.errors.push('Google credentials file not found');
    log('  ❌ Google credentials file not found', 'error');
  }
  
  // Check temp directory
  const tempDir = path.join(__dirname, '..', 'temp');
  if (fs.existsSync(tempDir) || fs.existsSync(path.dirname(tempDir))) {
    prerequisites.tempDirectory = true;
    log('  ✅ Temp directory is accessible', 'success');
  } else {
    validationResults.errors.push('Temp directory is not accessible');
    log('  ❌ Temp directory is not accessible', 'error');
  }
  
  validationResults.prerequisites = prerequisites;
  
  const allPrerequisitesMet = Object.values(prerequisites).every(met => met);
  return allPrerequisitesMet;
}

// Generate validation report
function generateValidationReport() {
  log('\n📊 === PRE-TEST VALIDATION REPORT ===', 'progress');
  
  const totalChecks = Object.keys(validationResults.services).length + 
                     Object.keys(validationResults.prerequisites).length + 1; // +1 for server check
  const passedChecks = (validationResults.serverRunning ? 1 : 0) +
                      Object.values(validationResults.services).filter(s => s.status === 'working').length +
                      Object.values(validationResults.prerequisites).filter(p => p).length;
  
  const successRate = ((passedChecks / totalChecks) * 100).toFixed(2);
  
  console.log('\n🎯 VALIDATION SUMMARY:');
  console.log(`   Total Checks: ${totalChecks}`);
  console.log(`   Passed: ${passedChecks}`);
  console.log(`   Failed: ${totalChecks - passedChecks}`);
  console.log(`   Success Rate: ${successRate}%`);
  
  console.log('\n🖥️ SERVER STATUS:');
  console.log(`   Server Running: ${validationResults.serverRunning ? '✅' : '❌'}`);
  
  console.log('\n🔧 SERVICES:');
  Object.entries(validationResults.services).forEach(([service, result]) => {
    const status = result.status === 'working' ? '✅' : '❌';
    console.log(`   ${service}: ${status} ${result.status}`);
  });
  
  console.log('\n📋 PREREQUISITES:');
  Object.entries(validationResults.prerequisites).forEach(([prereq, met]) => {
    const status = met ? '✅' : '❌';
    console.log(`   ${prereq}: ${status}`);
  });
  
  if (validationResults.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    validationResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  if (validationResults.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    validationResults.warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }
  
  // Determine if system is ready
  const isReady = validationResults.serverRunning && 
                  validationResults.errors.length === 0 &&
                  Object.values(validationResults.services).every(s => s.status === 'working');
  
  console.log(`\n${isReady ? '🎉' : '🚫'} SYSTEM STATUS: ${isReady ? 'READY FOR TESTING' : 'NOT READY'}`);
  
  if (!isReady) {
    console.log('\n🔧 TO FIX:');
    if (!validationResults.serverRunning) {
      console.log('   1. Start the server: npm start');
    }
    if (validationResults.errors.length > 0) {
      console.log('   2. Fix the errors listed above');
    }
    console.log('   3. Run this validation again: npm run test:validate');
  }
  
  return isReady;
}

// Main validation function
async function runValidation() {
  log('🚀 Starting Pre-Test Validation...', 'progress');
  
  const startTime = Date.now();
  
  try {
    // Check server first
    const serverOk = await checkServerRunning();
    if (!serverOk) {
      generateValidationReport();
      process.exit(1);
    }
    
    // Check prerequisites
    await checkPrerequisites();
    
    // Check services
    await checkApiEndpoints();
    await checkGoogleSheets();
    await checkGoogleDrive();
    await checkWebSocket();
    
    // Generate report
    const isReady = generateValidationReport();
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`\n🏁 Validation completed in ${duration} seconds`, 'success');
    
    // Exit with appropriate code
    process.exit(isReady ? 0 : 1);
    
  } catch (error) {
    log(`❌ Validation failed: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n🛑 Validation interrupted by user', 'warning');
  generateValidationReport();
  process.exit(1);
});

// Run validation
if (require.main === module) {
  runValidation().catch((error) => {
    log(`❌ Fatal error: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { runValidation, validationResults };
