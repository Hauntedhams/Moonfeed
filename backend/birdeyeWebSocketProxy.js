/**
 * Birdeye WebSocket Proxy Server
 * 
 * This proxy server bridges the frontend and Birdeye's WebSocket API,
 * handling the required headers that browsers can't set directly.
 * 
 * Uses simple ws package for both client and server connections.
 */

const WebSocket = require('ws');

const BIRDEYE_API_KEY = '29e047952f0d45ed8927939bbc08f09c';
const BIRDEYE_WS_URL = 'wss://public-api.birdeye.so/socket/solana';

class BirdeyeWebSocketProxy {
  constructor() {
    try {
      console.log('🔧 Birdeye: Starting proxy initialization...');
      
      // Use noServer mode - will be connected via WebSocketRouter
      console.log('🔧 Birdeye: Creating WebSocket.Server...');
      this.wss = new WebSocket.Server({ 
        noServer: true,
        perMessageDeflate: false // Disable compression
      });
      
      console.log('🔧 Birdeye: Setting up server handlers...');
      this.setupServer();
      
      console.log('🦅 Birdeye WebSocket Proxy initialized (noServer mode)');
    } catch (error) {
      console.error('❌ Birdeye Proxy constructor error:', error);
      throw error;
    }
  }

  setupServer() {
    this.wss.on('connection', (clientSocket, req) => {
      console.log('📱 Frontend client connected to Birdeye proxy');
      
      let birdeyeSocket = null;

      // Forward messages from frontend client to Birdeye
      clientSocket.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('📤 Frontend → Birdeye:', data.type, data.data?.address || '');
          
          // If not connected to Birdeye yet, connect now
          if (!birdeyeSocket || birdeyeSocket.readyState !== WebSocket.OPEN) {
            console.log('🔌 Connecting to Birdeye WebSocket...');
            
            // Connect to Birdeye with proper headers
            birdeyeSocket = new WebSocket(
              `${BIRDEYE_WS_URL}?x-api-key=${BIRDEYE_API_KEY}`,
              {
                headers: {
                  'Origin': 'https://birdeye.so',
                  'User-Agent': 'Mozilla/5.0'
                },
                protocol: 'echo-protocol'
              }
            );

            birdeyeSocket.on('open', () => {
              console.log('✅ Connected to Birdeye WebSocket');
              // Send the queued message
              if (birdeyeSocket.readyState === WebSocket.OPEN) {
                birdeyeSocket.send(JSON.stringify(data));
              }
            });

            birdeyeSocket.on('message', (birdeyeData) => {
              console.log('📨 Birdeye → Frontend');
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(birdeyeData.toString());
              }
            });

            birdeyeSocket.on('error', (error) => {
              console.error('❌ Birdeye connection error:', error.message);
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify({
                  type: 'ERROR',
                  data: `Birdeye connection error: ${error.message}`
                }));
              }
            });

            birdeyeSocket.on('close', (code, reason) => {
              console.log(`🔌 Birdeye connection closed: ${code} ${reason}`);
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.close();
              }
            });

            birdeyeSocket.on('ping', () => {
              console.log('💓 Ping from Birdeye');
              birdeyeSocket.pong();
            });
          } else {
            // Already connected, just forward the message
            birdeyeSocket.send(JSON.stringify(data));
          }
        } catch (err) {
          console.error('❌ Error handling frontend message:', err);
        }
      });

      // Handle frontend client disconnect
      clientSocket.on('close', () => {
        console.log('📱 Frontend client disconnected');
        if (birdeyeSocket && birdeyeSocket.readyState === WebSocket.OPEN) {
          birdeyeSocket.close();
        }
      });

      // Handle frontend client errors
      clientSocket.on('error', (error) => {
        console.error('❌ Frontend client error:', error.message);
      });
    });

    this.wss.on('error', (error) => {
      console.error('❌ Proxy server error:', error.message);
    });
  }

  close() {
    this.wss.close();
    console.log('🔌 Birdeye WebSocket Proxy closed');
  }
}

module.exports = BirdeyeWebSocketProxy;
