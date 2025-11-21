#!/usr/bin/env node
/**
 * Test Jupiter Referral System
 * Run this script to verify the referral system is working correctly
 */

const http = require('http');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Test tokens
const TEST_TOKENS = [
  {
    name: 'SOL',
    mint: 'So11111111111111111111111111111111111111112'
  },
  {
    name: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  },
  {
    name: 'BONK',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
  }
];

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `${BACKEND_URL}${path}`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function testReferralSystem() {
  console.log('🧪 Testing Jupiter Referral System\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 1: Referral Account Info
  console.log('📋 Test 1: Checking Referral Account Info...');
  try {
    const info = await makeRequest('/api/jupiter/referral/info');
    if (info.success) {
      console.log('✅ Referral account is valid');
      console.log(`   Address: ${info.address}`);
      console.log(`   Fee Rate: ${info.feeBps} BPS (${info.feeBps / 100}%)`);
      console.log(`   Exists: ${info.exists ? 'Yes' : 'No'}`);
    } else {
      console.log('❌ Failed to get referral account info');
      console.log('   Error:', info.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  console.log('');

  // Test 2: Referral Config for Each Token
  console.log('🪙 Test 2: Checking Referral Config for Test Tokens...');
  for (const token of TEST_TOKENS) {
    try {
      const config = await makeRequest(`/api/jupiter/referral/config/${token.mint}`);
      if (config.success) {
        console.log(`✅ ${token.name}: Config generated successfully`);
        console.log(`   Fee Account: ${config.feeAccount.substring(0, 12)}...`);
        console.log(`   Fee Rate: ${config.feePercentage}`);
      } else {
        console.log(`❌ ${token.name}: Failed to generate config`);
        console.log('   Error:', config.error);
      }
    } catch (error) {
      console.log(`❌ ${token.name}: Error - ${error.message}`);
    }
  }
  console.log('');

  // Test 3: Check Token Account Existence
  console.log('🔍 Test 3: Checking Token Account Existence...');
  for (const token of TEST_TOKENS) {
    try {
      const accountInfo = await makeRequest(`/api/jupiter/referral/token-account/${token.mint}`);
      if (accountInfo.success) {
        const status = accountInfo.exists ? '✅ EXISTS' : '⚠️  NOT CREATED YET';
        console.log(`${status} ${token.name}`);
        if (accountInfo.exists) {
          console.log(`   Account: ${accountInfo.tokenAccount.substring(0, 12)}...`);
        } else {
          console.log(`   Note: Will be created automatically on first swap`);
        }
      }
    } catch (error) {
      console.log(`❌ ${token.name}: Error - ${error.message}`);
    }
  }
  console.log('');

  // Test 4: Check Accumulated Fees
  console.log('💰 Test 4: Checking Accumulated Fees...');
  for (const token of TEST_TOKENS) {
    try {
      const fees = await makeRequest(`/api/jupiter/referral/fees/${token.mint}`);
      if (fees.success) {
        if (fees.exists && fees.balance !== '0') {
          console.log(`💰 ${token.name}: ${fees.balance} tokens collected!`);
        } else if (fees.exists) {
          console.log(`⚪ ${token.name}: No fees collected yet`);
        } else {
          console.log(`⚪ ${token.name}: Account not initialized yet`);
        }
      }
    } catch (error) {
      console.log(`❌ ${token.name}: Error - ${error.message}`);
    }
  }
  console.log('');

  // Test 5: Referral Links
  console.log('🔗 Test 5: Generating Referral Links...');
  for (const token of TEST_TOKENS) {
    try {
      const linkInfo = await makeRequest(`/api/jupiter/referral/link/${token.mint}`);
      if (linkInfo.success) {
        console.log(`✅ ${token.name}: ${linkInfo.referralLink}`);
      }
    } catch (error) {
      console.log(`❌ ${token.name}: Error - ${error.message}`);
    }
  }
  console.log('');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Referral System Test Complete!');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('   1. Make sure backend is running: npm run dev');
  console.log('   2. Make sure frontend is running: npm run dev (in frontend folder)');
  console.log('   3. Test a swap in the UI');
  console.log('   4. Check browser console for "✅ Loaded referral config"');
  console.log('   5. Verify fees after successful swap');
  console.log('');
}

// Run the test
testReferralSystem().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
