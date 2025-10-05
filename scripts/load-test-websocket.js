#!/usr/bin/env node

/**
 * WebSocket Load Test Script
 * 
 * This script performs load testing on the WebSocket server by:
 * 1. Creating multiple concurrent connections
 * 2. Sending high-frequency messages
 * 3. Measuring performance metrics
 * 4. Testing connection limits
 */

const WebSocket = require('ws');

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:5000/ws/inventory';
const TEST_AGENCY = 'Load Test Agency';
const TEST_MONTH = '12';
const TEST_YEAR = '2025';
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS) || 100;
const MESSAGES_PER_CONNECTION = parseInt(process.env.MESSAGES_PER_CONNECTION) || 50;
const MESSAGE_INTERVAL = parseInt(process.env.MESSAGE_INTERVAL) || 100; // ms

// Test room URL
const roomUrl = `${WS_URL}/${encodeURIComponent(TEST_AGENCY)}/${TEST_MONTH}/${TEST_YEAR}`;

console.log('🚀 WebSocket Load Test Script');
console.log(`🔗 Target: ${roomUrl}`);
console.log(`📊 Max Connections: ${MAX_CONNECTIONS}`);
console.log(`📨 Messages per Connection: ${MESSAGES_PER_CONNECTION}`);
console.log(`⏱️ Message Interval: ${MESSAGE_INTERVAL}ms`);
console.log('');

// Metrics tracking
const metrics = {
  connectionsCreated: 0,
  connectionsFailed: 0,
  connectionsClosed: 0,
  messagesSent: 0,
  messagesReceived: 0,
  errors: 0,
  startTime: Date.now(),
  connectionTimes: [],
  messageLatencies: []
};

function createConnection(connectionId) {
  return new Promise((resolve, reject) => {
    const connectionStartTime = Date.now();
    const ws = new WebSocket(roomUrl);
    
    let messagesReceived = 0;
    let messagesSent = 0;
    let connectionEstablished = false;

    const timeout = setTimeout(() => {
      if (!connectionEstablished) {
        metrics.connectionsFailed++;
        ws.close();
        reject(new Error(`Connection ${connectionId} timeout`));
      }
    }, 10000);

    ws.on('open', () => {
      clearTimeout(timeout);
      connectionEstablished = true;
      metrics.connectionsCreated++;
      metrics.connectionTimes.push(Date.now() - connectionStartTime);
      
      console.log(`✅ Connection ${connectionId} established (${metrics.connectionsCreated}/${MAX_CONNECTIONS})`);

      // Send user joined message
      ws.send(JSON.stringify({
        type: 'user_joined',
        data: {
          agency: TEST_AGENCY,
          month: TEST_MONTH,
          year: parseInt(TEST_YEAR),
          userId: `load_test_user_${connectionId}`,
          userName: `Load Test User ${connectionId}`
        }
      }));

      // Send periodic messages
      const messageInterval = setInterval(() => {
        if (messagesSent >= MESSAGES_PER_CONNECTION) {
          clearInterval(messageInterval);
          ws.close();
          return;
        }

        const messageStartTime = Date.now();
        const messageId = `${connectionId}_${messagesSent}`;
        
        ws.send(JSON.stringify({
          type: 'scan_added',
          data: {
            agency: TEST_AGENCY,
            month: TEST_MONTH,
            year: parseInt(TEST_YEAR),
            userId: `load_test_user_${connectionId}`,
            userName: `Load Test User ${connectionId}`,
            scanData: {
              code: `LOAD_TEST_${messageId}`,
              user: `Load Test User ${connectionId}`,
              timestamp: new Date().toISOString()
            }
          }
        }));

        messagesSent++;
        metrics.messagesSent++;

        // Track latency
        setTimeout(() => {
          const latency = Date.now() - messageStartTime;
          metrics.messageLatencies.push(latency);
        }, 100);

      }, MESSAGE_INTERVAL);

      resolve({
        connectionId,
        messagesSent: 0,
        messagesReceived: 0,
        ws
      });
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        messagesReceived++;
        metrics.messagesReceived++;
        
        // Track latency for pong messages
        if (message.type === 'pong') {
          const latency = Date.now() - messageStartTime;
          metrics.messageLatencies.push(latency);
        }
      } catch (error) {
        metrics.errors++;
        console.error(`❌ Error parsing message for connection ${connectionId}:`, error);
      }
    });

    ws.on('close', (code, reason) => {
      metrics.connectionsClosed++;
      console.log(`🔌 Connection ${connectionId} closed: ${code} ${reason}`);
    });

    ws.on('error', (error) => {
      metrics.errors++;
      metrics.connectionsFailed++;
      console.error(`❌ Connection ${connectionId} error:`, error.message);
      reject(error);
    });
  });
}

