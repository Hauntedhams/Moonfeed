#!/usr/bin/env node

/**
 * Manual Trending Feed Refresh
 * 
 * This script manually triggers a refresh of the trending feed
 * with the NEW OPTIMIZED PARAMETERS:
 * - Age filter: 3-30 days
 * - Liquidity: $100k-$2M
 * - Volume: $150k-$10M
 * - Market Cap: $500k-$50M
 */

const trendingAutoRefresher = require('./backend/trendingAutoRefresher');

console.log('\n🚀 ═══════════════════════════════════════════════════');
console.log('🚀 MANUAL TRENDING FEED REFRESH');
console.log('🚀 Using NEW OPTIMIZED PARAMETERS');
console.log('🚀 ═══════════════════════════════════════════════════\n');

console.log('📊 New Parameters:');
console.log('   • Age Filter: 3-30 days (NEW!)');
console.log('   • Min Liquidity: $100k (was $50k)');
console.log('   • Max Liquidity: $2M (was $500k)');
console.log('   • Min Volume: $150k (was $50k)');
console.log('   • Max Volume: $10M (was $5M)');
console.log('   • Min Market Cap: $500k (was $300k)');
console.log('   • Max Market Cap: $50M (was $10M)');
console.log('   • Sort By: volume_24h (momentum)\n');

async function manualRefresh() {
  try {
    console.log('🔄 Triggering manual refresh...\n');
    
    const result = await trendingAutoRefresher.triggerRefresh();
    
    if (result.success) {
      console.log('\n✅ Manual refresh completed successfully!');
      console.log('📊 Check the logs above for details on the new coins fetched.');
      console.log('💡 The 24-hour auto-refresh is still active and running.');
      console.log('🎯 New coins should reflect the optimized parameters.');
    } else {
      console.log('\n⚠️  Refresh could not be triggered:', result.message);
    }
    
  } catch (error) {
    console.error('\n❌ Error during manual refresh:', error.message);
    console.error(error.stack);
  }
}

// Run the refresh
manualRefresh().then(() => {
  console.log('\n✨ Manual refresh process complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
