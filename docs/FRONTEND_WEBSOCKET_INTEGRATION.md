# Frontend WebSocket Integration Guide

## Overview

This guide provides the frontend implementation details needed to integrate with the WebSocket backend for real-time inventory management collaboration.

## 🚨 Common Errors & Solutions

### 1. 404 Error - Wrong Port
If you're getting a 404 error when calling the finish-session endpoint, make sure you're using the correct API base URL:

**❌ Wrong (causes 404):**
```javascript
fetch('http://localhost:3000/api/inventory/finish-session', ...)
```

**✅ Correct (Environment-driven):**
```javascript
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
fetch(`${API_BASE_URL}/api/inventory/finish-session`, ...)
```

**Environment Variables Setup:**
```bash
# .env file in your frontend project
REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_WS_BASE_URL=ws://localhost:5000

# Production
REACT_APP_API_BASE_URL=https://your-backend-domain.com
REACT_APP_WS_BASE_URL=wss://your-backend-domain.com
```

### 2. 400 Error - Inventory Already Completed
If you're getting a 400 error with "already completed" message, this is a **race condition** where multiple users tried to complete the same inventory simultaneously.

**✅ Handle this gracefully:**
```javascript
if (response.status === 400 && errorData.message?.includes('already completed')) {
  // Show user-friendly message
  this.showNotification('Inventory was already completed by another user', 'info');
  
  // Handle session termination
  this.handleSessionTerminated({
    completedBy: 'Another user',
    message: 'Inventory was completed by another user'
  });
  
  return { success: false, alreadyCompleted: true };
}
```

## Configuration

### Environment Variables Setup
Create a `.env` file in your frontend project root:

```bash
# Frontend Environment Variables
REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_WS_BASE_URL=ws://localhost:5000

# Production (update these for your domain)
# REACT_APP_API_BASE_URL=https://your-backend-domain.com
# REACT_APP_WS_BASE_URL=wss://your-backend-domain.com
```

### API Base URL Configuration
```javascript
// Environment-driven configuration
const config = {
  apiBaseUrl: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000',
  wsBaseUrl: process.env.REACT_APP_WS_BASE_URL || 'ws://localhost:5000'
};
```

## WebSocket Connection

### Connection URL Format
```
{WEBSOCKET_BASE_URL}/ws/inventory/{agency}/{month}/{year}
```

**Examples:**
- Development: `ws://localhost:5000/ws/inventory/Alfa%20Romeo/10/2025`
- Production: `wss://your-backend-domain.com/ws/inventory/Alfa%20Romeo/10/2025`

### Example Connection
```javascript
const agency = 'Alfa Romeo';
const month = '10';
const year = '2025';
const wsUrl = `${config.wsBaseUrl}/ws/inventory/${encodeURIComponent(agency)}/${month}/${year}`;
const ws = new WebSocket(wsUrl);
```

## Required Implementation

### 1. WebSocket Client Setup