function calculateStats() {
  const duration = Date.now() - metrics.startTime;
  const avgConnectionTime = metrics.connectionTimes.length > 0 
    ? metrics.connectionTimes.reduce((a, b) => a + b, 0) / metrics.connectionTimes.length 
    : 0;
  const avgMessageLatency = metrics.messageLatencies.length > 0 
    ? metrics.messageLatencies.reduce((a, b) => a + b, 0) / metrics.messageLatencies.length 
    : 0;
  const messagesPerSecond = metrics.messagesSent / (duration / 1000);
  const connectionsPerSecond = metrics.connectionsCreated / (duration / 1000);

  return {
    duration: duration / 1000, // seconds
    connectionsCreated: metrics.connectionsCreated,
    connectionsFailed: metrics.connectionsFailed,
    connectionsClosed: metrics.connectionsClosed,
    messagesSent: metrics.messagesSent,
    messagesReceived: metrics.messagesReceived,
    errors: metrics.errors,
    avgConnectionTime: Math.round(avgConnectionTime),
    avgMessageLatency: Math.round(avgMessageLatency),
    messagesPerSecond: Math.round(messagesPerSecond * 100) / 100,
    connectionsPerSecond: Math.round(connectionsPerSecond * 100) / 100,
    successRate: metrics.connectionsCreated > 0 
      ? Math.round((metrics.connectionsCreated / (metrics.connectionsCreated + metrics.connectionsFailed)) * 100)
      : 0
  };
}

function printStats(stats) {
  console.log('');
  console.log('📊 Load Test Results:');
  console.log(`   Duration: ${stats.duration}s`);
  console.log(`   Connections Created: ${stats.connectionsCreated}`);
  console.log(`   Connections Failed: ${stats.connectionsFailed}`);
  console.log(`   Connections Closed: ${stats.connectionsClosed}`);
  console.log(`   Messages Sent: ${stats.messagesSent}`);
  console.log(`   Messages Received: ${stats.messagesReceived}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`   Success Rate: ${stats.successRate}%`);
  console.log(`   Avg Connection Time: ${stats.avgConnectionTime}ms`);
  console.log(`   Avg Message Latency: ${stats.avgMessageLatency}ms`);
  console.log(`   Messages/Second: ${stats.messagesPerSecond}`);
  console.log(`   Connections/Second: ${stats.connectionsPerSecond}`);
  console.log('');
}

async function runLoadTest() {
  console.log('🚀 Starting load test...');
  
  const connections = [];
  const connectionPromises = [];

  // Create connections with staggered timing
  for (let i = 0; i < MAX_CONNECTIONS; i++) {
    const delay = i * 10; // 10ms between connection attempts
    
    connectionPromises.push(
      new Promise((resolve) => {
        setTimeout(async () => {
          try {
            const connection = await createConnection(i);
            connections.push(connection);
            resolve(connection);
          } catch (error) {
            console.error(`❌ Failed to create connection ${i}:`, error.message);
            resolve(null);
          }
        }, delay);
      })
    );
  }

  // Wait for all connections to be established
  await Promise.all(connectionPromises);

  // Wait for all messages to be sent
  console.log('⏳ Waiting for all messages to be sent...');
  await new Promise(resolve => setTimeout(resolve, MESSAGES_PER_CONNECTION * MESSAGE_INTERVAL + 5000));

  // Close all remaining connections
  console.log('🔌 Closing all connections...');
  connections.forEach(connection => {
    if (connection && connection.ws) {
      connection.ws.close();
    }
  });

  // Wait a bit more for cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));

  const stats = calculateStats();
  printStats(stats);

  return stats;
}

// Run the load test
if (require.main === module) {
  runLoadTest()
    .then((stats) => {
      if (stats.successRate >= 90 && stats.errors < 10) {
        console.log('🎉 Load test passed! WebSocket server handles load well.');
        process.exit(0);
      } else {
        console.log('⚠️ Load test completed with some issues. Check results above.');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Load test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runLoadTest };
