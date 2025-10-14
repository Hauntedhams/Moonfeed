#!/usr/bin/env node

/**
 * PRICE UPDATE DIAGNOSTIC
 * 
 * Tests if prices are actually being updated from backend to frontend:
 * 1. Check if Jupiter Live Price Service is running
 * 2. Monitor WebSocket messages
 * 3. Track actual price changes
 * 4. Identify where the price update flow breaks
 */

require('dotenv').config();
const axios = require('axios');
const WebSocket = require('ws');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const WS_URL = BACKEND_URL.replace('http', 'ws');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function formatNumber(num) {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}k`;
  if (num >= 1) return `$${num.toFixed(4)}`;
  if (num >= 0.0001) return `$${num.toFixed(6)}`;
  return `$${num.toExponential(2)}`;
}

const priceHistory = new Map();
let wsMessageCount = 0;
let priceUpdateCount = 0;

async function checkJupiterService() {
  log('\n' + '='.repeat(70), 'bright');
  log('🔍 CHECKING JUPITER LIVE PRICE SERVICE', 'bright');
  log('='.repeat(70), 'bright');
  
  try {
    const response = await axios.get(`${BACKEND_URL}/api/health`, { timeout: 5000 });
    
    if (response.data) {
      log('✅ Backend is online', 'green');
      
      // Check if Jupiter service info is available
      if (response.data.jupiterLivePrice) {
        const jupiter = response.data.jupiterLivePrice;
        log(`\n📊 Jupiter Live Price Service:`, 'cyan');
        log(`   Status: ${jupiter.isRunning ? '✅ RUNNING' : '❌ STOPPED'}`, jupiter.isRunning ? 'green' : 'red');
        log(`   Coins tracked: ${jupiter.coinsTracked || 0}`, 'reset');
        log(`   Subscribers: ${jupiter.subscribers || 0}`, 'reset');
        log(`   Update frequency: ${jupiter.updateFrequency || 'Unknown'}ms`, 'reset');
        
        if (!jupiter.isRunning) {
          log('\n❌ PROBLEM FOUND: Jupiter Live Price Service is NOT RUNNING!', 'red');
          log('   This is why prices are not updating', 'red');
          return false;
        }
        
        if (jupiter.coinsTracked === 0) {
          log('\n⚠️  WARNING: Jupiter is running but tracking 0 coins', 'yellow');
          return false;
        }
        
        return true;
      } else {
        log('\n⚠️  Jupiter service status not available in health endpoint', 'yellow');
      }
    }
  } catch (error) {
    log(`❌ Error checking backend: ${error.message}`, 'red');
    return false;
  }
  
  return null;
}

async function monitorWebSocket() {
  log('\n' + '='.repeat(70), 'bright');
  log('🔌 MONITORING WEBSOCKET MESSAGES', 'bright');
  log('='.repeat(70), 'bright');
  
  return new Promise((resolve, reject) => {
    log(`\nConnecting to: ${WS_URL}`, 'cyan');
    
    const ws = new WebSocket(WS_URL);
    let connected = false;
    let messageTimeout;
    
    ws.on('open', () => {
      connected = true;
      log('✅ WebSocket connected', 'green');
      log('\n⏳ Listening for messages (will monitor for 30 seconds)...', 'yellow');
      
      // Set timeout to close after 30 seconds
      messageTimeout = setTimeout(() => {
        ws.close();
        resolve();
      }, 30000);
    });
    
    ws.on('message', (data) => {
      try {
        wsMessageCount++;
        const message = JSON.parse(data.toString());
        
        if (message.type === 'jupiter-prices-update') {
          priceUpdateCount++;
          log(`\n📨 Received price update #${priceUpdateCount}`, 'green');
          log(`   Coins in update: ${message.data?.length || 0}`, 'cyan');
          
          if (message.data && message.data.length > 0) {
            // Show first 3 price updates
            message.data.slice(0, 3).forEach((update, idx) => {
              const address = update.address || update.mintAddress;
              const price = update.price;
              const symbol = update.symbol || address.substring(0, 8);
              
              // Track price history
              if (!priceHistory.has(address)) {
                priceHistory.set(address, []);
              }
              const history = priceHistory.get(address);
              history.push({ price, timestamp: Date.now() });
              
              // Keep only last 10 prices
              if (history.length > 10) {
                history.shift();
              }
              
              // Check if price changed
              let changeIndicator = '';
              if (history.length > 1) {
                const previousPrice = history[history.length - 2].price;
                const change = ((price - previousPrice) / previousPrice) * 100;
                if (Math.abs(change) > 0.01) {
                  changeIndicator = change > 0 ? ` (🔺 +${change.toFixed(2)}%)` : ` (🔻 ${change.toFixed(2)}%)`;
                } else {
                  changeIndicator = ' (no change)';
                }
              }
              
              log(`   ${idx + 1}. ${symbol}: ${formatNumber(price)}${changeIndicator}`, 'reset');
            });
          }
        } else {
          log(`📨 Received message type: ${message.type}`, 'cyan');
        }
      } catch (error) {
        log(`⚠️  Error parsing message: ${error.message}`, 'yellow');
      }
    });
    
    ws.on('error', (error) => {
      log(`❌ WebSocket error: ${error.message}`, 'red');
      if (!connected) {
        reject(error);
      }
    });
    
    ws.on('close', () => {
      log('\n🔌 WebSocket disconnected', 'yellow');
      clearTimeout(messageTimeout);
      resolve();
    });
  });
}

