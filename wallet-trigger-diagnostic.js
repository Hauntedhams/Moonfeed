/**
 * WALLET & TRIGGER API DIAGNOSTIC
 * Run this in browser console to check wallet and Jupiter Trigger API connectivity
 */

console.log('🔍 STARTING WALLET & TRIGGER API DIAGNOSTIC\n');
console.log('='.repeat(60));

// ============================================
// 1. CHECK WALLET AVAILABILITY
// ============================================
console.log('\n📱 1. CHECKING WALLET AVAILABILITY\n');

const phantomAvailable = typeof window !== 'undefined' && window.solana?.isPhantom;
const solflareAvailable = typeof window !== 'undefined' && window.solflare?.isSolflare;

console.log(`Phantom Available: ${phantomAvailable ? '✅ YES' : '❌ NO'}`);
console.log(`Solflare Available: ${solflareAvailable ? '✅ YES' : '❌ NO'}`);

if (phantomAvailable) {
  console.log(`  - Phantom Version: ${window.solana?._version || 'Unknown'}`);
  console.log(`  - Is Connected: ${window.solana?.isConnected || false}`);
  console.log(`  - Public Key: ${window.solana?.publicKey?.toString() || 'Not connected'}`);
}

if (solflareAvailable) {
  console.log(`  - Solflare Version: ${window.solflare?._version || 'Unknown'}`);
  console.log(`  - Is Connected: ${window.solflare?.isConnected || false}`);
  console.log(`  - Public Key: ${window.solflare?.publicKey?.toString() || 'Not connected'}`);
}

if (!phantomAvailable && !solflareAvailable) {
  console.log('❌ NO WALLET DETECTED!');
  console.log('   Please install Phantom (https://phantom.app) or Solflare');
}

// ============================================
// 2. CHECK WALLET CONTEXT STATE
// ============================================
console.log('\n🔗 2. CHECKING WALLET CONTEXT STATE\n');

// Try to get wallet context from React DevTools
try {
  // This will work if React DevTools is installed
  const walletContext = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.get(1);
  console.log('Wallet Context:', walletContext ? '✅ Found' : '❌ Not found');
  console.log('Note: Open React DevTools to see full context state');
} catch (err) {
  console.log('⚠️ Cannot access React context (install React DevTools for details)');
}

// Check if WalletProvider is in the React tree
const walletButtons = document.querySelectorAll('[class*="wallet"]');
console.log(`Wallet UI Elements Found: ${walletButtons.length}`);

// ============================================
// 3. TEST WALLET CONNECTION
// ============================================
console.log('\n🔌 3. TESTING WALLET CONNECTION\n');

async function testWalletConnection() {
  if (phantomAvailable) {
    try {
      console.log('Attempting Phantom connection...');
      const resp = await window.solana.connect();
      console.log('✅ Phantom connection successful!');
      console.log(`  - Address: ${resp.publicKey.toString()}`);
      return true;
    } catch (err) {
      console.log('❌ Phantom connection failed:', err.message);
      return false;
    }
  } else if (solflareAvailable) {
    try {
      console.log('Attempting Solflare connection...');
      const resp = await window.solflare.connect();
      console.log('✅ Solflare connection successful!');
      console.log(`  - Address: ${resp.publicKey.toString()}`);
      return true;
    } catch (err) {
      console.log('❌ Solflare connection failed:', err.message);
      return false;
    }
  } else {
    console.log('❌ No wallet available to test');
    return false;
  }
}

// Run connection test (commented out by default)
// Uncomment to test connection:
// testWalletConnection();

// ============================================
// 4. CHECK BACKEND TRIGGER API
// ============================================
console.log('\n🎯 4. CHECKING BACKEND TRIGGER API\n');

const backendUrl = window.location.origin.includes('localhost') 
  ? 'http://localhost:3001' 
  : window.location.origin;

console.log(`Backend URL: ${backendUrl}`);

