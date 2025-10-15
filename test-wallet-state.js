/**
 * Wallet State Diagnostic Script
 * Run this in browser console to check wallet connection state
 * 
 * USAGE:
 * 1. Open browser console (F12)
 * 2. Copy-paste this entire script
 * 3. Press Enter
 */

console.log('🔍 === WALLET STATE DIAGNOSTIC ===\n');

// Check if Phantom is available
const hasPhantom = typeof window !== 'undefined' && window.solana?.isPhantom;
console.log('1️⃣ Phantom Available:', hasPhantom ? '✅ Yes' : '❌ No');

if (hasPhantom) {
  // Check Phantom connection
  const phantomConnected = window.solana.isConnected;
  const phantomPubkey = window.solana.publicKey?.toString();
  
  console.log('2️⃣ Phantom Connection State:');
  console.log('   - isConnected:', phantomConnected ? '✅ true' : '❌ false');
  console.log('   - publicKey:', phantomPubkey || '❌ null');
  
  if (phantomConnected && phantomPubkey) {
    console.log('   - Address:', phantomPubkey);
  }
}

// Check if Solflare is available
const hasSolflare = typeof window !== 'undefined' && window.solflare?.isSolflare;
console.log('\n3️⃣ Solflare Available:', hasSolflare ? '✅ Yes' : '❌ No');

if (hasSolflare) {
  const solflareConnected = window.solflare.isConnected;
  const solflarePubkey = window.solflare.publicKey?.toString();
  
  console.log('4️⃣ Solflare Connection State:');
  console.log('   - isConnected:', solflareConnected ? '✅ true' : '❌ false');
  console.log('   - publicKey:', solflarePubkey || '❌ null');
  
  if (solflareConnected && solflarePubkey) {
    console.log('   - Address:', solflarePubkey);
  }
}

// Test recheckConnection manually
console.log('\n5️⃣ Testing Manual Recheck:');
if (hasPhantom) {
  if (window.solana.isConnected && window.solana.publicKey) {
    const address = window.solana.publicKey.toString();
    console.log('   ✅ Phantom IS connected:', address);
    console.log('   → WalletContext should show this address');
  } else {
    console.log('   ❌ Phantom NOT connected');
    console.log('   → You need to connect your wallet first');
  }
} else if (hasSolflare) {
  if (window.solflare.isConnected && window.solflare.publicKey) {
    const address = window.solflare.publicKey.toString();
    console.log('   ✅ Solflare IS connected:', address);
    console.log('   → WalletContext should show this address');
  } else {
    console.log('   ❌ Solflare NOT connected');
    console.log('   → You need to connect your wallet first');
  }
} else {
  console.log('   ⚠️ No Solana wallet detected');
  console.log('   → Install Phantom or Solflare extension');
}

console.log('\n6️⃣ Next Steps:');
console.log('   1. If wallet is connected above, open TriggerOrderModal');
console.log('   2. Check console for: "🔄 Rechecking wallet connection..."');
console.log('   3. Check console for: "🔍 TriggerOrderModal - Wallet State"');
console.log('   4. Verify walletAddress and connected are both populated');
console.log('   5. Button should NOT be grayed out\n');

console.log('=== END DIAGNOSTIC ===\n');
