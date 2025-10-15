# 🐛 Wallet State Debug - Paste in Console

When you open the Trigger Order modal and the button is still grayed out, paste this in the console:

```javascript
console.clear();
console.log('%c🔍 WALLET STATE DIAGNOSTIC', 'font-size: 18px; font-weight: bold; color: #4f46e5;');
console.log('='.repeat(60));

// 1. Check browser-level wallet state
console.log('\n%c1️⃣ BROWSER WALLET STATE', 'font-weight: bold; color: #22c55e;');
const phantom = window.solana;
if (phantom) {
  console.log(`Phantom Installed: ✅ YES`);
  console.log(`  - isConnected: ${phantom.isConnected}`);
  console.log(`  - publicKey: ${phantom.publicKey?.toString() || 'null'}`);
  console.log(`  - isPhantom: ${phantom.isPhantom}`);
} else {
  console.log(`Phantom Installed: ❌ NO`);
}

// 2. Check React component state
console.log('\n%c2️⃣ REACT COMPONENT STATE', 'font-weight: bold; color: #22c55e;');

// Try to find the trigger modal button
const modal = document.querySelector('[class*="trigger"]');
const button = document.querySelector('.create-order-btn') || document.querySelector('button[class*="create-order"]') || document.querySelector('button[disabled]');

console.log(`Modal Found: ${modal ? '✅ YES' : '❌ NO'}`);
console.log(`Button Found: ${button ? '✅ YES' : '❌ NO'}`);

if (button) {
  console.log(`Button Disabled: ${button.disabled ? '❌ YES (grayed out)' : '✅ NO (active)'}`);
  console.log(`Button Text: "${button.textContent.trim()}"`);
}

// 3. Check input fields
console.log('\n%c3️⃣ INPUT FIELDS', 'font-weight: bold; color: #22c55e;');
const inputs = document.querySelectorAll('input[type="number"]');
console.log(`Number inputs found: ${inputs.length}`);
inputs.forEach((input, i) => {
  console.log(`  Input ${i + 1}: value = "${input.value}" ${input.value ? '✅' : '❌ EMPTY'}`);
});

// 4. Check for warning messages
console.log('\n%c4️⃣ WARNING MESSAGES', 'font-weight: bold; color: #22c55e;');
const warnings = document.querySelectorAll('[class*="warning"]');
const errors = document.querySelectorAll('[class*="error"]');
console.log(`Warnings: ${warnings.length}`);
warnings.forEach(w => console.log(`  - ${w.textContent.trim()}`));
console.log(`Errors: ${errors.length}`);
errors.forEach(e => console.log(`  - ${e.textContent.trim()}`));

// 5. Summary
console.log('\n' + '='.repeat(60));
console.log('%c📊 DIAGNOSIS', 'font-size: 14px; font-weight: bold; color: #4f46e5;');

const phantomConnected = phantom?.isConnected;
const hasAddress = !!phantom?.publicKey;
const buttonDisabled = button?.disabled;
const hasAmount = inputs.length > 0 && inputs[0]?.value;
const hasPrice = inputs.length > 1 && inputs[1]?.value;

console.log('\n%cButton Disabled Checklist:', 'font-weight: bold;');
console.log(`  1. Wallet Connected? ${phantomConnected ? '✅ YES' : '❌ NO'}`);
console.log(`  2. Has Address? ${hasAddress ? '✅ YES' : '❌ NO'}`);
console.log(`  3. Amount Filled? ${hasAmount ? '✅ YES' : '❌ NO'}`);
console.log(`  4. Price Filled? ${hasPrice ? '✅ YES' : '❌ NO'}`);

if (button && buttonDisabled) {
  console.log('\n%c❌ PROBLEM IDENTIFIED:', 'color: #ef4444; font-weight: bold;');
  
  if (!phantomConnected || !hasAddress) {
    console.log('   React context is NOT seeing the wallet connection!');
    console.log('   \n💡 SOLUTION:');
    console.log('   1. Open browser DevTools → Application → Clear Site Data');
    console.log('   2. OR refresh the page (Cmd+R)');
    console.log('   3. Reconnect wallet after page loads');
    console.log('   4. Wait 1-2 seconds for state to sync');
    console.log('   5. Try opening trigger modal again');
  } else if (!hasAmount || !hasPrice) {
    console.log('   Input fields are empty!');
    console.log('   \n💡 SOLUTION:');
    console.log('   Fill in both Amount and Trigger Price fields');
  }
} else if (button && !buttonDisabled) {
  console.log('\n%c✅ BUTTON IS ACTIVE!', 'color: #22c55e; font-weight: bold;');
  console.log('   You should be able to click it now!');
} else {
  console.log('\n%c⚠️  BUTTON NOT FOUND', 'color: #eab308; font-weight: bold;');
  console.log('   Make sure the trigger modal is open');
}

console.log('\n' + '='.repeat(60));

// Extra debug info
console.log('\n%c🔧 DEBUG INFO (for developer):', 'font-weight: bold; color: #888;');
console.log('   Check the debug logs above for:');
console.log('   - "TriggerOrderModal - Wallet State" (added debug log)');
console.log('   - "Phantom connected event" (if wallet connected after page load)');
console.log('   - "Auto-connected to Phantom" (if wallet connected on page load)');
```