```javascript
class InventoryWebSocketClient {
  constructor(agency, month, year, userId, userName, config = currentConfig) {
    this.agency = agency;
    this.month = month;
    this.year = year;
    this.userId = userId;
    this.userName = userName;
    this.config = config;
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1 second
  }

  connect() {
    const wsUrl = `${this.config.wsBaseUrl}/ws/inventory/${encodeURIComponent(this.agency)}/${this.month}/${this.year}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.sendUserJoined();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  sendUserJoined() {
    this.send({
      type: 'user_joined',
      data: {
        agency: this.agency,
        month: this.month,
        year: parseInt(this.year),
        userId: this.userId,
        userName: this.userName
      }
    });
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
```

### 2. Message Handling

```javascript
handleMessage(message) {
  switch (message.type) {
    case 'user_joined':
      this.handleUserJoined(message.data);
      break;
    case 'scan_added':
      this.handleScanAdded(message.data);
      break;
    case 'scan_removed':
      this.handleScanRemoved(message.data);
      break;
    case 'inventory_completed':
      this.handleInventoryCompleted(message.data);
      break;
    case 'session_terminated':
      this.handleSessionTerminated(message.data);
      break;
    case 'pong':
      // Handle ping/pong for health checks
      break;
    case 'error':
      console.error('WebSocket error:', message.data.message);
      break;
    default:
      console.warn('Unknown message type:', message.type);
  }
}

handleUserJoined(data) {
  // Show notification that another user joined
  this.showNotification(`${data.userName} joined the inventory`);
  
  // Update UI to show active users
  this.updateActiveUsers(data);
}

handleScanAdded(data) {
  // Add scan to UI if it's not from current user
  if (data.userId !== this.userId) {
    this.addScanToUI(data.scanData);
    this.showNotification(`${data.userName} added scan: ${data.scanData.code}`);
  }
}

handleScanRemoved(data) {
  // Remove scan from UI if it's not from current user
  if (data.userId !== this.userId) {
    this.removeScanFromUI(data.scanData.code);
    this.showNotification(`${data.userName} removed scan: ${data.scanData.code}`);
  }
}

handleInventoryCompleted(data) {
  // Show completion notification
  this.showNotification(`Inventory completed by ${data.completedBy}`);
  
  // Disable inventory interface
  this.disableInventoryInterface();
}

handleSessionTerminated(data) {
  // Show session termination notification
  this.showNotification(data.message);
  
  // Close WebSocket connection
  this.disconnect();
  
  // Redirect or show completion screen
  this.handleSessionEnd();
}
```

### 3. Integration with Inventory Actions

```javascript
// When user adds a scan
async addScan(barcode) {
  try {
    // Send to API (this will automatically trigger WebSocket notification)
    const response = await fetch(`${this.config.apiBaseUrl}/api/inventory/save-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agency: this.agency,
        month: this.month,
        year: this.year,
        code: barcode,
        user: this.userId,
        userName: this.userName
      })
    });

    if (response.ok) {
      // Scan will be added to UI via WebSocket notification
      console.log('Scan added successfully');
    }
  } catch (error) {
    console.error('Error adding scan:', error);
  }
}

// When user removes a scan
async removeScan(barcode) {
  try {
    const response = await fetch(`${this.config.apiBaseUrl}/api/inventory/delete-scanned-entry`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agency: this.agency,
        barcode: barcode,
        month: this.month,
        year: this.year
      })
    });

    if (response.ok) {
      // Scan will be removed from UI via WebSocket notification
      console.log('Scan removed successfully');
    }
  } catch (error) {
    console.error('Error removing scan:', error);
  }
}

// When user completes inventory
async completeInventory() {
  try {
    const response = await fetch(`${this.config.apiBaseUrl}/api/inventory/finish-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agency: this.agency,
        month: this.month,
        year: this.year,
        user: this.userId
      })
    });

    if (response.ok) {
      // This will automatically send completion notifications to all users
      console.log('Inventory completed successfully');
      return { success: true };
    } else {
      const errorData = await response.json();
      
      // Handle specific error cases
      if (response.status === 400 && errorData.message?.includes('already completed')) {
        console.log('Inventory was already completed by another user');
        return { 
          success: false, 
          alreadyCompleted: true, 
          message: 'Inventory was already completed by another user' 
        };
      }
      
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error completing inventory:', error);
    return { success: false, error: error.message };
  }
}
```

### 4. UI Components

```javascript
// Active users indicator
updateActiveUsers(userData) {
  const usersList = document.getElementById('active-users');
  // Update the list of active users in the room
}

// Real-time scan list
addScanToUI(scanData) {
  const scanList = document.getElementById('scan-list');
  const scanElement = document.createElement('div');
  scanElement.className = 'scan-item';
  scanElement.innerHTML = `
    <span class="barcode">${scanData.code}</span>
    <span class="user">${scanData.user}</span>
    <span class="time">${new Date(scanData.timestamp).toLocaleTimeString()}</span>
  `;
  scanList.appendChild(scanElement);
}

// Notification system
showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Session termination handling
handleSessionEnd() {
  // Show completion screen or redirect
  // Disable all inventory actions
  // Close WebSocket connection
}
```

### 5. Connection Management

```javascript
// Initialize WebSocket when starting inventory
function startInventory(agency, month, year, userId, userName) {
  const wsClient = new InventoryWebSocketClient(agency, month, year, userId, userName);
  wsClient.connect();
  
  // Store reference for later use
  window.inventoryWS = wsClient;
  
  return wsClient;
}

