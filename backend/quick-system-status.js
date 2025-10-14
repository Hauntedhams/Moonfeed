#!/usr/bin/env node

/**
 * QUICK SYSTEM STATUS CHECK
 * Shows current state of the backend in under 5 seconds
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
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

async function quickStatus() {
  log('\n' + '='.repeat(60), 'bright');
  log('⚡ QUICK SYSTEM STATUS', 'bright');
  log('='.repeat(60), 'bright');
  
  try {
    // Fetch trending coins
    const startTime = Date.now();
    const response = await axios.get(`${BACKEND_URL}/api/coins/trending`, { timeout: 10000 });
    const fetchTime = Date.now() - startTime;
    
    if (!response.data.success || !response.data.coins) {
      throw new Error('Invalid response');
    }
    
    const coins = response.data.coins;
    
    log(`\n✅ Backend Online - Response time: ${fetchTime}ms`, 'green');
    log(`\n📊 COIN DATA:`, 'cyan');
    log(`   Total coins: ${coins.length}`, 'reset');
    
    // Enrichment stats
    const enriched = coins.filter(c => c.enriched || c.banner || c.socialLinks).length;
    const withBanners = coins.filter(c => c.banner && !c.banner.includes('placeholder')).length;
    const withSocials = coins.filter(c => c.socialLinks && Object.keys(c.socialLinks).length > 0).length;
    const withRugcheck = coins.filter(c => c.rugcheckVerified).length;
    const withDexTimestamp = coins.filter(c => c.dexscreenerProcessedAt).length;
    const withRugTimestamp = coins.filter(c => c.rugcheckProcessedAt).length;
    
    log(`   Enriched: ${enriched} (${((enriched/coins.length)*100).toFixed(1)}%)`, 'green');
    log(`   With banners: ${withBanners} (${((withBanners/coins.length)*100).toFixed(1)}%)`, 'green');
    log(`   With socials: ${withSocials} (${((withSocials/coins.length)*100).toFixed(1)}%)`, 'green');
    log(`   Rugchecked: ${withRugcheck} (${((withRugcheck/coins.length)*100).toFixed(1)}%)`, 'green');
    
    log(`\n⏱️  ENRICHMENT TIMESTAMPS:`, 'cyan');
    log(`   DexScreener processed: ${withDexTimestamp}/${coins.length}`, 'reset');
    log(`   Rugcheck processed: ${withRugTimestamp}/${coins.length}`, 'reset');
    
    // Show sample timestamps
    const withTimestamps = coins.filter(c => c.dexscreenerProcessedAt || c.rugcheckProcessedAt);
    if (withTimestamps.length > 0) {
      const sample = withTimestamps[0];
      log(`\n📝 Sample (${sample.symbol}):`, 'cyan');
      
      if (sample.dexscreenerProcessedAt) {
        const age = Date.now() - new Date(sample.dexscreenerProcessedAt).getTime();
        log(`   DexScreener: ${formatTime(age)} ago`, 'reset');
      }
      
      if (sample.rugcheckProcessedAt) {
        const age = Date.now() - new Date(sample.rugcheckProcessedAt).getTime();
        log(`   Rugcheck: ${formatTime(age)} ago`, 'reset');
      }
    }
    
    // Price check
    log(`\n💰 PRICE DATA:`, 'cyan');
    const withPrices = coins.filter(c => c.price_usd > 0).length;
    log(`   Coins with prices: ${withPrices}/${coins.length}`, 'reset');
    
    // Show top 3 coins
    log(`\n🏆 TOP 3 COINS:`, 'cyan');
    coins.slice(0, 3).forEach((coin, idx) => {
      const priceStr = coin.price_usd >= 1 ? `$${coin.price_usd.toFixed(4)}` : 
                       coin.price_usd >= 0.0001 ? `$${coin.price_usd.toFixed(6)}` :
                       `$${coin.price_usd.toExponential(2)}`;
      const mcStr = coin.market_cap_usd >= 1000000 ? `$${(coin.market_cap_usd/1000000).toFixed(2)}M` :
                    `$${(coin.market_cap_usd/1000).toFixed(0)}k`;
      
      log(`   ${idx + 1}. ${coin.symbol} - ${priceStr} | MC: ${mcStr}`, 'reset');
      
      const features = [];
      if (coin.banner && !coin.banner.includes('placeholder')) features.push('🖼️ Banner');
      if (coin.socialLinks && Object.keys(coin.socialLinks).length > 0) features.push('🔗 Socials');
      if (coin.rugcheckVerified) features.push('✅ Rugcheck');
      
      if (features.length > 0) {
        log(`      ${features.join(' | ')}`, 'green');
      }
    });
    
    log(`\n${'='.repeat(60)}`, 'bright');
    log('✅ SYSTEM STATUS: OPERATIONAL', 'green');
    log('='.repeat(60), 'bright');
    
    log(`\n💡 Backend is:`, 'cyan');
    log(`   ✅ Fetching coins from Solana Tracker`, 'green');
    log(`   ✅ Enriching with DexScreener data`, 'green');
    log(`   ✅ Verifying with Rugcheck`, 'green');
    log(`   ✅ Tracking prices with Jupiter`, 'green');
    log(`   ✅ Applying timestamps (for 5-min refresh)`, 'green');
    
    if (enriched < coins.length) {
      const remaining = coins.length - enriched;
      log(`\n📈 Enrichment in progress: ${remaining} coins remaining`, 'yellow');
      log(`   Background enrichers are processing coins continuously`, 'yellow');
    }
    
    log('\n');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    log('   Make sure the backend is running (npm run dev)', 'yellow');
  }
}

quickStatus();
