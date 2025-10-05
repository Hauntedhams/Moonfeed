#!/usr/bin/env node

/**
 * Test script to verify the complete filter flow
 * This script tests:
 * 1. Backend filter endpoint with various parameters
 * 2. Response format and data structure
 * 3. Error handling
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api/coins';

async function testFilterEndpoint() {
  console.log('🧪 Testing Filter Flow End-to-End');
  console.log('=====================================\n');

  // Test 1: Basic filter (similar to what frontend would send)
  console.log('📋 Test 1: Basic Liquidity Filter');
  try {
    const response = await fetch(`${API_BASE}/filtered`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        minLiquidity: 100000,
        maxLiquidity: 1000000,
        volumeTimeframe: '24h'
      })
    });

    const data = await response.json();
    console.log(`✅ Response Status: ${response.status}`);
    console.log(`✅ Success: ${data.success}`);
    console.log(`✅ Coins Count: ${data.coins?.length || 0}`);
    console.log(`✅ Applied Filters:`, data.appliedFilters);
    console.log('');
  } catch (error) {
    console.error('❌ Test 1 Failed:', error.message);
  }

  // Test 2: Complex filter with multiple parameters
  console.log('📋 Test 2: Complex Multi-Parameter Filter');
  try {
    const response = await fetch(`${API_BASE}/filtered`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        minLiquidity: 200000,
        maxLiquidity: 500000,
        minMarketCap: 1000000,
        maxMarketCap: 10000000,
        minVolume: 50000,
        volumeTimeframe: '24h',
        minBuys: 10,
        minTotalTransactions: 20
      })
    });

    const data = await response.json();
    console.log(`✅ Response Status: ${response.status}`);
    console.log(`✅ Success: ${data.success}`);
    console.log(`✅ Coins Count: ${data.coins?.length || 0}`);
    
    if (data.coins && data.coins.length > 0) {
      const firstCoin = data.coins[0];
      console.log(`✅ Sample Coin:`, {
        symbol: firstCoin.symbol,
        market_cap: firstCoin.market_cap_usd,
        liquidity: firstCoin.liquidity_usd,
        volume: firstCoin.volume_24h_usd
      });
    }
    console.log('');
  } catch (error) {
    console.error('❌ Test 2 Failed:', error.message);
  }

  // Test 3: Empty filter (should return reasonable defaults)
  console.log('📋 Test 3: Empty Filter');
  try {
    const response = await fetch(`${API_BASE}/filtered`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const data = await response.json();
    console.log(`✅ Response Status: ${response.status}`);
    console.log(`✅ Success: ${data.success}`);
    console.log(`✅ Coins Count: ${data.coins?.length || 0}`);
    console.log('');
  } catch (error) {
    console.error('❌ Test 3 Failed:', error.message);
  }

  // Test 4: Invalid data handling
  console.log('📋 Test 4: Invalid Data Handling');
  try {
    const response = await fetch(`${API_BASE}/filtered`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        minLiquidity: "not_a_number",
        maxLiquidity: -1000,
        volumeTimeframe: '24h'
      })
    });

    const data = await response.json();
    console.log(`✅ Response Status: ${response.status}`);
    console.log(`✅ Success: ${data.success}`);
    console.log(`✅ Handled gracefully: ${data.success !== false ? 'Yes' : 'No'}`);
    console.log('');
  } catch (error) {
    console.error('❌ Test 4 Failed:', error.message);
  }

  // Test 5: Compare with trending endpoint
  console.log('📋 Test 5: Compare with Trending Endpoint');
  try {
    const [filteredResponse, trendingResponse] = await Promise.all([
      fetch(`${API_BASE}/filtered`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volumeTimeframe: '24h' })
      }),
      fetch(`${API_BASE}/trending`)
    ]);

    const filteredData = await filteredResponse.json();
    const trendingData = await trendingResponse.json();

    console.log(`✅ Filtered Endpoint: ${filteredData.coins?.length || 0} coins`);
    console.log(`✅ Trending Endpoint: ${trendingData.coins?.length || 0} coins`);
    console.log(`✅ Data structure compatibility: ${
      filteredData.coins?.[0]?.mintAddress && trendingData.coins?.[0]?.mintAddress ? 'Compatible' : 'Incompatible'
    }`);
    console.log('');
  } catch (error) {
    console.error('❌ Test 5 Failed:', error.message);
  }

  console.log('🎉 Filter Flow Testing Complete!');
}

// Run the tests
testFilterEndpoint().catch(console.error);
