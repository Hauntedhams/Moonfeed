/**
 * Jupiter Trade Integration with Affiliate Tracking
 * Example of how to integrate referral tracking with Jupiter trades
 */

import ReferralTracker from '../utils/ReferralTracker';

/**
 * Example: Track trade after successful Jupiter swap
 * Call this function after a Jupiter trade completes successfully
 */
export async function handleTradeSuccess({
  userWallet,
  inputMint,
  outputMint,
  inputAmount,
  outputAmount,
  transactionSignature,
  priceImpact
}) {
  try {
    // Calculate trade volume in USD (you may need to fetch SOL price)
    // For now, assuming 1 SOL = $100 (replace with actual price)
    const solPrice = 100; // TODO: Fetch real-time SOL price
    const tradeVolumeUSD = (inputAmount / 1e9) * solPrice; // Convert lamports to SOL, then to USD
    
    // Calculate fee earned (1% of trade volume)
    const feePercentage = 0.01; // 1%
    const feeEarned = tradeVolumeUSD * feePercentage;
    
    console.log('💰 Trade completed, tracking for affiliate...');
    
    // Track the trade with referral attribution
    const trackingResult = await ReferralTracker.trackTrade({
      userWallet,
      tradeVolume: tradeVolumeUSD,
      feeEarned,
      tokenIn: inputMint,
      tokenOut: outputMint,
      transactionSignature,
      metadata: {
        inputAmount,
        outputAmount,
        priceImpact,
        timestamp: new Date().toISOString()
      }
    });
    
    if (trackingResult.success) {
      console.log('✅ Trade tracked successfully for affiliate');
      console.log('   Influencer share:', `$${trackingResult.trade?.influencerShare?.toFixed(4) || '0'}`);
    } else {
      console.log('📊 Trade not attributed to any affiliate (no referral code)');
    }
    
    return trackingResult;
  } catch (error) {
    console.error('❌ Error tracking trade:', error);
    // Don't throw - tracking failure shouldn't break the trade flow
    return { success: false, error: error.message };
  }
}

/**
 * Example: Integration with JupiterTradeModal
 * Add this to your existing Jupiter trade success handler
 */
export async function integrateWithJupiterModal(tradeData) {
  // After successful trade execution in JupiterTradeModal:
  // 1. Wait for transaction confirmation
  // 2. Get trade details
  // 3. Track with affiliate system
  
  const {
    walletAddress,
    inputMint,
    outputMint,
    inputAmount,
    outputAmount,
    signature
  } = tradeData;
  
  // Track the trade
  await handleTradeSuccess({
    userWallet: walletAddress,
    inputMint,
    outputMint,
    inputAmount,
    outputAmount,
    transactionSignature: signature,
    priceImpact: 0 // Calculate if available
  });
}

/**
 * Example: Display referral info in UI
 */
export async function displayCurrentReferralInfo() {
  const referralInfo = await ReferralTracker.getCurrentReferralInfo();
  
  if (referralInfo) {
    console.log('🎯 Active referral:', referralInfo.affiliate.name);
    
    // You can display this in UI:
    // "Referred by: CryptoKid 🎉"
    return {
      hasReferral: true,
      affiliateName: referralInfo.affiliate.name,
      affiliateCode: referralInfo.code
    };
  }
  
  return {
    hasReferral: false
  };
}

/**
 * Example: Manual testing in browser console
 * Open console and run these commands to test
 */
export function testInBrowser() {
  console.log(`
🧪 Affiliate System Test Commands:

1. Set a test referral code:
   ReferralTracker.setReferralCode('testaffiliate123')

2. Check current referral code:
   ReferralTracker.getReferralCode()

3. Validate a referral code:
   await ReferralTracker.validateReferralCode('testaffiliate123')

4. Get current referral info:
   await ReferralTracker.getCurrentReferralInfo()

5. Simulate a test trade:
   await ReferralTracker.trackTrade({
     userWallet: 'TestWallet123',
     tradeVolume: 1000,
     feeEarned: 10,
     tokenIn: 'SOL',
     tokenOut: 'BONK',
     transactionSignature: 'TestTx123'
   })

6. Clear referral code:
   ReferralTracker.clearReferralCode()
  `);
}

// Export test function for easy console access
if (typeof window !== 'undefined') {
  window.testAffiliateSystem = testInBrowser;
}
