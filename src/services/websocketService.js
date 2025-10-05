const WebSocket = require('ws');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.activeConnections = new Map(); // roomKey -> Set of connections
    this.userSessions = new Map(); // userId -> connection info
    this.rateLimits = new Map(); // userId_type -> rate limit info
    this.metrics = {
      totalConnections: 0,
      messagesSent: 0,
      roomsActive: 0,
      errors: 0
    };
    
    // Configuration from environment variables
    this.MAX_CONNECTIONS_PER_ROOM = parseInt(process.env.WEBSOCKET_MAX_CONNECTIONS_PER_ROOM) || 50;
    this.RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
    this.RATE_LIMIT_MAX_MESSAGES = parseInt(process.env.WEBSOCKET_RATE_LIMIT_MAX_MESSAGES) || 100;
    this.HEARTBEAT_INTERVAL = parseInt(process.env.WEBSOCKET_HEARTBEAT_INTERVAL) || 30000; // 30 seconds
    this.ROOM_CLEANUP_INTERVAL = 60000; // 1 minute
  }

  initialize(server) {
    console.log('🔌 Initializing WebSocket service...');
    
    this.wss = new WebSocket.Server({ 
      server
      // Remove the path restriction to allow /ws/inventory/{agency}/{month}/{year}
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      console.error('❌ WebSocket server error:', error);
    });

    // Handle upgrade requests
    server.on('upgrade', (request, socket, head) => {
      console.log('🔄 WebSocket upgrade request:', request.url);
    });

    // Log when WebSocket server is ready
    this.wss.on('listening', () => {
      console.log('✅ WebSocket server is listening');
    });

    // Start background tasks
    this.startHeartbeat();
    this.startRoomCleanup();
    this.startMetricsLogging();

    console.log('✅ WebSocket service initialized');
    return this.wss;
  }

  handleConnection(ws, req) {
    console.log('🔗 New WebSocket connection established');
    
    try {
      // Extract room information from URL
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/').filter(part => part !== '');
      
      console.log('🔍 WebSocket path parts:', pathParts);
      console.log('🔍 Full URL:', req.url);
      
      // Check if this is a WebSocket inventory request
      if (pathParts.length >= 4 && pathParts[0] === 'ws' && pathParts[1] === 'inventory') {
        const agency = decodeURIComponent(pathParts[2]);
        const month = pathParts[3];
        const year = pathParts[4];
        
        console.log('🔍 Parsed room info:', { agency, month, year });
        
        if (!agency || !month || !year) {
          console.log('❌ Invalid WebSocket path - missing room parameters');
          ws.close(1008, 'Invalid path - missing room parameters');
          return;
        }
        
        const roomKey = `${agency}/${month}/${year}`;
        
        // Add connection to room
        if (!this.addConnectionToRoom(ws, roomKey)) {
          return; // Connection was closed due to room being full
        }
        
        // Store connection info
        ws.roomKey = roomKey;
        ws.agency = agency;
        ws.month = month;
        ws.year = year;
        ws.isAlive = true;
        ws.connectedAt = new Date();
        
        console.log(`👤 User connected to room: ${roomKey}`);
        
        // Handle incoming messages
        ws.on('message', (data) => {
          this.handleMessage(ws, data);
        });
        
        // Handle connection close
        ws.on('close', (code, reason) => {
          console.log(`🔌 WebSocket connection closed: ${code} ${reason}`);
          this.removeConnectionFromRoom(ws);
        });
        
        // Handle connection errors
        ws.on('error', (error) => {
          console.error('❌ WebSocket error:', error);
          this.metrics.errors++;
          this.removeConnectionFromRoom(ws);
        });

        // Setup heartbeat
        ws.on('pong', () => {
          ws.isAlive = true;
        });
        
      } else {
        console.log('❌ Invalid WebSocket path - not an inventory WebSocket request');
        console.log('❌ Expected format: /ws/inventory/{agency}/{month}/{year}');
        console.log('❌ Received path:', req.url);
        ws.close(1008, 'Invalid path - not an inventory WebSocket');
      }
    } catch (error) {
      console.error('❌ Error handling WebSocket connection:', error);
      ws.close(1008, 'Connection error');
    }
  }

  addConnectionToRoom(ws, roomKey) {
    if (!this.activeConnections.has(roomKey)) {
      this.activeConnections.set(roomKey, new Set());
    }
    
    const roomConnections = this.activeConnections.get(roomKey);
    
    if (roomConnections.size >= this.MAX_CONNECTIONS_PER_ROOM) {
      console.log(`🚫 Room ${roomKey} is full (${this.MAX_CONNECTIONS_PER_ROOM} connections)`);
      ws.close(1008, 'Room is full');
      return false;
    }
    
    roomConnections.add(ws);
    this.metrics.totalConnections = this.wss.clients.size;
    this.metrics.roomsActive = this.activeConnections.size;
    
    return true;
  }

  removeConnectionFromRoom(ws) {
    if (ws.roomKey && this.activeConnections.has(ws.roomKey)) {
      const roomConnections = this.activeConnections.get(ws.roomKey);
      roomConnections.delete(ws);
      
      if (roomConnections.size === 0) {
        this.activeConnections.delete(ws.roomKey);
      }
      
      console.log(`👋 User disconnected from room: ${ws.roomKey}`);
      this.metrics.totalConnections = this.wss.clients.size;
      this.metrics.roomsActive = this.activeConnections.size;
    }
  }

  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      const { type, data: messageData } = message;
      
      if (!ws.roomKey) {
        this.sendError(ws, 'No room assigned');
        return;
      }
      
      const roomConnections = this.activeConnections.get(ws.roomKey);
      if (!roomConnections) {
        this.sendError(ws, 'Room not found');
        return;
      }
      
      // Rate limiting
      if (!this.checkRateLimit(ws.userId || 'anonymous', type)) {
        this.sendError(ws, 'Rate limit exceeded');
        return;
      }
      
      switch (type) {
        case 'user_joined':
          this.handleUserJoined(ws, roomConnections, messageData);
          break;
          
        case 'scan_added':
          this.handleScanAdded(ws, roomConnections, messageData);
          break;
          
        case 'scan_removed':
          this.handleScanRemoved(ws, roomConnections, messageData);
          break;
          
        case 'inventory_completed':
          this.handleInventoryCompleted(ws, roomConnections, messageData);
          break;
          
        case 'ping':
          this.sendMessage(ws, { type: 'pong', data: { timestamp: new Date().toISOString() } });
          break;
          
        default:
          console.warn(`⚠️ Unknown message type: ${type}`);
          this.sendError(ws, `Unknown message type: ${type}`);
      }
      
      this.metrics.messagesSent++;
      
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
      this.metrics.errors++;
      this.sendError(ws, 'Invalid message format');
    }
  }

  // Message handlers
  handleUserJoined(ws, roomConnections, data) {
    // Store user info
    ws.userId = data.userId;
    ws.userName = data.userName;
    
    // Store user session
    this.userSessions.set(data.userId, {
      roomKey: ws.roomKey,
      connectedAt: ws.connectedAt,
      ws: ws
    });
    
    // Broadcast to all users in room except sender
    this.broadcastToRoom(roomConnections, ws, {
      type: 'user_joined',
      data: {
        agency: data.agency,
        month: data.month,
        year: data.year,
        userId: data.userId,
        userName: data.userName,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log(`👥 User ${data.userName} joined room ${ws.roomKey}`);
  }

  handleScanAdded(ws, roomConnections, data) {
    // Broadcast to all users in room
    this.broadcastToRoom(roomConnections, ws, {
      type: 'scan_added',
      data: {
        agency: data.agency,
        month: data.month,
        year: data.year,
        userId: data.userId,
        userName: data.userName,
        scanData: data.scanData,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log(`📱 Scan added by ${data.userName}: ${data.scanData.code}`);
  }

  handleScanRemoved(ws, roomConnections, data) {
    // Broadcast to all users in room
    this.broadcastToRoom(roomConnections, ws, {
      type: 'scan_removed',
      data: {
        agency: data.agency,
        month: data.month,
        year: data.year,
        userId: data.userId,
        userName: data.userName,
        scanData: data.scanData,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log(`🗑️ Scan removed by ${data.userName}: ${data.scanData.code}`);
  }

  handleInventoryCompleted(ws, roomConnections, data) {
    // Broadcast completion to all users in room
    this.broadcastToRoom(roomConnections, ws, {
      type: 'inventory_completed',
      data: {
        agency: data.agency,
        month: data.month,
        year: data.year,
        completedBy: data.completedBy,
        inventoryId: data.inventoryId,
        message: data.message,
        timestamp: new Date().toISOString()
      }
    });
    
    // Also send session_terminated to all users
    this.broadcastToRoom(roomConnections, ws, {
      type: 'session_terminated',
      data: {
        agency: data.agency,
        month: data.month,
        year: data.year,
        completedBy: data.completedBy,
        message: `Tu sesión ha sido terminada porque ${data.completedBy} completó el inventario.`,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log(`✅ Inventory completed by ${data.completedBy} in room ${ws.roomKey}`);
  }

  // Broadcasting and utility methods
  broadcastToRoom(roomConnections, senderWs, message) {
    let sentCount = 0;
    
    roomConnections.forEach(ws => {
      if (ws !== senderWs && ws.readyState === WebSocket.OPEN) {
        try {
          this.sendMessage(ws, message);
          sentCount++;
        } catch (error) {
          console.error('❌ Error sending message to client:', error);
          this.metrics.errors++;
          // Remove broken connection
          roomConnections.delete(ws);
        }
      }
    });
    
    console.log(`📡 Broadcasted message to ${sentCount} clients`);
    this.metrics.messagesSent += sentCount;
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendError(ws, message) {
    this.sendMessage(ws, {
      type: 'error',
      data: { 
        message,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Rate limiting
  checkRateLimit(userId, type) {
    const key = `${userId}_${type}`;
    const now = Date.now();
    const limit = this.rateLimits.get(key) || { count: 0, resetTime: now + this.RATE_LIMIT_WINDOW_MS };
    
    if (now > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = now + this.RATE_LIMIT_WINDOW_MS;
    }
    
    if (limit.count >= this.RATE_LIMIT_MAX_MESSAGES) {
      return false;
    }
    
    limit.count++;
    this.rateLimits.set(key, limit);
    return true;
  }

  // Room management utilities
  getRoomStats() {
    const stats = {};
    this.activeConnections.forEach((connections, roomKey) => {
      stats[roomKey] = {
        userCount: connections.size,
        users: Array.from(connections).map(ws => ({
          userId: ws.userId,
          userName: ws.userName,
          connectedAt: ws.connectedAt
        }))
      };
    });
    return stats;
  }

  getUsersInRoom(agency, month, year) {
    const roomKey = `${agency}/${month}/${year}`;
    const connections = this.activeConnections.get(roomKey);
    
    if (!connections) return [];
    
    return Array.from(connections).map(ws => ({
      userId: ws.userId,
      userName: ws.userName,
      connectedAt: ws.connectedAt
    }));
  }

  isUserInRoom(userId, agency, month, year) {
    const roomKey = `${agency}/${month}/${year}`;
    const connections = this.activeConnections.get(roomKey);
    
    if (!connections) return false;
    
    return Array.from(connections).some(ws => ws.userId === userId);
  }

  // API integration methods
  notifyInventoryCompleted(agency, month, year, completedBy, inventoryId, message) {
    const roomKey = `${agency}/${month}/${year}`;
    const roomConnections = this.activeConnections.get(roomKey);
    
    if (roomConnections && roomConnections.size > 0) {
      // Send inventory completed notification
      this.broadcastToRoom(roomConnections, null, {
        type: 'inventory_completed',
        data: {
          agency,
          month,
          year,
          completedBy,
          inventoryId,
          message: message || `El inventario ha sido completado por ${completedBy}.`,
          timestamp: new Date().toISOString()
        }
      });
      
      // Send session terminated notification
      this.broadcastToRoom(roomConnections, null, {
        type: 'session_terminated',
        data: {
          agency,
          month,
          year,
          completedBy,
          message: `Tu sesión ha sido terminada porque ${completedBy} completó el inventario.`,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`📢 Notified ${roomConnections.size} users about inventory completion`);
      return true;
    }
    
    return false;
  }

  notifyScanAdded(agency, month, year, userId, userName, code, user) {
    const roomKey = `${agency}/${month}/${year}`;
    const roomConnections = this.activeConnections.get(roomKey);
    
    if (roomConnections && roomConnections.size > 0) {
      this.broadcastToRoom(roomConnections, null, {
        type: 'scan_added',
        data: {
          agency,
          month,
          year,
          userId,
          userName,
          scanData: {
            code,
            user: user || userName,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`📱 Notified ${roomConnections.size} users about scan: ${code}`);
      return true;
    }
    
    return false;
  }

  notifyScanRemoved(agency, month, year, userId, userName, code, user) {
    const roomKey = `${agency}/${month}/${year}`;
    const roomConnections = this.activeConnections.get(roomKey);
    
    if (roomConnections && roomConnections.size > 0) {
      this.broadcastToRoom(roomConnections, null, {
        type: 'scan_removed',
        data: {
          agency,
          month,
          year,
          userId,
          userName,
          scanData: {
            code,
            user: user || userName,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`🗑️ Notified ${roomConnections.size} users about scan removal: ${code}`);
      return true;
    }
    
    return false;
  }

  // Background tasks
  startHeartbeat() {
    setInterval(() => {
      if (!this.wss) return;
      
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          console.log('💀 Terminating dead connection');
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  startRoomCleanup() {
    setInterval(() => {
      this.activeConnections.forEach((connections, roomKey) => {
        if (connections.size === 0) {
          this.activeConnections.delete(roomKey);
          console.log(`🧹 Cleaned up empty room: ${roomKey}`);
        }
      });
      
      // Clean up rate limits
      const now = Date.now();
      this.rateLimits.forEach((limit, key) => {
        if (now > limit.resetTime) {
          this.rateLimits.delete(key);
        }
      });
    }, this.ROOM_CLEANUP_INTERVAL);
  }

  startMetricsLogging() {
    setInterval(() => {
      this.updateMetrics();
      console.log('📊 WebSocket Metrics:', {
        ...this.metrics,
        activeRooms: Object.keys(this.getRoomStats()).length,
        userSessions: this.userSessions.size
      });
    }, 300000); // Every 5 minutes
  }

  updateMetrics() {
    this.metrics.totalConnections = this.wss ? this.wss.clients.size : 0;
    this.metrics.roomsActive = this.activeConnections.size;
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeRooms: Object.keys(this.getRoomStats()).length,
      userSessions: this.userSessions.size,
      timestamp: new Date().toISOString()
    };
  }

  // Graceful shutdown
  shutdown() {
    console.log('🛑 Shutting down WebSocket service...');
    
    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        ws.close(1001, 'Server shutting down');
      });
      
      this.wss.close();
    }
    
    this.activeConnections.clear();
    this.userSessions.clear();
    this.rateLimits.clear();
    
    console.log('✅ WebSocket service shutdown complete');
  }
}

// Export singleton instance
const websocketService = new WebSocketService();
module.exports = websocketService;