async function testTriggerAPI() {
  try {
    // Test if trigger routes are mounted
    const testEndpoint = `${backendUrl}/api/trigger/test`;
    console.log(`Testing: ${testEndpoint}`);
    
    // Just check if the route exists (will likely 404 or 405, but should respond)
    const response = await fetch(testEndpoint, { method: 'GET' });
    console.log(`Response Status: ${response.status}`);
    
    if (response.status === 404) {
      console.log('⚠️ Trigger API routes may not be mounted properly');
    } else {
      console.log('✅ Backend is responding');
    }
  } catch (err) {
    console.log('❌ Backend connection failed:', err.message);
  }
}

testTriggerAPI();

// ============================================
// 5. CHECK JUPITER TRIGGER API DIRECTLY
// ============================================
console.log('\n🪐 5. CHECKING JUPITER TRIGGER API\n');

async function testJupiterAPI() {
  try {
    const testWallet = 'So11111111111111111111111111111111111111112'; // Dummy address
    const url = `https://api.jup.ag/trigger/v1/getTriggerOrders?wallet=${testWallet}&status=active&page=1&limit=1`;
    
    console.log('Testing Jupiter Trigger API...');
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`Response Status: ${response.status}`);
    console.log('✅ Jupiter Trigger API is accessible');
    console.log('Response:', data);
  } catch (err) {
    console.log('❌ Jupiter Trigger API connection failed:', err.message);
  }
}

testJupiterAPI();

// ============================================
// 6. CHECK TRIGGER ORDER MODAL STATE
// ============================================
console.log('\n📋 6. CHECKING TRIGGER ORDER MODAL\n');

const triggerModal = document.querySelector('[class*="trigger-modal"]');
const createOrderBtn = document.querySelector('.create-order-btn');

console.log(`Trigger Modal Found: ${triggerModal ? '✅ YES' : '❌ NO'}`);
console.log(`Create Order Button Found: ${createOrderBtn ? '✅ YES' : '❌ NO'}`);

if (createOrderBtn) {
  const isDisabled = createOrderBtn.disabled;
  console.log(`Button Disabled: ${isDisabled ? '❌ YES' : '✅ NO'}`);
  
  if (isDisabled) {
    console.log('\n🔍 BUTTON IS DISABLED - Possible Reasons:');
    console.log('  1. Wallet not connected (!walletAddress)');
    console.log('  2. Input amount is empty');
    console.log('  3. Trigger price is empty');
    console.log('  4. Transaction is loading');
    console.log('\n💡 Solution: Connect your wallet using the wallet button');
  }
}

// ============================================
// 7. SUMMARY & RECOMMENDATIONS
// ============================================
console.log('\n' + '='.repeat(60));
console.log('📊 DIAGNOSTIC SUMMARY\n');

const issues = [];
const fixes = [];

if (!phantomAvailable && !solflareAvailable) {
  issues.push('No wallet extension detected');
  fixes.push('Install Phantom (https://phantom.app) or Solflare');
}

if (phantomAvailable && !window.solana?.isConnected) {
  issues.push('Phantom wallet not connected');
  fixes.push('Click the wallet button in the top-right corner');
}

if (solflareAvailable && !window.solflare?.isConnected) {
  issues.push('Solflare wallet not connected');
  fixes.push('Click the wallet button in the top-right corner');
}

if (createOrderBtn?.disabled) {
  issues.push('Create Order button is disabled');
  fixes.push('Ensure wallet is connected and all fields are filled');
}

if (issues.length === 0) {
  console.log('✅ ALL CHECKS PASSED!');
  console.log('Everything looks good. You should be able to create orders.');
} else {
  console.log('❌ ISSUES FOUND:\n');
  issues.forEach((issue, i) => {
    console.log(`  ${i + 1}. ${issue}`);
  });
  
  console.log('\n💡 RECOMMENDED FIXES:\n');
  fixes.forEach((fix, i) => {
    console.log(`  ${i + 1}. ${fix}`);
  });
}

console.log('\n' + '='.repeat(60));
console.log('🏁 DIAGNOSTIC COMPLETE');
console.log('\n💡 To manually test wallet connection, run:');
console.log('   window.solana.connect() // For Phantom');
console.log('   window.solflare.connect() // For Solflare');
console.log('\n💡 To check wallet context state in console:');
console.log('   document.querySelector(".wallet-button")');
console.log('\n');
