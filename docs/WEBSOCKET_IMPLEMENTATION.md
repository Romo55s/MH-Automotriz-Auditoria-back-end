# WebSocket Implementation Guide

## Overview

This document describes the WebSocket implementation for the car inventory management system. The WebSocket system enables real-time collaboration between multiple users working on the same inventory, providing instant notifications for all inventory events.

## Architecture

### Components

1. **WebSocketService** (`src/services/websocketService.js`) - Core WebSocket server implementation
2. **Main Server Integration** (`src/index.js`) - HTTP server with WebSocket upgrade
3. **API Integration** (`src/routes/inventoryRoutes.js`) - WebSocket notifications from REST API
4. **Test Scripts** (`scripts/test-websocket.js`, `scripts/load-test-websocket.js`) - Testing and validation

### Connection Flow

```
Client → WebSocket Connection → Room Assignment → Message Handling → Broadcasting
```

## WebSocket Endpoint

- **URL**: `ws://localhost:5000/ws/inventory/{agency}/{month}/{year}`
- **Protocol**: WebSocket
- **Path**: `/ws/inventory` (configurable via `WEBSOCKET_PATH` env var)

### Room Structure

Rooms are organized by agency, month, and year:
- Format: `{agency}/{month}/{year}`
- Example: `Alfa Romeo/10/2025`
- URL encoding required for agency names with spaces

## Message Types

### 1. Client → Server Messages

#### `user_joined`
Sent when a user connects to a room.

```json
{
  "type": "user_joined",
  "data": {
    "agency": "Alfa Romeo",
    "month": "10",
    "year": 2025,
    "userId": "user123",
    "userName": "John Doe"
  }
}
```

#### `scan_added`
Sent when a user adds a scan to the inventory.

