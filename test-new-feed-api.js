require('dotenv').config();
const fetch = require('node-fetch');

const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;
const SOLANA_TRACKER_BASE_URL = 'https://data.solanatracker.io';

async function testNewFeedAPI() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🆕 TESTING NEW FEED API CALL');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Calculate timestamps for 1-96 hours old (gives new coins time to stabilize)
  const now = Date.now();
  const minCreatedAt = now - (96 * 60 * 60 * 1000); // 96 hours ago (oldest)
  const maxCreatedAt = now - (1 * 60 * 60 * 1000);  // 1 hour ago (youngest)
  
  const searchParams = {
    minVolume_5m: 15000,          // $15k minimum 5-minute volume
    maxVolume_5m: 30000,          // $30k maximum 5-minute volume
    minCreatedAt: minCreatedAt,   // Oldest: 96 hours ago
    maxCreatedAt: maxCreatedAt,   // Youngest: 1 hour ago (time to stabilize)
    sortBy: 'createdAt',          // Sort by creation date
    sortOrder: 'desc',            // Newest first
    limit: 10,                    // Get top 10 for testing
    page: 1
  };

  console.log('📋 API Parameters:');
  console.log('  - minVolume_5m: $15,000');
  console.log('  - maxVolume_5m: $30,000');
  console.log('  - Age range: 1-96 hours old (time to stabilize)');
  console.log('  - From:', new Date(minCreatedAt).toISOString());
  console.log('  - To:', new Date(maxCreatedAt).toISOString());
  console.log('  - Sort: Newest first\n');

  const url = new URL('/search', SOLANA_TRACKER_BASE_URL);
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.append(key, value.toString());
  });

  console.log('🌐 Making API call to Solana Tracker...\n');
  
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': SOLANA_TRACKER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('✅ Response Status:', data.status);
    console.log('📊 Tokens Found:', data.data?.length || 0);
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎯 TOP 10 NEW COINS (1-96 hours old, $15k-$30k 5m volume)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (data.data && data.data.length > 0) {
      data.data.forEach((token, i) => {
        const createdDate = new Date(token.createdAt);
        const ageMs = Date.now() - token.createdAt;
        const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
        const ageMinutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));
        
        console.log(`${(i+1).toString().padStart(2, ' ')}. ${token.symbol.padEnd(12)} - ${token.name.substring(0, 35)}`);
        console.log(`    📍 Mint: ${token.mint}`);
        console.log(`    📅 Created: ${createdDate.toISOString()}`);
        console.log(`    ⏰ Age: ${ageHours}h ${ageMinutes}m old`);
        console.log(`    💰 Price: $${token.priceUsd || 0}`);
        console.log(`    📊 Market Cap: $${(token.marketCapUsd || 0).toLocaleString()}`);
        console.log(`    ⚡ Volume 5m: $${(token.volume_5m || 0).toLocaleString()}`);
        console.log(`    💧 Liquidity: $${(token.liquidityUsd || 0).toLocaleString()}`);
        console.log(`    🔥 Market: ${token.market || 'unknown'}`);
        console.log(`    📈 Buys: ${token.buys || 0} | Sells: ${token.sells || 0}`);
        console.log('');
      });
      
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ NEW FEED API CALL SUCCESSFUL!');
      console.log(`📊 Found ${data.data.length} coins matching criteria`);
      console.log('═══════════════════════════════════════════════════════════');
    } else {
      console.log('⚠️  NO TOKENS FOUND');
      console.log('');
      console.log('Possible reasons:');
      console.log('  1. No coins between 1-96 hours old with $15k-$30k 5m volume');
      console.log('  2. Volume criteria might be too narrow');
      console.log('  3. Try adjusting parameters');
      console.log('');
      console.log('Suggestions:');
      console.log('  - Lower minVolume_5m to 5000');
      console.log('  - Increase maxVolume_5m to 50000');
      console.log('  - Or remove volume filters entirely for testing');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Check if SOLANA_TRACKER_API_KEY is set in .env');
    console.error('  2. Verify API key has correct permissions');
    console.error('  3. Check if Solana Tracker API is accessible');
  }
}

testNewFeedAPI();
