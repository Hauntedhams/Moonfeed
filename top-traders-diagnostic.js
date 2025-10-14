#!/usr/bin/env node

/**
 * TOP TRADERS DIAGNOSTIC
 * 
 * Tests the "Load Top Traders" functionality:
 * 1. Check if the backend endpoint exists and responds
 * 2. Test the API with various mint addresses
 * 3. Check response format and data quality
 * 4. Identify why it might be failing
 */

require('dotenv').config();
const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

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
  if (!num && num !== 0) return 'N/A';
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}k`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  return `$${num.toFixed(4)}`;
}

async function checkBackendHealth() {
  log('\n' + '='.repeat(70), 'bright');
  log('🔍 CHECKING BACKEND HEALTH', 'bright');
  log('='.repeat(70), 'bright');
  
  try {
    const response = await axios.get(`${BACKEND_URL}/api/health`, { timeout: 5000 });
    log('✅ Backend is online', 'green');
    return true;
  } catch (error) {
    log(`❌ Backend is offline: ${error.message}`, 'red');
    return false;
  }
}

async function getTestCoins() {
  log('\n' + '='.repeat(70), 'bright');
  log('🪙 GETTING TEST COINS', 'bright');
  log('='.repeat(70), 'bright');
  
  try {
    log('\nFetching trending coins for test data...', 'cyan');
    const response = await axios.get(`${BACKEND_URL}/api/coins/trending?limit=5`, { timeout: 10000 });
    
    if (!response.data.success || !response.data.coins) {
      throw new Error('Invalid response format');
    }
    
    const coins = response.data.coins;
    log(`✅ Got ${coins.length} coins for testing`, 'green');
    
    coins.forEach((coin, idx) => {
      log(`   ${idx + 1}. ${coin.symbol} - ${coin.mintAddress}`, 'reset');
    });
    
    return coins;
  } catch (error) {
    log(`❌ Error fetching test coins: ${error.message}`, 'red');
    return [];
  }
}

async function testTopTradersEndpoint(mintAddress, symbol) {
  log('\n' + '-'.repeat(70), 'cyan');
  log(`🎯 TESTING: ${symbol} (${mintAddress})`, 'bright');
  log('-'.repeat(70), 'cyan');
  
  const endpoint = `${BACKEND_URL}/api/top-traders/${mintAddress}`;
  
  try {
    log(`\n📡 Calling: GET ${endpoint}`, 'cyan');
    const startTime = Date.now();
    
    const response = await axios.get(endpoint, { 
      timeout: 30000,  // 30 second timeout
      validateStatus: function (status) {
        return status < 500; // Don't throw for 4xx errors
      }
    });
    
    const duration = Date.now() - startTime;
    log(`⏱️  Response time: ${duration}ms`, 'yellow');
    log(`📊 Status code: ${response.status}`, response.status === 200 ? 'green' : 'red');
    
    // Log response structure
    log('\n📦 Response structure:', 'cyan');
    log(`   success: ${response.data.success}`, response.data.success ? 'green' : 'red');
    
    if (response.data.error) {
      log(`   ❌ Error: ${response.data.error}`, 'red');
    }
    
    if (response.data.message) {
      log(`   💬 Message: ${response.data.message}`, 'yellow');
    }
    
    // Check for traders in different response formats
    const traders = response.data.topTraders || response.data.data || response.data.traders || [];
    const traderCount = Array.isArray(traders) ? traders.length : 0;
    
    if (traderCount > 0) {
      log(`   👥 Top traders count: ${traderCount}`, 'green');
      
      log('\n   📋 Sample traders:', 'cyan');
      traders.slice(0, 3).forEach((trader, idx) => {
        log(`      ${idx + 1}. ${trader.wallet?.substring(0, 8)}...`, 'reset');
        log(`         Held: ${formatNumber(trader.held || 0)}`, 'reset');
        log(`         Total: ${formatNumber(trader.total || 0)}`, 'reset');
        log(`         Realized: ${formatNumber(trader.realized || 0)}`, 'reset');
        log(`         Buys: ${trader.tx_counts?.buys || 'N/A'} | Sells: ${trader.tx_counts?.sells || 'N/A'}`, 'reset');
      });
    } else {
      log(`   ⚠️  No traders in response`, 'yellow');
    }
    
    // Check for data source info
    if (response.data.source) {
      log(`\n   🔍 Data source: ${response.data.source}`, 'cyan');
    }
    
    if (response.data.cached) {
      log(`   💾 Cached: ${response.data.cached}`, 'cyan');
    }
    
    // Full response preview
    log('\n📄 Full response preview:', 'magenta');
    log(JSON.stringify(response.data, null, 2).substring(0, 500) + '...', 'reset');
    
    return {
      success: response.data.success,
      status: response.status,
      hasTraders: traderCount > 0,
      traderCount: traderCount,
      error: response.data.error,
      duration
    };
    
  } catch (error) {
    log(`\n❌ Request failed: ${error.message}`, 'red');
    
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data)}`, 'red');
    } else if (error.request) {
      log(`   No response received (timeout or connection issue)`, 'red');
    }
    
    return {
      success: false,
      status: error.response?.status || 0,
      hasTraders: false,
      traderCount: 0,
      error: error.message,
      duration: 0
    };
  }
}