```json
{
  "type": "scan_added",
  "data": {
    "agency": "Alfa Romeo",
    "month": "10",
    "year": 2025,
    "userId": "user123",
    "userName": "John Doe",
    "scanData": {
      "code": "BARCODE123",
      "user": "John Doe",
      "timestamp": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

#### `scan_removed`
Sent when a user removes a scan from the inventory.

```json
{
  "type": "scan_removed",
  "data": {
    "agency": "Alfa Romeo",
    "month": "10",
    "year": 2025,
    "userId": "user123",
    "userName": "John Doe",
    "scanData": {
      "code": "BARCODE123",
      "user": "John Doe",
      "timestamp": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

#### `inventory_completed`
Sent when a user completes the inventory.

```json
{
  "type": "inventory_completed",
  "data": {
    "agency": "Alfa Romeo",
    "month": "10",
    "year": 2025,
    "completedBy": "John Doe",
    "inventoryId": "inv_123",
    "message": "El inventario ha sido completado por John Doe."
  }
}
```

#### `ping`
Health check message.

```json
{
  "type": "ping",
  "data": {
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

### 2. Server → Client Messages

#### `user_joined`
Broadcast when a user joins the room.

```json
{
  "type": "user_joined",
  "data": {
    "agency": "Alfa Romeo",
    "month": "10",
    "year": 2025,
    "userId": "user123",
    "userName": "John Doe",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

#### `scan_added`
Broadcast when a scan is added.

```json
{
  "type": "scan_added",
  "data": {
    "agency": "Alfa Romeo",
    "month": "10",
    "year": 2025,
    "userId": "user123",
    "userName": "John Doe",
    "scanData": {
      "code": "BARCODE123",
      "user": "John Doe",
      "timestamp": "2025-01-15T10:30:00.000Z"
    },
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

#### `scan_removed`
Broadcast when a scan is removed.

```json
{
  "type": "scan_removed",
  "data": {
    "agency": "Alfa Romeo",
    "month": "10",
    "year": 2025,
    "userId": "user123",
    "userName": "John Doe",
    "scanData": {
      "code": "BARCODE123",
      "user": "John Doe",
      "timestamp": "2025-01-15T10:30:00.000Z"
    },
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

#### `inventory_completed`
Broadcast when inventory is completed.

```json
{
  "type": "inventory_completed",
  "data": {
    "agency": "Alfa Romeo",
    "month": "10",
    "year": 2025,
    "completedBy": "John Doe",
    "inventoryId": "inv_123",
    "message": "El inventario ha sido completado por John Doe.",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

#### `session_terminated`
Broadcast when inventory is completed (terminates all sessions).

```json
{
  "type": "session_terminated",
  "data": {
    "agency": "Alfa Romeo",
    "month": "10",
    "year": 2025,
    "completedBy": "John Doe",
    "message": "Tu sesión ha sido terminada porque John Doe completó el inventario.",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

#### `pong`
Response to ping message.

```json
{
  "type": "pong",
  "data": {
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

#### `error`
Error message.

```json
{
  "type": "error",
  "data": {
    "message": "Rate limit exceeded",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

## API Integration

The WebSocket service integrates with existing REST API endpoints:

### Inventory Routes Integration

1. **POST /api/inventory/save-scan**
   - Automatically broadcasts `scan_added` message to room participants

2. **POST /api/inventory/finish-session**
   - Automatically broadcasts `inventory_completed` and `session_terminated` messages

3. **DELETE /api/inventory/delete-scanned-entry**
   - Automatically broadcasts `scan_removed` message (when month/year provided)

### WebSocket Management Routes

1. **GET /api/inventory/websocket/room-info/{agency}/{month}/{year}**
   - Returns information about users in a specific room

2. **GET /api/inventory/websocket/metrics**
   - Returns WebSocket server metrics and statistics

## Configuration

### Environment Variables

```env
# WebSocket path for inventory real-time updates
WEBSOCKET_PATH=/ws/inventory

# Maximum connections per room (default: 50)
WEBSOCKET_MAX_CONNECTIONS_PER_ROOM=50

# Rate limiting for WebSocket messages (messages per minute per user per type)
WEBSOCKET_RATE_LIMIT_MAX_MESSAGES=100

# Heartbeat interval in milliseconds (default: 30 seconds)
WEBSOCKET_HEARTBEAT_INTERVAL=30000
```

## Security Features

### Rate Limiting
- 100 messages per minute per user per message type
- Configurable via `WEBSOCKET_RATE_LIMIT_MAX_MESSAGES`
- Automatic cleanup of expired rate limits

### Connection Limits
- Maximum 50 connections per room (configurable)
- Automatic rejection of connections when room is full
- Graceful handling of connection failures

### Input Validation
- JSON message format validation
- Required field validation
- Error handling for malformed messages

## Performance Features

### Connection Health Monitoring
- Ping/pong heartbeat every 30 seconds
- Automatic cleanup of dead connections
- Connection timeout handling

### Memory Management
- Automatic cleanup of empty rooms
- Rate limit cleanup
- Connection tracking and metrics

### Broadcasting Optimization
- Efficient room-based broadcasting
- Error handling for broken connections
- Message delivery tracking

## Monitoring and Metrics

### Health Check Integration
- WebSocket metrics included in `/health/detailed` endpoint
- Real-time connection and room statistics
- Error tracking and reporting

### Metrics Available
- Total active connections
- Active rooms count
- Messages sent/received
- Error count
- User sessions tracking
- Connection latency statistics

## Testing

### Unit Testing
```bash
npm run test:websocket
```

Tests:
- Connection establishment
- Message handling
- Room management
- Error handling
- Ping/pong functionality

### Load Testing
```bash
npm run test:websocket:load
```

Tests:
- Multiple concurrent connections
- High-frequency messaging
- Connection limits
- Performance under load
- Error rate monitoring

### Manual Testing

1. **Connect to WebSocket**:
   ```javascript
   const ws = new WebSocket('ws://localhost:5000/ws/inventory/Alfa%20Romeo/10/2025');
   ```

2. **Send test message**:
   ```javascript
   ws.send(JSON.stringify({
     type: 'user_joined',
     data: {
       agency: 'Alfa Romeo',
       month: '10',
       year: 2025,
       userId: 'test123',
       userName: 'Test User'
     }
   }));
   ```

## Deployment

### Production Considerations

1. **Load Balancing**: WebSocket connections are sticky - use session affinity
2. **Scaling**: Consider Redis for multi-instance WebSocket communication
3. **Monitoring**: Monitor connection counts and message rates
4. **SSL/TLS**: Use `wss://` for secure WebSocket connections in production

### Render Deployment

The WebSocket service is automatically started with the main server. No additional configuration needed for Render deployment.

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if server is running on correct port
   - Verify WebSocket path is correct
   - Check firewall settings

2. **Room Not Found**
   - Verify agency, month, year parameters
   - Check URL encoding for agency names with spaces
   - Ensure room format is correct

3. **Rate Limit Exceeded**
   - Reduce message frequency
   - Check for message loops
   - Adjust rate limit configuration

4. **High Memory Usage**
   - Check for connection leaks
   - Monitor room cleanup
   - Review connection limits

### Debugging

Enable debug logging by setting:
```env
DEBUG=websocket:*
```

Check WebSocket metrics:
```bash
curl http://localhost:5000/api/inventory/websocket/metrics
```

## Frontend Integration

The frontend should implement WebSocket client with:

1. **Connection Management**
   - Automatic reconnection on disconnect
   - Connection state tracking
   - Error handling

2. **Message Handling**
   - Message type routing
   - UI updates based on messages
   - User notifications

3. **Room Management**
   - Join room on inventory start
   - Leave room on inventory end
   - Handle session termination

Example frontend WebSocket client:
```javascript
const ws = new WebSocket('ws://localhost:5000/ws/inventory/Alfa%20Romeo/10/2025');

ws.onopen = () => {
  // Send user joined message
  ws.send(JSON.stringify({
    type: 'user_joined',
    data: {
      agency: 'Alfa Romeo',
      month: '10',
      year: 2025,
      userId: currentUser.id,
      userName: currentUser.name
    }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'scan_added':
      // Update UI with new scan
      break;
    case 'inventory_completed':
      // Show completion notification
      break;
    case 'session_terminated':
      // Handle session termination
      break;
  }
};
```

## Conclusion

The WebSocket implementation provides a robust, scalable real-time communication system for the inventory management application. It supports multiple concurrent users, provides comprehensive error handling, and integrates seamlessly with the existing REST API.

Key benefits:
- Real-time collaboration
- Instant notifications
- Scalable architecture
- Comprehensive monitoring
- Production-ready features
