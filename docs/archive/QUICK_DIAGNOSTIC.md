# 🚨 QUICK DIAGNOSTIC - Copy & Paste in Browser Console

Open your browser console (F12) and paste this:

```javascript
// ============================================
// QUICK WALLET & ORDER BUTTON DIAGNOSTIC
// ============================================

console.clear();
console.log('%c🔍 QUICK DIAGNOSTIC', 'font-size: 20px; font-weight: bold; color: #4f46e5;');
console.log('='.repeat(50));

// 1. Wallet Detection
console.log('\n%c1️⃣ WALLET DETECTION', 'font-weight: bold; color: #22c55e;');
const phantom = window.solana?.isPhantom;
const solflare = window.solflare?.isSolflare;
console.log(`Phantom: ${phantom ? '✅ Installed' : '❌ Not found'}`);
console.log(`Solflare: ${solflare ? '✅ Installed' : '❌ Not found'}`);

if (!phantom && !solflare) {
  console.log('%c❌ ISSUE: No wallet extension found!', 'color: #ef4444; font-weight: bold;');
  console.log('   Fix: Install Phantom from https://phantom.app');
}

// 2. Wallet Connection
console.log('\n%c2️⃣ WALLET CONNECTION', 'font-weight: bold; color: #22c55e;');
const phantomConnected = window.solana?.isConnected;
const phantomAddress = window.solana?.publicKey?.toString();
console.log(`Phantom Connected: ${phantomConnected ? '✅ YES' : '❌ NO'}`);
if (phantomAddress) {
  console.log(`Address: ${phantomAddress}`);
}

const solflareConnected = window.solflare?.isConnected;
const solflareAddress = window.solflare?.publicKey?.toString();
console.log(`Solflare Connected: ${solflareConnected ? '✅ YES' : '❌ NO'}`);
if (solflareAddress) {
  console.log(`Address: ${solflareAddress}`);
}

if (!phantomConnected && !solflareConnected) {
  console.log('%c❌ ISSUE: Wallet not connected!', 'color: #ef4444; font-weight: bold;');
  console.log('   Fix: Click "Connect Wallet" button in top-right corner');
}

// 3. UI Elements
console.log('\n%c3️⃣ UI ELEMENTS', 'font-weight: bold; color: #22c55e;');
const walletBtn = document.querySelector('[class*="wallet-button"]') || document.querySelector('button[class*="wallet"]');
const orderBtn = document.querySelector('.create-order-btn');
console.log(`Wallet Button: ${walletBtn ? '✅ Found' : '❌ Not found'}`);
console.log(`Order Button: ${orderBtn ? '✅ Found' : '❌ Not found'}`);

// 4. Order Button State
if (orderBtn) {
  console.log('\n%c4️⃣ ORDER BUTTON STATE', 'font-weight: bold; color: #22c55e;');
  const isDisabled = orderBtn.disabled;
  console.log(`Disabled: ${isDisabled ? '❌ YES' : '✅ NO'}`);
  
  if (isDisabled) {
    console.log('%c❌ BUTTON IS DISABLED', 'color: #ef4444; font-weight: bold;');
    console.log('   Possible reasons:');
    console.log('   1. Wallet not connected (most common)');
    console.log('   2. Amount field empty');
    console.log('   3. Trigger price field empty');
  }
}

// 5. Input Fields
const amountInput = document.querySelector('input[placeholder*="amount"]') || document.querySelector('input[type="number"]');
const priceInput = document.querySelectorAll('input[type="number"]')[1];
if (amountInput || priceInput) {
  console.log('\n%c5️⃣ INPUT FIELDS', 'font-weight: bold; color: #22c55e;');
  if (amountInput) {
    console.log(`Amount Value: ${amountInput.value || '❌ EMPTY'}`);
  }
  if (priceInput) {
    console.log(`Price Value: ${priceInput.value || '❌ EMPTY'}`);
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('%c📊 SUMMARY', 'font-size: 16px; font-weight: bold; color: #4f46e5;');

const issues = [];
if (!phantom && !solflare) issues.push('No wallet installed');
if (!phantomConnected && !solflareConnected) issues.push('Wallet not connected');
if (orderBtn?.disabled) issues.push('Order button disabled');

if (issues.length === 0) {
  console.log('%c✅ ALL GOOD! Button should work.', 'color: #22c55e; font-weight: bold; font-size: 14px;');
} else {
  console.log('%c❌ ISSUES FOUND:', 'color: #ef4444; font-weight: bold;');
  issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
  
  console.log('\n%c💡 SOLUTION:', 'color: #eab308; font-weight: bold;');
  if (!phantom && !solflare) {
    console.log('   1. Install Phantom wallet from https://phantom.app');
  }
  if (!phantomConnected && !solflareConnected) {
    console.log('   2. Click "Connect Wallet" button in top-right');
    console.log('   3. Approve the connection');
  }
  if (orderBtn?.disabled) {
    console.log('   4. Fill in amount and trigger price');
  }
}

console.log('\n%c🎯 QUICK ACTIONS:', 'font-weight: bold;');
console.log('Test wallet connection:');
console.log('   window.solana?.connect()');
console.log('Check wallet address:');
console.log('   window.solana?.publicKey?.toString()');

console.log('\n' + '='.repeat(50));
```

