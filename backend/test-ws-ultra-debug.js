/**
 * Ultra-detailed debug WebSocket client
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class DebugWebSocket extends EventEmitter {
  constructor(url) {
    super();
    this.ws = new WebSocket(url, {
      perMessageDeflate: false
    });
    
    this.messageCount = 0;
    
    this.ws.on('open', () => {
      console.log('✅ Connection opened');
      console.log('Extensions:', this.ws.extensions || 'none');
      this.emit('open');
    });
    
    this.ws.on('message', (data, isBinary) => {
      this.messageCount++;
      console.log(`\n📨 Message #${this.messageCount} received:`);
      console.log('  Binary:', isBinary);
      console.log('  Length:', data.length);
      console.log('  First 100 bytes:', data.toString().substring(0, 100));
      
      try {
        const parsed = JSON.parse(data.toString());
        console.log('  Parsed:', parsed.type);
        this.emit('message', parsed);
      } catch (e) {
        console.log('  Parse error:', e.message);
      }
    });
    
    this.ws.on('error', (error) => {
      console.error(`\n❌ Error after ${this.messageCount} messages:`, error.message);
      console.error('Stack:', error.stack);
    });
    
    this.ws.on('close', (code, reason) => {
      console.log(`\n🔌 Closed: ${code} - ${reason || 'no reason'}`);
      this.emit('close');
    });
  }
  
  send(data) {
    console.log(`\n📤 Sending:`, JSON.stringify(data).substring(0, 100));
    this.ws.send(JSON.stringify(data), { compress: false });
  }
  
  close() {
    this.ws.close();
  }
}

// Test
const ws = new DebugWebSocket('ws://localhost:3001/ws/price');

ws.on('open', () => {
  setTimeout(() => {
    ws.send({ type: 'ping' });
  }, 100);
});

ws.on('message', (msg) => {
  if (msg.type === 'pong') {
    console.log('\n✅ Pong received successfully!');
    setTimeout(() => {
      ws.send({ type: 'subscribe', token: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' });
    }, 100);
  } else if (msg.type === 'subscribed') {
    console.log('\n✅ Subscribed successfully!');
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 1000);
  }
});

ws.on('close', () => {
  setTimeout(() => process.exit(1), 100);
});

setTimeout(() => {
  console.log('\n⏱️  Timeout');
  ws.close();
  process.exit(1);
}, 10000);
