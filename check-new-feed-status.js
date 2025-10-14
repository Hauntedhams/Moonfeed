#!/usr/bin/env node

/**
 * Check NEW Feed Status - Diagnostic Tool
 * Shows when the last refresh happened and validates coin ages
 */

const fetch = require('node-fetch');

async function checkNewFeedStatus() {
  console.log('\n🔍 NEW FEED STATUS CHECK');
  console.log('═══════════════════════════════════════\n');
  
  try {
    // 1. Check auto-refresher status
    console.log('1️⃣ Checking auto-refresh status...\n');
    const statusResponse = await fetch('http://localhost:3001/health');
    const healthData = await statusResponse.json();
    
    console.log(`📊 Server Status:`);
    console.log(`   Running: ${healthData.status}`);
    console.log(`   Current NEW coins: ${healthData.newCoins || 0}`);
    console.log('');
    
    // 2. Get NEW feed coins
    console.log('2️⃣ Fetching NEW feed coins...\n');
    const newResponse = await fetch('http://localhost:3001/api/coins/new?limit=20');
    const newData = await newResponse.json();
    
    if (!newData.success || !newData.coins || newData.coins.length === 0) {
      console.log('❌ No NEW coins available');
      console.log('   This might mean:');
      console.log('   • No coins match the 1-96 hour + $20k-$70k volume criteria');
      console.log('   • Auto-refresh hasn\'t run yet (wait 30 seconds after server start)');
      return;
    }
    
    console.log(`✅ NEW Feed: ${newData.count} coins loaded\n`);
    console.log(`📋 Criteria: ${JSON.stringify(newData.criteria)}\n`);
    
    // 3. Analyze coin ages
    console.log('3️⃣ Analyzing coin ages...\n');
    const now = Date.now();
    
    const ageAnalysis = newData.coins.map(coin => {
      const createdAt = coin.created_timestamp || coin.createdAt || 0;
      const ageMs = now - createdAt;
      const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
      const volume5m = coin.volume_5m || coin.volume_5m_usd || 0;
      
      return {
        symbol: coin.symbol,
        ageHours,
        volume5m: `$${(volume5m / 1000).toFixed(1)}k`,
        fitsAge: ageHours >= 1 && ageHours <= 96,
        fitsVolume: volume5m >= 20000 && volume5m <= 70000
      };
    });
    
    console.log('🔍 Top 10 NEW coins with age validation:\n');
    ageAnalysis.slice(0, 10).forEach((coin, i) => {
      const ageIcon = coin.fitsAge ? '✅' : '❌';
      const volIcon = coin.fitsVolume ? '✅' : '❌';
      const ageLabel = coin.fitsAge ? `${coin.ageHours}h` : `${coin.ageHours}h (OUT OF RANGE!)`;
      
      console.log(`${(i+1).toString().padStart(2, ' ')}. ${coin.symbol.padEnd(12)} ${ageIcon} Age: ${ageLabel.padEnd(25)} ${volIcon} Vol: ${coin.volume5m}`);
    });
    
    // 4. Count invalid coins
    const invalidAge = ageAnalysis.filter(c => !c.fitsAge).length;
    const invalidVolume = ageAnalysis.filter(c => !c.fitsVolume).length;
    
    console.log('\n\n📊 Validation Summary:\n');
    console.log(`   Total coins: ${ageAnalysis.length}`);
    console.log(`   ${invalidAge === 0 ? '✅' : '❌'} Coins outside 1-96h range: ${invalidAge}`);
    console.log(`   ${invalidVolume === 0 ? '✅' : '⚠️'} Coins outside $20k-$70k volume: ${invalidVolume}`);
    
    if (invalidAge > 0 || invalidVolume > 0) {
      console.log('\n⚠️  WARNING: Some coins don\'t match criteria!');
      console.log('   This could mean:');
      console.log('   • Coins aged out since last refresh (refresh every 30 min)');
      console.log('   • Volume changed since coins were fetched');
      console.log('   • Consider triggering manual refresh');
      console.log('\n💡 To manually refresh:');
      console.log('   curl -X POST http://localhost:3001/api/admin/refresh-new');
    } else {
      console.log('\n✅ All coins match the NEW feed criteria!');
    }
    
    // 5. Show refresh timing
    console.log('\n\n⏰ Auto-Refresh Schedule:\n');
    console.log('   Interval: Every 30 minutes');
    console.log('   Next refresh: Check server logs for timestamp');
    console.log('   Manual trigger: POST http://localhost:3001/api/admin/refresh-new');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Make sure backend is running on port 3001');
  }
  
  console.log('\n═══════════════════════════════════════\n');
}

// Run the check
checkNewFeedStatus().catch(console.error);
