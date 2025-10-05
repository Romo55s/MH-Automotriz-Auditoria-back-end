#!/usr/bin/env node

/**
 * API WebSocket Integration Test
 * Tests if WebSocket notifications are sent when API endpoints are called
 */

const WebSocket = require('ws');
const axios = require('axios');

console.log('🧪 API WebSocket Integration Test');

async function testApiWebSocketIntegration() {
  const baseUrl = 'http://localhost:5000/api/inventory';
  const wsUrl = 'ws://localhost:5000/ws/inventory/Alfa%20Romeo/10/2025';
  
  console.log('🔗 Connecting to WebSocket...');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let messagesReceived = 0;
    const expectedMessages = ['user_joined', 'scan_added']; // We'll test scan_added via API
    
    ws.on('open', async () => {
      console.log('✅ WebSocket connection established');
      
      // Send user joined message
      ws.send(JSON.stringify({
        type: 'user_joined',
        data: {
          agency: 'Alfa Romeo',
          month: '10',
          year: 2025,
          userId: 'api_test_user',
          userName: 'API Test User'
        }
      }));
      
      // Wait a bit for user joined to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        console.log('📤 Testing API call that should trigger WebSocket notification...');
        
        // Make API call to save scan (this should trigger WebSocket notification)
        const response = await axios.post(`${baseUrl}/save-scan`, {
          agency: 'Alfa Romeo',
          month: '10',
          year: '2025',
          code: 'API_TEST_BARCODE_123',
          user: 'api_test_user',
          userName: 'API Test User'
        });
        
        console.log('✅ API call successful:', response.data);
        
        // Wait for WebSocket notification
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`📊 Received ${messagesReceived} WebSocket messages`);
        
        if (messagesReceived >= 1) { // At least the scan_added notification
          console.log('🎉 API WebSocket integration test passed!');
          ws.close();
          resolve();
        } else {
          console.log('❌ No WebSocket notifications received from API call');
          ws.close();
          reject(new Error('No WebSocket notifications received'));
        }
        
      } catch (error) {
        console.error('❌ API call failed:', error.response?.data || error.message);
        ws.close();
        reject(error);
      }
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        messagesReceived++;
        console.log(`📥 Received WebSocket message: ${message.type}`);
        
        if (message.type === 'scan_added') {
          console.log('✅ Received scan_added notification from API call!');
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    });
    
    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket connection closed: ${code} ${reason}`);
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      console.log('⏰ Test timeout');
      ws.close();
      reject(new Error('Test timeout'));
    }, 10000);
  });
}

// Run the test
testApiWebSocketIntegration()
  .then(() => {
    console.log('✅ API WebSocket integration test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ API WebSocket integration test failed:', error.message);
    process.exit(1);
  });
