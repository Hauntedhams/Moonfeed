/**
 * WebSocket Router
 * 
 * Centralized WebSocket routing to prevent multiple servers from
 * interfering with each other's connections.
 * 
 * This ensures clean separation:
 * - /ws/price → PriceWebSocketServer (Solana RPC only)
 * - /birdeye-ws → BirdeyeWebSocketProxy
 * - /ws → Main WebSocket server
 */

const url = require('url');

class WebSocketRouter {
  constructor(server) {
    this.server = server;
    this.routes = new Map();
    
    // Handle HTTP upgrade requests
    this.server.on('upgrade', (request, socket, head) => {
      const pathname = url.parse(request.url).pathname;
      
      console.log(`[WebSocketRouter] Upgrade request for path: ${pathname}`);
      
      const handler = this.routes.get(pathname);
      
      if (handler) {
        handler(request, socket, head);
      } else {
        console.warn(`[WebSocketRouter] No handler for path: ${pathname}`);
        socket.destroy();
      }
    });
    
    console.log('[WebSocketRouter] Initialized');
  }
  
  /**
   * Register a WebSocket server for a specific path
   */
  register(path, wss) {
    console.log(`[WebSocketRouter] Registering handler for ${path}`);
    
    this.routes.set(path, (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });
  }
}

module.exports = WebSocketRouter;