---

## 📋 Expected Output

### ✅ If Everything is Working:
```
🔍 QUICK DIAGNOSTIC
==================================================

1️⃣ WALLET DETECTION
Phantom: ✅ Installed
Solflare: ❌ Not found

2️⃣ WALLET CONNECTION
Phantom Connected: ✅ YES
Address: 7tUowJGuqFbLs1WxQp9J8vY9V2n2Zr8cKpXz5Gh4Jb8G

3️⃣ UI ELEMENTS
Wallet Button: ✅ Found
Order Button: ✅ Found

4️⃣ ORDER BUTTON STATE
Disabled: ✅ NO

5️⃣ INPUT FIELDS
Amount Value: 10
Price Value: 0.0001

📊 SUMMARY
✅ ALL GOOD! Button should work.
```

### ❌ If Wallet Not Connected:
```
🔍 QUICK DIAGNOSTIC
==================================================

1️⃣ WALLET DETECTION
Phantom: ✅ Installed

2️⃣ WALLET CONNECTION
Phantom Connected: ❌ NO
❌ ISSUE: Wallet not connected!
   Fix: Click "Connect Wallet" button in top-right corner

3️⃣ UI ELEMENTS
Wallet Button: ✅ Found
Order Button: ✅ Found

4️⃣ ORDER BUTTON STATE
Disabled: ❌ YES
❌ BUTTON IS DISABLED
   Possible reasons:
   1. Wallet not connected (most common)

📊 SUMMARY
❌ ISSUES FOUND:
   1. Wallet not connected
   2. Order button disabled

💡 SOLUTION:
   2. Click "Connect Wallet" button in top-right
   3. Approve the connection
```

---

## 🎯 Next Steps Based on Results

### If "No wallet installed":
1. Go to https://phantom.app
2. Install Phantom extension
3. Create/import wallet
4. Refresh page
5. Run diagnostic again

### If "Wallet not connected":
1. Look for wallet button (usually top-right)
2. Click "Connect Wallet"
3. Choose Phantom
4. Click "Connect"
5. Approve in popup
6. Button should show your address
7. Try limit order again

### If "Order button disabled":
1. Make sure wallet is connected
2. Fill in "Amount" field
3. Fill in "Trigger Price" field
4. Button should become active

---

## 🔧 Manual Connection Test

If diagnostic shows wallet installed but not connected, try:

```javascript
// Connect to Phantom
window.solana.connect()
  .then(resp => {
    console.log('✅ Connected!');
    console.log('Address:', resp.publicKey.toString());
  })
  .catch(err => {
    console.log('❌ Connection failed:', err.message);
  });
```

---

**Copy the JavaScript code above into your browser console and share the results!**
