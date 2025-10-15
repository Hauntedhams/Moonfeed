/**
 * EMERGENCY WALLET DIAGNOSTIC
 * Run this in the browser console to see what's happening
 */

console.clear();
console.log('🚨 === EMERGENCY WALLET DIAGNOSTIC ===\n');

// 1. Check Phantom
if (window.solana?.isPhantom) {
  console.log('1️⃣ Phantom Wallet:');
  console.log('   isConnected:', window.solana.isConnected);
  console.log('   publicKey:', window.solana.publicKey?.toString() || 'null');
  
  if (window.solana.isConnected) {
    console.log('   ✅ PHANTOM IS CONNECTED');
  } else {
    console.log('   ❌ PHANTOM NOT CONNECTED');
  }
} else {
  console.log('1️⃣ ❌ Phantom not found');
}

console.log('\n2️⃣ Testing recheckConnection Logic:');
if (window.solana?.isPhantom) {
  if (window.solana.isConnected && window.solana.publicKey) {
    const address = window.solana.publicKey.toString();
    console.log('   ✅ Should set walletAddress to:', address);
    console.log('   ✅ Should set connected to: true');
    console.log('   ✅ Should set walletType to: "phantom"');
  } else {
    console.log('   ❌ Wallet not connected - need to connect first');
  }
}

console.log('\n3️⃣ Action Plan:');
console.log('   1. Open TriggerOrderModal');
console.log('   2. Look for: "🔄 Rechecking wallet connection..."');
console.log('   3. Look for: "✅ Phantom is connected: <address>"');
console.log('   4. Look for: "🔍 TriggerOrderModal - Wallet State:"');
console.log('   5. Check if walletAddress is populated');

console.log('\n4️⃣ Manual Test:');
console.log('   Copy-paste this to manually trigger recheck:');
console.log('   ');
console.log('   // Force update (paste in console):');
console.log('   if (window.solana?.isConnected && window.solana.publicKey) {');
console.log('     console.log("MANUAL: Wallet is", window.solana.publicKey.toString());');
console.log('   }');

console.log('\n=== END DIAGNOSTIC ===\n');
