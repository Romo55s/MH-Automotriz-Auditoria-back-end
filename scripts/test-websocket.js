#!/usr/bin/env node

/**
 * WebSocket Test Script
 * 
 * This script tests the WebSocket functionality by:
 * 1. Connecting to the WebSocket server
 * 2. Joining a room
 * 3. Sending test messages
 * 4. Verifying message handling
 */

const WebSocket = require('ws');

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:5000/ws/inventory';
const TEST_AGENCY = 'Alfa Romeo';
const TEST_MONTH = '10';
const TEST_YEAR = '2025';
const TEST_USER_ID = 'test_user_123';
const TEST_USER_NAME = 'Test User';

// Test room URL
const roomUrl = `${WS_URL}/${encodeURIComponent(TEST_AGENCY)}/${TEST_MONTH}/${TEST_YEAR}`;

console.log('🧪 WebSocket Test Script');
console.log(`🔗 Connecting to: ${roomUrl}`);
console.log('');

function runWebSocketTest() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(roomUrl);
    let testResults = {
      connection: false,
      userJoined: false,
      scanAdded: false,
      scanRemoved: false,
      pingPong: false,
      errors: []
    };

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Test timeout after 30 seconds'));
    }, 30000);

    ws.on('open', () => {
      console.log('✅ WebSocket connection established');
      testResults.connection = true;

      // Test 1: Send user_joined message
      setTimeout(() => {
        console.log('📤 Sending user_joined message...');
        ws.send(JSON.stringify({
          type: 'user_joined',
          data: {
            agency: TEST_AGENCY,
            month: TEST_MONTH,
            year: parseInt(TEST_YEAR),
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME
          }
        }));
      }, 1000);

      // Test 2: Send scan_added message
      setTimeout(() => {
        console.log('📤 Sending scan_added message...');
        ws.send(JSON.stringify({
          type: 'scan_added',
          data: {
            agency: TEST_AGENCY,
            month: TEST_MONTH,
            year: parseInt(TEST_YEAR),
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            scanData: {
              code: 'TEST_BARCODE_123',
              user: TEST_USER_NAME,
              timestamp: new Date().toISOString()
            }
          }
        }));
      }, 2000);

      // Test 3: Send scan_removed message
      setTimeout(() => {
        console.log('📤 Sending scan_removed message...');
        ws.send(JSON.stringify({
          type: 'scan_removed',
          data: {
            agency: TEST_AGENCY,
            month: TEST_MONTH,
            year: parseInt(TEST_YEAR),
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            scanData: {
              code: 'TEST_BARCODE_123',
              user: TEST_USER_NAME,
              timestamp: new Date().toISOString()
            }
          }
        }));
      }, 3000);

      // Test 4: Send ping message
      setTimeout(() => {
        console.log('📤 Sending ping message...');
        ws.send(JSON.stringify({
          type: 'ping',
          data: {
            timestamp: new Date().toISOString()
          }
        }));
      }, 4000);

      // Test 5: Send invalid message
      setTimeout(() => {
        console.log('📤 Sending invalid message...');
        ws.send(JSON.stringify({
          type: 'invalid_type',
          data: {
            test: 'invalid'
          }
        }));
      }, 5000);

      // Close connection after tests
      setTimeout(() => {
        console.log('🔌 Closing connection...');
        ws.close();
      }, 6000);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log(`📥 Received: ${message.type}`, message.data);

        switch (message.type) {
          case 'user_joined':
            testResults.userJoined = true;
            console.log('✅ User joined message handled correctly');
            break;
          case 'scan_added':
            testResults.scanAdded = true;
            console.log('✅ Scan added message handled correctly');
            break;
          case 'scan_removed':
            testResults.scanRemoved = true;
            console.log('✅ Scan removed message handled correctly');
            break;
          case 'pong':
            testResults.pingPong = true;
            console.log('✅ Ping/Pong working correctly');
            break;
          case 'error':
            console.log('⚠️ Received error:', message.data.message);
            testResults.errors.push(message.data.message);
            break;
          default:
            console.log('📨 Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error);
        testResults.errors.push(`Parse error: ${error.message}`);
      }
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      console.log(`🔌 Connection closed: ${code} ${reason}`);
      
      // Print test results
      console.log('');
      console.log('📊 Test Results:');
      console.log(`   Connection: ${testResults.connection ? '✅' : '❌'}`);
      console.log(`   User Joined: ${testResults.userJoined ? '✅' : '❌'}`);
      console.log(`   Scan Added: ${testResults.scanAdded ? '✅' : '❌'}`);
      console.log(`   Scan Removed: ${testResults.scanRemoved ? '✅' : '❌'}`);
      console.log(`   Ping/Pong: ${testResults.pingPong ? '✅' : '❌'}`);
      
      if (testResults.errors.length > 0) {
        console.log(`   Errors: ${testResults.errors.length}`);
        testResults.errors.forEach(error => {
          console.log(`     - ${error}`);
        });
      }
      
      const allTestsPassed = testResults.connection && testResults.userJoined && 
                           testResults.scanAdded && testResults.scanRemoved && testResults.pingPong;
      
      if (allTestsPassed) {
        console.log('');
        console.log('🎉 All tests passed! WebSocket service is working correctly.');
        resolve(testResults);
      } else {
        console.log('');
        console.log('❌ Some tests failed. Check the results above.');
        reject(new Error('Some tests failed'));
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.error('❌ WebSocket error:', error);
      testResults.errors.push(`Connection error: ${error.message}`);
      reject(error);
    });
  });
}

// Run the test
if (require.main === module) {
  runWebSocketTest()
    .then(() => {
      console.log('✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runWebSocketTest };