// Cleanup when leaving inventory
function stopInventory() {
  if (window.inventoryWS) {
    window.inventoryWS.disconnect();
    window.inventoryWS = null;
  }
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  stopInventory();
});
```

## Message Types Reference

### Outgoing Messages (Client → Server)

| Type | Description | Data |
|------|-------------|------|
| `user_joined` | User joins inventory room | `{agency, month, year, userId, userName}` |
| `scan_added` | User adds a scan | `{agency, month, year, userId, userName, scanData}` |
| `scan_removed` | User removes a scan | `{agency, month, year, userId, userName, scanData}` |
| `ping` | Health check | `{timestamp}` |

### Incoming Messages (Server → Client)

| Type | Description | Data |
|------|-------------|------|
| `user_joined` | Another user joined | `{agency, month, year, userId, userName, timestamp}` |
| `scan_added` | Scan was added | `{agency, month, year, userId, userName, scanData, timestamp}` |
| `scan_removed` | Scan was removed | `{agency, month, year, userId, userName, scanData, timestamp}` |
| `inventory_completed` | Inventory completed | `{agency, month, year, completedBy, inventoryId, message, timestamp}` |
| `session_terminated` | Session ended | `{agency, month, year, completedBy, message, timestamp}` |
| `pong` | Health check response | `{timestamp}` |
| `error` | Error message | `{message, timestamp}` |

## Best Practices

### 1. Connection Lifecycle
- Connect when user starts inventory
- Send `user_joined` message immediately after connection
- Implement automatic reconnection with exponential backoff
- Disconnect when user leaves inventory

### 2. Error Handling
- Handle connection failures gracefully
- Show user-friendly error messages
- Implement retry logic for failed operations
- Handle session termination scenarios

### 3. Race Condition Prevention
- **Disable completion button** after first click to prevent double-submission
- **Listen for WebSocket notifications** to handle completion by other users
- **Check inventory status** before allowing completion
- **Show loading states** during API calls

```javascript
// Prevent race conditions
class InventoryManager {
  constructor() {
    this.isCompleting = false;
  }

  async completeInventory() {
    if (this.isCompleting) {
      console.log('Completion already in progress');
      return;
    }

    this.isCompleting = true;
    this.disableCompletionButton();

    try {
      const result = await this.wsClient.completeInventory();
      
      if (result.alreadyCompleted) {
        // Handle gracefully - another user completed it
        this.handleAlreadyCompleted();
      } else if (result.success) {
        // Success - show completion message
        this.showCompletionSuccess();
      }
    } catch (error) {
      console.error('Completion failed:', error);
      this.showCompletionError();
    } finally {
      this.isCompleting = false;
      this.enableCompletionButton();
    }
  }

  handleSessionTerminated(data) {
    // Called when WebSocket receives session_terminated message
    this.isCompleting = true; // Prevent further completion attempts
    this.disableCompletionButton();
    this.showNotification(data.message, 'info');
  }
}
```

### 4. UI Updates
- Update UI in real-time based on WebSocket messages
- Show visual indicators for active users
- Display notifications for all inventory events
- Handle concurrent user interactions smoothly

### 5. Performance
- Debounce rapid UI updates
- Implement message queuing for offline scenarios
- Use efficient data structures for scan lists
- Minimize DOM manipulations

## Testing

### Connection Test
```javascript
// Test WebSocket connection
const testWS = new WebSocket('ws://localhost:5000/ws/inventory/Alfa%20Romeo/10/2025');
testWS.onopen = () => console.log('Connection test passed');
testWS.onerror = () => console.log('Connection test failed');
```

### Message Flow Test
```javascript
// Test message sending and receiving
wsClient.send({
  type: 'ping',
  data: { timestamp: new Date().toISOString() }
});
```

## Production Considerations

### 1. Security
- Implement authentication if required
- Validate all incoming messages
- Sanitize user inputs
- Use WSS (secure WebSocket) in production

### 2. Scalability
- Handle large numbers of concurrent users
- Implement message throttling if needed
- Consider message queuing for high-traffic scenarios

### 3. Monitoring
- Log WebSocket connection events
- Monitor message delivery success rates
- Track user activity and engagement

## Example Complete Integration

```javascript
// Complete example for React component
import React, { useEffect, useState } from 'react';

function InventoryPage({ agency, month, year, userId, userName }) {
  const [wsClient, setWsClient] = useState(null);
  const [scans, setScans] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [isInventoryActive, setIsInventoryActive] = useState(true);

  useEffect(() => {
    const client = new InventoryWebSocketClient(agency, month, year, userId, userName);
    client.connect();
    
    // Override message handlers
    client.handleScanAdded = (data) => {
      if (data.userId !== userId) {
        setScans(prev => [...prev, data.scanData]);
      }
    };
    
    client.handleSessionTerminated = () => {
      setIsInventoryActive(false);
    };
    
    setWsClient(client);
    
    return () => client.disconnect();
  }, [agency, month, year, userId, userName]);

  const addScan = async (barcode) => {
    if (wsClient) {
      await wsClient.addScan(barcode);
    }
  };

  return (
    <div>
      <h1>Inventory: {agency} - {month}/{year}</h1>
      <div>Active Users: {activeUsers.length}</div>
      <div>Scans: {scans.length}</div>
      {isInventoryActive && (
        <button onClick={() => addScan('TEST123')}>
          Add Test Scan
        </button>
      )}
    </div>
  );
}
```

This implementation provides a complete real-time collaborative inventory management experience where multiple users can work together seamlessly with instant updates across all connected clients.
