// Simple test to call Solana Tracker API for NEW feed
require('dotenv').config();
const fetch = require('node-fetch');

const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;

if (!SOLANA_TRACKER_API_KEY) {
  console.error('ERROR: SOLANA_TRACKER_API_KEY not found in .env file');
  process.exit(1);
}

async function testNewFeed() {
  console.log('🚀 Testing NEW feed API call...\n');
  
  const now = Date.now();
  const minCreatedAt = now - (96 * 60 * 60 * 1000); // 96 hours ago
  const maxCreatedAt = now - (1 * 60 * 60 * 1000);  // 1 hour ago
  
  const params = new URLSearchParams({
    minVolume_5m: '15000',
    maxVolume_5m: '30000',
    minCreatedAt: minCreatedAt.toString(),
    maxCreatedAt: maxCreatedAt.toString(),
    sortBy: 'createdAt',
    sortOrder: 'desc',
    limit: '50',
    page: '1'
  });
  
  const url = `https://data.solanatracker.io/search?${params.toString()}`;
  
  console.log('📍 API Endpoint: https://data.solanatracker.io/search');
  console.log('📋 Parameters:');
  console.log('   - minVolume_5m: $15,000');
  console.log('   - maxVolume_5m: $30,000');
  console.log('   - Age range: 1-96 hours');
  console.log('   - Limit: 50 coins\n');
  
  try {
    const response = await fetch(url, {
      headers: {
        'x-api-key': SOLANA_TRACKER_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('✅ API Call Successful!');
    console.log('📊 Status:', data.status);
    console.log('🎯 Total Coins Returned:', data.data?.length || 0);
    console.log('\n' + '='.repeat(80));
    console.log('ALL COINS FROM SOLANA TRACKER (1-96 hours old, $15k-$30k 5m volume)');
    console.log('='.repeat(80) + '\n');
    
    if (data.data && data.data.length > 0) {
      // Show ALL coins, not just top 10
      data.data.forEach((token, i) => {
        const ageHours = Math.floor((Date.now() - token.createdAt) / (1000 * 60 * 60));
        
        console.log(`${(i+1).toString().padStart(3)}. ${token.symbol.padEnd(12)} - ${token.name.substring(0, 35).padEnd(35)} (${ageHours}h old)`);
      });
      
      console.log('\n' + '='.repeat(80));
      console.log(`✅ COMPLETE LIST: ${data.data.length} coins returned by Solana Tracker`);
      console.log('='.repeat(80));
      
    } else {
      console.log('⚠️  No coins found matching criteria');
      console.log('\nTry adjusting:');
      console.log('  - Lower minVolume_5m (e.g., 5000)');
      console.log('  - Increase maxVolume_5m (e.g., 50000)');
      console.log('  - Or remove volume filters');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }
}

testNewFeed();
