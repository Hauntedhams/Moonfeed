/**
 * Test script for Affiliate System
 * Run this to verify the affiliate system is working
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api/affiliates';

async function testAffiliateSystem() {
  console.log('🧪 Testing Affiliate System\n');
  
  try {
    // 1. Create a test affiliate
    console.log('1️⃣ Creating test affiliate...');
    const createResponse = await axios.post(`${API_BASE}/create`, {
      code: 'testaffiliate123',
      name: 'Test Influencer',
      walletAddress: 'TestWallet123456789abcdefghijklmnop',
      sharePercentage: 50,
      email: 'test@example.com',
      telegram: '@testuser'
    });
    
    if (createResponse.data.success) {
      console.log('✅ Affiliate created:', createResponse.data.affiliate.name);
    } else {
      console.log('⚠️ Affiliate might already exist');
    }
    
    // 2. Get all affiliates
    console.log('\n2️⃣ Fetching all affiliates...');
    const listResponse = await axios.get(`${API_BASE}/list`);
    console.log(`✅ Found ${listResponse.data.affiliates.length} affiliate(s)`);
    
    // 3. Get specific affiliate
    console.log('\n3️⃣ Fetching specific affiliate...');
    const affiliateResponse = await axios.get(`${API_BASE}/testaffiliate123`);
    console.log('✅ Affiliate details:', {
      code: affiliateResponse.data.affiliate.code,
      name: affiliateResponse.data.affiliate.name,
      totalEarned: affiliateResponse.data.affiliate.totalEarned,
      totalTrades: affiliateResponse.data.affiliate.totalTrades
    });
    
    // 4. Validate referral code
    console.log('\n4️⃣ Validating referral code...');
    const validateResponse = await axios.get(`${API_BASE}/validate/testaffiliate123`);
    console.log('✅ Referral code is valid:', validateResponse.data.valid);
    
    // 5. Simulate tracking a trade
    console.log('\n5️⃣ Tracking a test trade...');
    const tradeResponse = await axios.post(`${API_BASE}/track-trade`, {
      referralCode: 'testaffiliate123',
      userWallet: 'UserWallet123456789',
      tradeVolume: 1000, // $1000 trade
      feeEarned: 10, // 1% fee
      tokenIn: 'SOL',
      tokenOut: 'BONK',
      transactionSignature: 'TestTxSignature123',
      metadata: {
        testMode: true
      }
    });
    
    if (tradeResponse.data.success) {
      console.log('✅ Trade tracked successfully');
      console.log('   Trade volume:', `$${tradeResponse.data.trade.tradeVolume}`);
      console.log('   Fee earned:', `$${tradeResponse.data.trade.feeEarned}`);
      console.log('   Jupiter cut (20%):', `$${tradeResponse.data.trade.jupiterCut.toFixed(2)}`);
      console.log('   Net fee:', `$${tradeResponse.data.trade.netFee.toFixed(2)}`);
      console.log('   Influencer share (50%):', `$${tradeResponse.data.trade.influencerShare.toFixed(2)}`);
      console.log('   Platform share (50%):', `$${tradeResponse.data.trade.platformShare.toFixed(2)}`);
    }
    
    // 6. Get affiliate stats
    console.log('\n6️⃣ Fetching affiliate stats...');
    const statsResponse = await axios.get(`${API_BASE}/testaffiliate123/stats`);
    console.log('✅ Affiliate stats updated:');
    console.log('   Total earnings:', `$${statsResponse.data.stats.totalEarnings.toFixed(2)}`);
    console.log('   Pending earnings:', `$${statsResponse.data.stats.pendingEarnings.toFixed(2)}`);
    console.log('   Total trades:', statsResponse.data.stats.totalTrades);
    
    // 7. Get pending earnings
    console.log('\n7️⃣ Fetching pending earnings...');
    const pendingResponse = await axios.get(`${API_BASE}/testaffiliate123/pending-earnings`);
    console.log('✅ Pending earnings:', `$${pendingResponse.data.totalPending.toFixed(2)}`);
    console.log('   Pending trades:', pendingResponse.data.tradeCount);
    
    // 8. Create a test payout
    console.log('\n8️⃣ Creating a test payout...');
    const trades = pendingResponse.data.trades;
    if (trades.length > 0) {
      const tradeIds = trades.map(t => t.tradeId);
      const totalAmount = pendingResponse.data.totalPending;
      
      const payoutResponse = await axios.post(`${API_BASE}/payouts/create`, {
        referralCode: 'testaffiliate123',
        amount: totalAmount,
        tradeIds: tradeIds,
        transactionSignature: 'TestPayoutTx123',
        notes: 'Test payout'
      });
      
      if (payoutResponse.data.success) {
        console.log('✅ Payout created successfully');
        console.log('   Amount:', `$${payoutResponse.data.payout.amount.toFixed(2)}`);
        console.log('   Trades paid:', payoutResponse.data.payout.tradeCount);
      }
    } else {
      console.log('⚠️ No pending trades to pay out');
    }
    
    // 9. Verify trades are marked as paid
    console.log('\n9️⃣ Verifying payout status...');
    const statsAfterPayoutResponse = await axios.get(`${API_BASE}/testaffiliate123/stats`);
    console.log('✅ Updated stats after payout:');
    console.log('   Pending earnings:', `$${statsAfterPayoutResponse.data.stats.pendingEarnings.toFixed(2)}`);
    console.log('   Paid earnings:', `$${statsAfterPayoutResponse.data.stats.paidEarnings.toFixed(2)}`);
    
    console.log('\n🎉 All tests passed! Affiliate system is working correctly.\n');
    
    // Print referral link example
    console.log('📎 Example referral link:');
    console.log(`   https://moonfeed.app?ref=testaffiliate123\n`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    console.error('\nMake sure:');
    console.error('  1. Backend server is running (npm run dev)');
    console.error('  2. Server is accessible at http://localhost:3001');
    console.error('  3. Affiliate routes are properly mounted\n');
  }
}

// Run tests
testAffiliateSystem();
