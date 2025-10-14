// Test script to check Solana Tracker wallet API response
require('dotenv').config();
const fetch = require('node-fetch');

const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;
const SOLANA_TRACKER_BASE_URL = 'https://data.solanatracker.io';

// Use a wallet from your top traders (replace with an actual wallet from your app)
const TEST_WALLET = 'CzFWw455MXkWypGnjktyR6EqaBHBWpx9zWsU2PGEKMJy';

async function testWalletEndpoint(endpoint, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${description}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log('='.repeat(60));
  
  try {
    const url = `${SOLANA_TRACKER_BASE_URL}${endpoint}`;
    console.log(`📡 Full URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': SOLANA_TRACKER_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📊 Response OK: ${response.ok}`);
    
    const responseText = await response.text();
    console.log(`\n📦 Response Body (first 500 chars):`);
    console.log(responseText.substring(0, 500));
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log(`\n✅ JSON Keys:`, Object.keys(data));
        console.log(`\n✅ Full Response (formatted):`);
        console.log(JSON.stringify(data, null, 2).substring(0, 1500));
      } catch (e) {
        console.log(`❌ Could not parse as JSON:`, e.message);
      }
    } else {
      console.log(`\n❌ Error Response:`, responseText);
    }
    
    return { status: response.status, ok: response.ok };
    
  } catch (error) {
    console.error(`\n❌ Request Error:`, error.message);
    return { error: error.message };
  }
}

async function runTests() {
  console.log('\n🔍 SOLANA TRACKER WALLET API TEST');
  console.log(`Using API Key: ${SOLANA_TRACKER_API_KEY ? '✅ Present' : '❌ Missing'}`);
  console.log(`Test Wallet: ${TEST_WALLET}`);
  
  // Test all wallet endpoints
  const endpoints = [
    [`/wallet/${TEST_WALLET}`, 'Full Wallet Data'],
    [`/wallet/${TEST_WALLET}/basic`, 'Basic Wallet Info'],
    [`/wallet/${TEST_WALLET}/chart`, 'Wallet Chart Data'],
    [`/wallet/${TEST_WALLET}/trades`, 'Wallet Trades'],
    [`/wallet/${TEST_WALLET}/page/1`, 'Wallet Page 1']
  ];
  
  for (const [endpoint, description] of endpoints) {
    await testWalletEndpoint(endpoint, description);
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('🏁 TESTS COMPLETE');
  console.log('='.repeat(60));
  console.log('');
}

// Run the tests
runTests().catch(console.error);