---

## 📋 What to Look For

### ✅ Good State (Working)
```
1️⃣ BROWSER WALLET STATE
Phantom Installed: ✅ YES
  - isConnected: true
  - publicKey: 7tUowJGuqFbLs1WxQp9J8vY9V2n2Zr8cKpXz5Gh4Jb8G
  
📊 DIAGNOSIS
Button Disabled Checklist:
  1. Wallet Connected? ✅ YES
  2. Has Address? ✅ YES
  3. Amount Filled? ✅ YES
  4. Price Filled? ✅ YES
  
✅ BUTTON IS ACTIVE!
```

### ❌ Bad State (Problem)
```
1️⃣ BROWSER WALLET STATE
Phantom Installed: ✅ YES
  - isConnected: true        ← Connected at browser level
  - publicKey: 7tUowJGu...    ← Has address
  
2️⃣ REACT COMPONENT STATE
Button Disabled: ❌ YES       ← But button still disabled!

📊 DIAGNOSIS
Button Disabled Checklist:
  1. Wallet Connected? ✅ YES  ← Browser says yes
  2. Has Address? ✅ YES       ← Browser says yes
  BUT React context not syncing!

❌ PROBLEM IDENTIFIED:
   React context is NOT seeing the wallet connection!
```

---

## 🔧 Solutions Based on Results

### Solution 1: State Sync Issue (Most Likely)
**If browser shows connected but React doesn't:**

```bash
1. Close the trigger modal
2. Wait 2-3 seconds
3. Open trigger modal again
4. Check console for: "🔍 TriggerOrderModal - Wallet State"
5. If walletAddress is still null, try Solution 2
```

### Solution 2: Force Reconnect
```bash
1. Click wallet button → Disconnect
2. Wait 1 second
3. Click wallet button → Connect
4. Wait for "🔗 Phantom connected event" in console
5. Open trigger modal
6. Check button again
```

### Solution 3: Hard Reset
```bash
1. F12 → Console → Run:
   window.location.reload(true)
   
2. After reload, connect wallet
3. Wait for "✅ Auto-connected to Phantom" in console
4. Try trigger modal
```

### Solution 4: Clear Everything
```bash
1. F12 → Application tab
2. Clear Site Data → Clear all
3. Reload page
4. Connect wallet fresh
5. Try trigger modal
```

---

## 🎯 Expected Console Logs (When Working)

When you connect wallet, you should see:
```
🔗 Phantom connected event: 7tUowJGuqFbLs1WxQp9J8vY9V2n2Zr8cKpXz5Gh4Jb8G
```

When you open trigger modal, you should see:
```
🔍 TriggerOrderModal - Wallet State: {
  walletAddress: "7tUowJGuqFbLs1WxQp9J8vY9V2n2Zr8cKpXz5Gh4Jb8G",
  connected: true,
  hasSignTransaction: true,
  windowWallet: "7tUowJGuqFbLs1WxQp9J8vY9V2n2Zr8cKpXz5Gh4Jb8G",
  windowConnected: true
}
```

If `walletAddress` is `null` in that log, then the context is not syncing!

---

**Paste the diagnostic script in console and share the results!**