async function checkFrontendIntegration() {
  log('\n' + '='.repeat(70), 'bright');
  log('🎨 CHECKING FRONTEND INTEGRATION', 'bright');
  log('='.repeat(70), 'bright');
  
  try {
    // Look for the button implementation in frontend
    log('\n📂 Looking for top traders button implementation...', 'cyan');
    
    const fs = require('fs');
    const path = require('path');
    
    const frontendPath = path.join(__dirname, 'frontend', 'src');
    
    if (fs.existsSync(frontendPath)) {
      // Search for files containing "top traders" or "topTraders"
      const searchDir = (dir) => {
        const files = fs.readdirSync(dir);
        const matches = [];
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            matches.push(...searchDir(filePath));
          } else if (file.endsWith('.jsx') || file.endsWith('.tsx') || file.endsWith('.js')) {
            const content = fs.readFileSync(filePath, 'utf8');
            if (content.toLowerCase().includes('top trader') || content.includes('topTraders')) {
              matches.push(filePath);
            }
          }
        }
        
        return matches;
      };
      
      const matchingFiles = searchDir(frontendPath);
      
      if (matchingFiles.length > 0) {
        log(`✅ Found ${matchingFiles.length} file(s) with top traders references:`, 'green');
        matchingFiles.forEach(file => {
          log(`   - ${path.relative(process.cwd(), file)}`, 'reset');
        });
      } else {
        log(`⚠️  No files found with top traders references`, 'yellow');
      }
    } else {
      log(`⚠️  Frontend directory not found at expected location`, 'yellow');
    }
    
  } catch (error) {
    log(`⚠️  Error checking frontend: ${error.message}`, 'yellow');
  }
}

async function runDiagnostic() {
  log('\n' + '='.repeat(70), 'bright');
  log('🔬 TOP TRADERS DIAGNOSTIC', 'bright');
  log('='.repeat(70), 'bright');
  log(`Backend: ${BACKEND_URL}`, 'cyan');
  
  // Step 1: Check backend health
  const backendOk = await checkBackendHealth();
  if (!backendOk) {
    log('\n❌ Backend is not responding. Start the backend first.', 'red');
    return;
  }
  
  // Step 2: Get test coins
  const testCoins = await getTestCoins();
  if (testCoins.length === 0) {
    log('\n⚠️  No test coins available. Using fallback addresses.', 'yellow');
    testCoins.push({
      symbol: 'TEST',
      mintAddress: 'So11111111111111111111111111111111111111112' // Wrapped SOL
    });
  }
  
  // Step 3: Test each coin
  const results = [];
  for (const coin of testCoins) {
    const result = await testTopTradersEndpoint(coin.mintAddress, coin.symbol);
    results.push({ coin: coin.symbol, ...result });
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Step 4: Check frontend integration
  await checkFrontendIntegration();
  
  // Summary
  log('\n' + '='.repeat(70), 'bright');
  log('📊 DIAGNOSTIC SUMMARY', 'bright');
  log('='.repeat(70), 'bright');
  
  log('\n📈 Test Results:', 'cyan');
  results.forEach((result, idx) => {
    log(`\n${idx + 1}. ${result.coin}:`, 'bright');
    log(`   Success: ${result.success ? '✅' : '❌'}`, result.success ? 'green' : 'red');
    log(`   Status: ${result.status}`, result.status === 200 ? 'green' : 'red');
    log(`   Traders found: ${result.traderCount}`, result.hasTraders ? 'green' : 'yellow');
    log(`   Duration: ${result.duration}ms`, 'reset');
    if (result.error) {
      log(`   Error: ${result.error}`, 'red');
    }
  });
  
  // Overall diagnosis
  const allSuccess = results.every(r => r.success);
  const allHaveTraders = results.every(r => r.hasTraders);
  const anySuccess = results.some(r => r.success);
  const anyHaveTraders = results.some(r => r.hasTraders);
  
  log('\n💡 DIAGNOSIS:', 'cyan');
  
  if (!anySuccess) {
    log('   ❌ CRITICAL: All requests failed', 'red');
    log('   📝 Possible causes:', 'yellow');
    log('      - Endpoint doesn\'t exist or wrong route', 'yellow');
    log('      - Server error in the handler', 'yellow');
    log('      - Missing dependencies or API keys', 'yellow');
  } else if (allSuccess && !anyHaveTraders) {
    log('   ⚠️  WARNING: Endpoint responds but returns no traders', 'yellow');
    log('   📝 Possible causes:', 'yellow');
    log('      - External API (Birdeye/Helius) is not returning data', 'yellow');
    log('      - API keys are invalid or rate limited', 'yellow');
    log('      - Coins don\'t have enough trading history', 'yellow');
  } else if (allSuccess && allHaveTraders) {
    log('   ✅ Backend is working correctly!', 'green');
    log('   📝 If button still shows "fail", check:', 'yellow');
    log('      - Frontend API call implementation', 'yellow');
    log('      - Error handling in the frontend', 'yellow');
    log('      - Console logs in browser for frontend errors', 'yellow');
  } else {
    log('   ⚠️  PARTIAL: Some requests work, some don\'t', 'yellow');
    log('   📝 This suggests:', 'yellow');
    log('      - Data availability varies by coin', 'yellow');
    log('      - External API has inconsistent responses', 'yellow');
  }
  
  log('\n🔧 NEXT STEPS:', 'cyan');
  log('   1. Check backend logs for errors', 'reset');
  log('   2. Verify API keys (BIRDEYE_API_KEY, HELIUS_API_KEY)', 'reset');
  log('   3. Check browser console when clicking the button', 'reset');
  log('   4. Look at Network tab in browser DevTools', 'reset');
  
  log('\n');
}

runDiagnostic().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
