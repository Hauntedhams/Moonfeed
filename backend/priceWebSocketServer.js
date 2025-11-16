/**
 * Price WebSocket Server
 * 
 * Provides REAL-TIME price updates using 100% Solana Native RPC:
 * - Finds token's trading pool (Raydium/Orca/Pump.fun) via RPC
 * - Subscribes to pool account changes
 * - Parses reserves directly from on-chain data
 * - Calculates price from reserves
 * - NO third-party price APIs!
 */

const WebSocket = require('ws');
const PureRpcMonitor = require('./pureRpcMonitor');

class PriceWebSocketServer {
  constructor(solanaRpcEndpoint = 'https://api.mainnet-beta.solana.com') {
    // Use noServer mode - will be connected via WebSocketRouter
    this.wss = new WebSocket.Server({ 
      noServer: true,
      perMessageDeflate: false,
      clientTracking: true
    });
    
    console.log('[PriceWebSocketServer] Constructor - perMessageDeflate:', this.wss.options.perMessageDeflate);
    console.log('[PriceWebSocketServer] Using noServer mode for clean routing');
    console.log('[PriceWebSocketServer] Using 100% PURE SOLANA NATIVE RPC - No Price APIs!');
    
    this.monitor = new PureRpcMonitor();
    this.clients = new Map(); // clientWs -> Set of subscribed tokenAddresses
    
    this.init();
  }

  async init() {
    try {
      console.log('[PriceWebSocketServer] Pump.fun monitor ready');

      // Handle client connections
      this.wss.on('connection', (ws, req) => {
        const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
        console.log(`[PriceWebSocketServer] Client connected: ${clientId}`);
        console.log(`[PriceWebSocketServer] Connection extensions: ${req.headers['sec-websocket-extensions']}`);
        console.log(`[PriceWebSocketServer] WS extensions: ${ws.extensions}`);
        
        this.clients.set(ws, new Set());

        // Send welcome message with explicit no-compression option
        this.sendMessage(ws, {
          type: 'connected',
          message: 'Connected to price WebSocket server',
          timestamp: Date.now()
        });

        // Handle messages from client
        ws.on('message', async (message) => {
          try {
            console.log(`[PriceWebSocketServer] Received message from ${clientId}:`, message.toString().substring(0, 100));
            const data = JSON.parse(message.toString());
            await this.handleClientMessage(ws, data);
          } catch (error) {
            console.error('[PriceWebSocketServer] Error handling client message:', error);
            this.sendMessage(ws, {
              type: 'error',
              message: error.message
            });
          }
        });

        // Handle client disconnect
        ws.on('close', () => {
          console.log(`[PriceWebSocketServer] Client disconnected: ${clientId}`);
          this.handleClientDisconnect(ws);
        });

        ws.on('error', (error) => {
          console.error(`[PriceWebSocketServer] Client error (${clientId}):`, error.message);
        });
      });

      console.log('[PriceWebSocketServer] WebSocket server listening on /ws/price');
    } catch (error) {
      console.error('[PriceWebSocketServer] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Handle incoming messages from clients
   */
  async handleClientMessage(ws, data) {
    const { type, token } = data;

    switch (type) {
      case 'subscribe':
        if (!token) {
          throw new Error('Token address required for subscription');
        }
        await this.subscribeClient(ws, token);
        break;

      case 'unsubscribe':
        if (!token) {
          throw new Error('Token address required for unsubscription');
        }
        await this.unsubscribeClient(ws, token);
        break;

      case 'ping':
        this.sendMessage(ws, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        console.warn(`[PriceWebSocketServer] Unknown message type: ${type}`);
    }
  }

  /**
   * Subscribe a client to token price updates
   */
  async subscribeClient(ws, tokenAddress) {
    try {
      // Add to client's subscriptions
      const clientSubs = this.clients.get(ws);
      if (clientSubs.has(tokenAddress)) {
        console.log(`[PriceWebSocketServer] Client already subscribed to ${tokenAddress}`);
        return;
      }
      clientSubs.add(tokenAddress);

      // Subscribe to Pump.fun monitor
      await this.monitor.subscribe(tokenAddress, ws);

      // Send confirmation
      this.sendMessage(ws, {
        type: 'subscribed',
        token: tokenAddress,
        timestamp: Date.now()
      });

      console.log(`[PriceWebSocketServer] Client subscribed to ${tokenAddress}`);
    } catch (error) {
      console.error(`[PriceWebSocketServer] Error subscribing client to ${tokenAddress}:`, error);
      
      const errorMessage = {
        type: 'error',
        message: `Failed to subscribe to ${tokenAddress}: ${error.message}`,
        token: tokenAddress
      };
      console.log(`[PriceWebSocketServer] Sending error message to client:`, JSON.stringify(errorMessage));
      this.sendMessage(ws, errorMessage);
    }
  }

  /**
   * Unsubscribe a client from token price updates
   */
  async unsubscribeClient(ws, tokenAddress) {
    try {
      const clientSubs = this.clients.get(ws);
      if (!clientSubs || !clientSubs.has(tokenAddress)) {
        return;
      }

      clientSubs.delete(tokenAddress);
      await this.monitor.unsubscribe(tokenAddress, ws);

      this.sendMessage(ws, {
        type: 'unsubscribed',
        token: tokenAddress,
        timestamp: Date.now()
      });

      console.log(`[PriceWebSocketServer] Client unsubscribed from ${tokenAddress}`);
    } catch (error) {
      console.error(`[PriceWebSocketServer] Error unsubscribing client from ${tokenAddress}:`, error);
    }
  }

  /**
   * Handle client disconnection
   */
  handleClientDisconnect(ws) {
    const clientSubs = this.clients.get(ws);
    if (clientSubs) {
      // Unsubscribe from all tokens
      for (const tokenAddress of clientSubs) {
        this.monitor.unsubscribe(tokenAddress, ws);
      }
      this.clients.delete(ws);
    }
  }

  /**
   * Send a message to a client without compression
   */
  sendMessage(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data), {
        compress: false,
        binary: false,
        fin: true
      });
    }
  }

  /**
   * Close the server
   */
  async close() {
    await this.monitor.cleanup();
    this.wss.close();
    this.clients.clear();
  }
}

module.exports = PriceWebSocketServer;
