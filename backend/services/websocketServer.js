const WebSocket = require('ws');
const priceEngine = require('./priceEngine');

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map();
    this.setupWebSocket();
    console.log('🌐 WebSocket server initialized');
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      const clientIP = req.socket.remoteAddress || 'unknown';
      console.log(`🔗 New WebSocket client connected: ${clientId} from ${clientIP}`);
      
      // Store client with metadata
      this.clients.set(clientId, {
        ws: ws,
        subscriptions: new Set(),
        lastActivity: Date.now(),
        connectedAt: Date.now(),
        ip: clientIP
      });

      // Add to price engine
      priceEngine.addClient(ws);

      // Send initial data immediately
      try {
        ws.send(JSON.stringify({
          type: 'welcome',
          clientId: clientId,
          timestamp: Date.now(),
          message: 'Connected to MoonFeed live data stream'
        }));

        // Send current data snapshot
        const currentData = priceEngine.getPricesData();
        if (currentData.length > 0) {
          ws.send(JSON.stringify({
            type: 'initial',
            data: {
              coins: currentData,
              charts: []
            },
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error(`Error sending initial data to ${clientId}:`, error.message);
      }

      // Handle messages from client
      ws.on('message', (message) => {
        this.handleMessage(clientId, message);
      });

      // Handle client disconnect
      ws.on('close', (code, reason) => {
        console.log(`🔌 Client disconnected: ${clientId} (${code}: ${reason || 'No reason'})`);
        priceEngine.removeClient(ws);
        this.clients.delete(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for client ${clientId}:`, error.message);
        priceEngine.removeClient(ws);
        this.clients.delete(clientId);
      });

      // Handle pong responses
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastActivity = Date.now();
        }
      });

      // Ping to keep connection alive every 30 seconds
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.ping();
          } catch (error) {
            console.error(`Ping error for ${clientId}:`, error.message);
            clearInterval(pingInterval);
          }
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

      // Clean up interval when client disconnects
      ws.on('close', () => {
        clearInterval(pingInterval);
      });
    });

    // Listen for price updates from engine
    priceEngine.on('prices-updated', (data) => {
      this.broadcastPriceUpdate(data);
    });

    priceEngine.on('market-updated', (data) => {
      this.broadcastMarketUpdate(data);
    });

    // Clean up stale connections every 5 minutes
    setInterval(() => {
      this.cleanupStaleConnections();
    }, 5 * 60 * 1000);
  }

  handleMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);
      
      if (!client) {
        console.warn(`Message from unknown client: ${clientId}`);
        return;
      }

      console.log(`📨 Message from ${clientId}:`, data.type);

      switch (data.type) {
        case 'subscribe':
          // Subscribe to specific coins
          if (data.coins && Array.isArray(data.coins)) {
            data.coins.forEach(coin => client.subscriptions.add(coin));
            console.log(`📋 Client ${clientId} subscribed to ${data.coins.length} coins`);
          }
          break;
          
        case 'unsubscribe':
          // Unsubscribe from coins
          if (data.coins && Array.isArray(data.coins)) {
            data.coins.forEach(coin => client.subscriptions.delete(coin));
            console.log(`📋 Client ${clientId} unsubscribed from ${data.coins.length} coins`);
          }
          break;
          
        case 'ping':
          // Respond to ping
          this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
          break;

        case 'status':
          // Send server status
          this.sendToClient(clientId, {
            type: 'status',
            data: {
              connectedClients: this.clients.size,
              priceEngineStatus: priceEngine.getStatus(),
              serverTime: Date.now()
            }
          });
          break;

        default:
          console.warn(`Unknown message type from ${clientId}:`, data.type);
      }
      
      client.lastActivity = Date.now();
    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error.message);
    }
  }

  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Error sending to client ${clientId}:`, error.message);
      this.clients.delete(clientId);
      return false;
    }
  }

  broadcastPriceUpdate(updateData) {
    if (this.clients.size === 0) return;

    const message = JSON.stringify({
      type: 'price-update',
      data: updateData.data,
      timestamp: updateData.timestamp
    });

    this.broadcast(message, 'price-update');
  }

  broadcastMarketUpdate(updateData) {
    if (this.clients.size === 0) return;

    const message = JSON.stringify({
      type: 'market-update',
      data: updateData.data,
      timestamp: updateData.timestamp
    });

    this.broadcast(message, 'market-update');
  }

  broadcast(message, messageType = 'unknown') {
    let successCount = 0;
    let failureCount = 0;

    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
          successCount++;
        } catch (error) {
          console.error(`Broadcast error to ${clientId}:`, error.message);
          this.clients.delete(clientId);
          failureCount++;
        }
      } else {
        this.clients.delete(clientId);
        failureCount++;
      }
    });

    if (successCount > 0) {
      console.log(`📡 Broadcasted ${messageType} to ${successCount} clients${failureCount > 0 ? ` (${failureCount} failed)` : ''}`);
    }
  }

  cleanupStaleConnections() {
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    let cleanedCount = 0;

    this.clients.forEach((client, clientId) => {
      const isStale = (now - client.lastActivity) > staleThreshold;
      const isClosed = client.ws.readyState !== WebSocket.OPEN;

      if (isStale || isClosed) {
        console.log(`🧹 Cleaning up stale connection: ${clientId}`);
        try {
          client.ws.close();
        } catch (error) {
          // Ignore errors when closing
        }
        priceEngine.removeClient(client.ws);
        this.clients.delete(clientId);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} stale connections. Active: ${this.clients.size}`);
    }
  }

  generateClientId() {
    return 'client_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Public methods for server management
  getConnectedClients() {
    return this.clients.size;
  }

  getClientInfo() {
    const info = [];
    this.clients.forEach((client, clientId) => {
      info.push({
        id: clientId,
        ip: client.ip,
        connectedAt: client.connectedAt,
        lastActivity: client.lastActivity,
        subscriptions: client.subscriptions.size,
        status: client.ws.readyState === WebSocket.OPEN ? 'connected' : 'disconnected'
      });
    });
    return info;
  }

  shutdown() {
    console.log('🛑 Shutting down WebSocket server...');
    
    // Notify all clients of shutdown
    this.broadcast(JSON.stringify({
      type: 'server-shutdown',
      message: 'Server is shutting down',
      timestamp: Date.now()
    }));

    // Close all connections
    this.clients.forEach((client, clientId) => {
      try {
        client.ws.close(1001, 'Server shutdown');
      } catch (error) {
        // Ignore errors during shutdown
      }
    });

    // Close the WebSocket server
    this.wss.close(() => {
      console.log('✅ WebSocket server shut down complete');
    });
  }
}

module.exports = WebSocketServer;