async function checkAPIEndpoint() {
  log('\n' + '='.repeat(70), 'bright');
  log('🔍 CHECKING API PRICE UPDATES', 'bright');
  log('='.repeat(70), 'bright');
  
  try {
    log('\n📊 Fetching initial prices...', 'cyan');
    const response1 = await axios.get(`${BACKEND_URL}/api/coins/trending?limit=5`, { timeout: 10000 });
    
    if (!response1.data.success || !response1.data.coins) {
      throw new Error('Invalid response format');
    }
    
    const initialCoins = response1.data.coins;
    log(`✅ Got ${initialCoins.length} coins`, 'green');
    
    // Store initial prices
    const initialPrices = initialCoins.map(c => ({
      symbol: c.symbol,
      address: c.mintAddress,
      price: c.price_usd,
      timestamp: Date.now()
    }));
    
    // Wait 10 seconds
    log('\n⏳ Waiting 10 seconds...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Fetch again
    log('\n📊 Fetching updated prices...', 'cyan');
    const response2 = await axios.get(`${BACKEND_URL}/api/coins/trending?limit=5`, { timeout: 10000 });
    
    if (!response2.data.success || !response2.data.coins) {
      throw new Error('Invalid response format');
    }
    
    const updatedCoins = response2.data.coins;
    log(`✅ Got ${updatedCoins.length} coins`, 'green');
    
    // Compare prices
    log('\n📊 Price comparison:', 'cyan');
    let changedCount = 0;
    
    initialPrices.forEach((initial, idx) => {
      const updated = updatedCoins.find(c => c.mintAddress === initial.address);
      
      if (updated) {
        const change = updated.price_usd - initial.price;
        const changePct = ((change / initial.price) * 100).toFixed(4);
        
        if (Math.abs(change) > 0.000001) {
          changedCount++;
          const color = change > 0 ? 'green' : 'red';
          log(`   ${idx + 1}. ${initial.symbol}: ${formatNumber(initial.price)} → ${formatNumber(updated.price_usd)} (${changePct > 0 ? '+' : ''}${changePct}%)`, color);
        } else {
          log(`   ${idx + 1}. ${initial.symbol}: ${formatNumber(initial.price)} (no change)`, 'yellow');
        }
      }
    });
    
    if (changedCount === 0) {
      log('\n⚠️  NO PRICE CHANGES DETECTED via API', 'yellow');
      log('   This could mean:', 'yellow');
      log('   - Prices are cached and not being updated', 'yellow');
      log('   - Jupiter service is not running', 'yellow');
      log('   - Low volume coins with stable prices', 'yellow');
      return false;
    } else {
      log(`\n✅ ${changedCount}/${initialPrices.length} prices changed via API`, 'green');
      return true;
    }
    
  } catch (error) {
    log(`❌ Error checking API: ${error.message}`, 'red');
    return false;
  }
}

async function runDiagnostic() {
  log('\n' + '='.repeat(70), 'bright');
  log('🔬 PRICE UPDATE DIAGNOSTIC', 'bright');
  log('='.repeat(70), 'bright');
  log(`Backend: ${BACKEND_URL}`, 'cyan');
  log(`WebSocket: ${WS_URL}`, 'cyan');
  
  // Step 1: Check Jupiter service
  const jupiterRunning = await checkJupiterService();
  
  // Step 2: Check API endpoint prices
  const apiUpdating = await checkAPIEndpoint();
  
  // Step 3: Monitor WebSocket
  if (jupiterRunning !== false) {
    await monitorWebSocket();
  } else {
    log('\n⚠️  Skipping WebSocket test - Jupiter service not running', 'yellow');
  }
  
  // Summary
  log('\n' + '='.repeat(70), 'bright');
  log('📊 DIAGNOSTIC SUMMARY', 'bright');
  log('='.repeat(70), 'bright');
  
  log(`\n1️⃣ Jupiter Service Status: ${jupiterRunning ? '✅ RUNNING' : jupiterRunning === false ? '❌ STOPPED' : '⚠️  UNKNOWN'}`, 
      jupiterRunning ? 'green' : 'red');
  
  log(`2️⃣ API Price Updates: ${apiUpdating ? '✅ WORKING' : '❌ NOT WORKING'}`, 
      apiUpdating ? 'green' : 'red');
  
  log(`3️⃣ WebSocket Messages: ${wsMessageCount} total, ${priceUpdateCount} price updates`, 
      priceUpdateCount > 0 ? 'green' : 'yellow');
  
  if (priceUpdateCount > 0) {
    const uniqueCoins = priceHistory.size;
    let coinsWithChanges = 0;
    
    priceHistory.forEach((history, address) => {
      if (history.length > 1) {
        const firstPrice = history[0].price;
        const lastPrice = history[history.length - 1].price;
        if (Math.abs(lastPrice - firstPrice) > 0.000001) {
          coinsWithChanges++;
        }
      }
    });
    
    log(`   Unique coins tracked: ${uniqueCoins}`, 'cyan');
    log(`   Coins with price changes: ${coinsWithChanges}`, coinsWithChanges > 0 ? 'green' : 'yellow');
  }
  
  log('\n💡 DIAGNOSIS:', 'cyan');
  
  if (jupiterRunning === false) {
    log('   ❌ PROBLEM: Jupiter Live Price Service is NOT RUNNING', 'red');
    log('   📝 Solution: The service needs to be started in server.js', 'yellow');
    log('      Add: jupiterLivePriceService.start(currentCoins)', 'yellow');
  } else if (!apiUpdating && priceUpdateCount === 0) {
    log('   ❌ PROBLEM: Prices are not being updated at all', 'red');
    log('   📝 Check: Backend logs for Jupiter API errors', 'yellow');
  } else if (apiUpdating && priceUpdateCount === 0) {
    log('   ⚠️  PARTIAL: API updates but WebSocket not broadcasting', 'yellow');
    log('   📝 Check: WebSocket connection and broadcasting logic', 'yellow');
  } else if (!apiUpdating && priceUpdateCount > 0) {
    log('   ⚠️  PARTIAL: WebSocket working but API not reflecting updates', 'yellow');
    log('   📝 Check: Price update flow in server.js', 'yellow');
  } else {
    log('   ✅ Everything appears to be working', 'green');
    log('   📝 Note: Low-volume coins may not see price changes quickly', 'yellow');
  }
  
  log('\n');
}

runDiagnostic().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
