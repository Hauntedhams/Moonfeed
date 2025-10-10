// Detailed test to see EXACT data from Solana Tracker API
require('dotenv').config();
const fetch = require('node-fetch');

const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;

async function testDetailed() {
  console.log('🔍 DETAILED NEW FEED API CALL\n');
  
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
    limit: '100'
  });
  
  const url = `https://data.solanatracker.io/search?${params.toString()}`;
  
  console.log('API Parameters:');
  console.log('  minVolume_5m: $15,000');
  console.log('  maxVolume_5m: $30,000');
  console.log('  minCreatedAt:', new Date(minCreatedAt).toISOString());
  console.log('  maxCreatedAt:', new Date(maxCreatedAt).toISOString());
  console.log('  Age range: 1-96 hours\n');
  
  const response = await fetch(url, {
    headers: { 'x-api-key': SOLANA_TRACKER_API_KEY }
  });

  const data = await response.json();
  
  console.log('Response Status:', data.status);
  console.log('Total Coins:', data.data?.length || 0);
  console.log('\n' + '='.repeat(100));
  console.log('COMPLETE LIST WITH FULL DETAILS');
  console.log('='.repeat(100) + '\n');
  
  if (data.data) {
    data.data.forEach((token, i) => {
      const created = new Date(token.createdAt);
      const ageHours = Math.floor((Date.now() - token.createdAt) / (1000 * 60 * 60));
      const ageMinutes = Math.floor(((Date.now() - token.createdAt) % (1000 * 60 * 60)) / (1000 * 60));
      
      console.log(`${(i+1).toString().padStart(3)}. ${token.symbol.padEnd(12)} - ${token.name.substring(0, 40).padEnd(40)}`);
      console.log(`     Mint: ${token.mint}`);
      console.log(`     Created: ${created.toISOString()}`);
      console.log(`     Age: ${ageHours}h ${ageMinutes}m`);
      console.log(`     Volume 5m: $${(token.volume_5m || 0).toLocaleString()}`);
      console.log(`     Market Cap: $${(token.marketCapUsd || 0).toLocaleString()}`);
      console.log(`     Liquidity: $${(token.liquidityUsd || 0).toLocaleString()}`);
      console.log(`     Market: ${token.market || 'N/A'}`);
      console.log(`     Status: ${token.status || 'N/A'}`);
      console.log('');
    });
    
    console.log('='.repeat(100));
    console.log(`TOTAL: ${data.data.length} coins returned`);
    console.log('='.repeat(100));
    
    // Show volume distribution
    console.log('\n📊 VOLUME DISTRIBUTION:');
    const volumes = data.data.map(t => t.volume_5m || 0).sort((a, b) => b - a);
    console.log(`   Highest: $${volumes[0].toLocaleString()}`);
    console.log(`   Lowest: $${volumes[volumes.length - 1].toLocaleString()}`);
    console.log(`   Average: $${Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length).toLocaleString()}`);
    
    // Check if any are outside our range
    const outOfRange = data.data.filter(t => (t.volume_5m || 0) < 15000 || (t.volume_5m || 0) > 30000);
    if (outOfRange.length > 0) {
      console.log(`\n⚠️  WARNING: ${outOfRange.length} coins are OUTSIDE the $15k-$30k range!`);
      outOfRange.forEach(t => {
        console.log(`   - ${t.symbol}: $${(t.volume_5m || 0).toLocaleString()}`);
      });
    }
  }
}

testDetailed().catch(err => console.error('Error:', err.message));
