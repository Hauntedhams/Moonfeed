// Quick test to diagnose frontend API connection issue
// Run this in the browser console on https://moonfeed.app

console.log('🔍 Frontend API Diagnostic Test');
console.log('================================\n');

// Test 1: Check API configuration
console.log('1️⃣ Checking API Configuration...');
const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
console.log(`   Hostname: ${hostname}`);
console.log(`   Is Localhost: ${isLocalhost}`);
console.log(`   Expected API: ${isLocalhost ? 'http://localhost:3001' : 'https://api.moonfeed.app'}`);
console.log('');

// Test 2: Direct API test
console.log('2️⃣ Testing Direct API Call...');
const apiUrl = 'https://api.moonfeed.app/api/coins/trending?limit=1';
console.log(`   Testing: ${apiUrl}`);

fetch(apiUrl)
  .then(response => {
    console.log(`   ✅ Response Status: ${response.status} ${response.statusText}`);
    return response.json();
  })
  .then(data => {
    console.log(`   ✅ Data received:`, data);
    console.log(`   ✅ Coins count: ${data.count || 0}`);
    if (data.coins && data.coins[0]) {
      console.log(`   ✅ First coin: ${data.coins[0].symbol} - ${data.coins[0].name}`);
    }
    console.log('\n✅ API Connection: WORKING');
    console.log('\nIf you see "failed to load coins" on the page, the issue is in the React code, not the API.');
    console.log('Possible causes:');
    console.log('  1. React error boundary catching an error');
    console.log('  2. State update issue in the component');
    console.log('  3. Render error after receiving data');
    console.log('\nCheck the Console for any React errors above.');
  })
  .catch(error => {
    console.error(`   ❌ Error: ${error.message}`);
    console.log('\n❌ API Connection: FAILED');
    console.log('\nPossible causes:');
    console.log('  1. CORS issue');
    console.log('  2. Network connectivity problem');
    console.log('  3. Backend is down');
    console.log('\nCheck the Network tab for more details.');
  });

// Test 3: Check for any existing errors
console.log('\n3️⃣ Checking for existing errors...');
console.log('   (Look above in the console for any red error messages)');
console.log('');

// Test 4: Try to access React DevTools info
setTimeout(() => {
  console.log('\n4️⃣ Component State Check...');
  console.log('   Open React DevTools to inspect component state');
  console.log('   Look for: ModernTokenScroller component');
  console.log('   Check: coins array, loading state, error state');
}, 1000);
