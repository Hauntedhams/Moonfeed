# 🔍 Wallet & Trigger API Diagnostic Guide

## Issue: Create Order Button is Grayed Out

Your "Create Limit Order" button is disabled because the wallet is not connected. Let's diagnose and fix it!

---

## 🚀 Quick Fix (Try This First!)

### Step 1: Check if Wallet Button Exists
Look for a **wallet button** in the top-right corner of your app. It should say:
- "Connect Wallet" (if disconnected)
- Your wallet address (if connected)

### Step 2: Click Connect Wallet
1. Click the wallet button
2. Choose Phantom or Solflare
3. Approve the connection
4. The button should show your address (e.g., "7tUow...JGu")

### Step 3: Try Limit Order Again
1. Open the token you want to trade
2. Click "Limit Order" or "Set Order"
3. Fill in amount and trigger price
4. The "Create Order" button should now be **ACTIVE** ✅

---

## 🔧 Full Diagnostic (If Quick Fix Doesn't Work)

### Run Diagnostic Script

1. Open your app in Chrome/Brave
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Copy and paste the contents of `wallet-trigger-diagnostic.js`
5. Press Enter

### What the Diagnostic Checks

```
📱 1. WALLET AVAILABILITY
   - Phantom installed? ✅/❌
   - Solflare installed? ✅/❌
   - Wallet version
   - Connection status

🔗 2. WALLET CONTEXT STATE
   - React context loaded? ✅/❌
   - WalletProvider in tree? ✅/❌

🔌 3. WALLET CONNECTION TEST
   - Can connect to Phantom? ✅/❌
   - Can connect to Solflare? ✅/❌
   - Gets wallet address? ✅/❌

🎯 4. BACKEND TRIGGER API
   - Backend responding? ✅/❌
   - Routes mounted? ✅/❌

🪐 5. JUPITER TRIGGER API
   - Can reach Jupiter? ✅/❌
   - API accessible? ✅/❌

📋 6. TRIGGER ORDER MODAL
   - Modal rendered? ✅/❌
   - Button found? ✅/❌
   - Button disabled? Why?

📊 7. SUMMARY
   - Issues found
   - Recommended fixes
```

---

## 🐛 Common Issues & Solutions

### Issue 1: No Wallet Extension Detected
**Symptom**: 
```
❌ Phantom Available: NO
❌ Solflare Available: NO
```

**Solution**:
1. Install Phantom: https://phantom.app
2. OR install Solflare: https://solflare.com
3. Refresh page
4. Run diagnostic again

---

### Issue 2: Wallet Not Connected
**Symptom**:
```
✅ Phantom Available: YES
Is Connected: false
Public Key: Not connected
```

**Solution**:
1. Look for wallet button in top-right corner
2. Click "Connect Wallet"
3. Choose Phantom/Solflare
4. Approve connection
5. Button should show your address

---

### Issue 3: Wallet Button Not Showing
**Symptom**:
```
Wallet UI Elements Found: 0
```

**Solution**:
1. Check if `WalletButton.jsx` is imported in `App.jsx`
2. Look for this code in `App.jsx`:
   ```jsx
   import WalletButton from './components/WalletButton';
   
   // In JSX:
   <WalletButton />
   ```
3. If missing, the wallet button component isn't rendered

---

### Issue 4: Button Disabled Despite Wallet Connected
**Symptom**:
```
✅ Phantom Available: YES
Is Connected: true
Button Disabled: YES
```

**Possible Reasons**:
1. **Amount field empty** - Enter amount to trade
2. **Trigger price empty** - Set your target price
3. **Loading state** - Wait for previous action to complete

**Check in Modal**:
- Amount input has value?
- Trigger price has value?
- No error message showing?

---

### Issue 5: Backend Not Responding
**Symptom**:
```
❌ Backend connection failed: Failed to fetch
```

**Solution**:
1. Check if backend is running:
   ```bash
   cd backend
   npm run dev
   ```
2. Backend should start on port 3001
3. Look for this in console:
   ```
   🎯 Jupiter Trigger routes mounted at /api/trigger
   ```

---

### Issue 6: Jupiter API Not Accessible
**Symptom**:
```
❌ Jupiter Trigger API connection failed
```

**Solution**:
1. Check internet connection
2. Jupiter API might be down (rare)
3. Check status: https://jup.ag
4. Try again in a few minutes

---

## 🎯 Button Disabled Logic

The "Create Order" button is disabled when:

```javascript
disabled={
  loading ||          // Transaction in progress
  !walletAddress ||   // Wallet not connected ⚠️ MOST COMMON
  !inputAmount ||     // Amount not entered
  !triggerPrice       // Trigger price not set
}
```

**Priority Check**:
1. ✅ Is wallet connected? (Look for address in top-right)
2. ✅ Is amount filled in?
3. ✅ Is trigger price filled in?
4. ✅ Is transaction loading? (Wait)

---

## 📱 Manual Wallet Connection Test

Run this in browser console:

### For Phantom:
```javascript
// Check if available
console.log('Phantom:', window.solana?.isPhantom);

// Connect
window.solana.connect()
  .then(resp => {
    console.log('✅ Connected:', resp.publicKey.toString());
  })
  .catch(err => {
    console.log('❌ Failed:', err.message);
  });
```

### For Solflare:
```javascript
// Check if available
console.log('Solflare:', window.solflare?.isSolflare);

// Connect
window.solflare.connect()
  .then(resp => {
    console.log('✅ Connected:', resp.publicKey.toString());
  })
  .catch(err => {
    console.log('❌ Failed:', err.message);
  });
```

---

## 🔍 Check Wallet Context in React DevTools

1. Install React DevTools extension
2. Open DevTools → Components tab
3. Search for `WalletProvider`
4. Check hooks/state:
   ```
   walletAddress: "7tUow...JGu" ✅
   connected: true ✅
   connecting: false
   ```

If `walletAddress` is `null` → wallet not connected!

---

## ✅ Expected Working State

When everything is working:

```
📱 Wallet:
   ✅ Phantom/Solflare installed
   ✅ Wallet connected
   ✅ Address showing in UI

📋 Modal:
   ✅ Amount filled: "10"
   ✅ Trigger price filled: "0.0001"
   ✅ Button enabled (not grayed out)

🎯 Console:
   ✅ No error messages
   ✅ "Connected to Phantom: 7tUow..."
```

---

## 🚑 Emergency Reset

If nothing works, try this:

```bash
# 1. Clear browser cache
Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)
Select: Cookies, Cache, Site Data
Time range: All time

# 2. Disconnect wallet
Open Phantom → Settings → Connected Sites
Remove your app

# 3. Restart everything
1. Close browser
2. Stop backend (Ctrl+C)
3. Stop frontend (Ctrl+C)
4. Restart backend: cd backend && npm run dev
5. Restart frontend: cd frontend && npm run dev
6. Open fresh browser window
7. Connect wallet again
```

---

## 📞 Still Not Working?

Run the diagnostic and share results:

```bash
# 1. Run diagnostic (copy wallet-trigger-diagnostic.js to console)
# 2. Take screenshot of console output
# 3. Check these files exist:
ls frontend/src/components/WalletButton.jsx
ls frontend/src/contexts/WalletContext.jsx
ls frontend/src/components/TriggerOrderModal.jsx

# 4. Check backend logs for:
grep "trigger" backend/server.js
```

---

## 🎉 Success Checklist

- [ ] Phantom/Solflare installed
- [ ] Wallet button visible in UI
- [ ] Wallet connected (address showing)
- [ ] Backend running on :3001
- [ ] Frontend running on :5173
- [ ] Modal opens when clicking token
- [ ] Amount and price inputs work
- [ ] "Create Order" button is BLUE/ENABLED
- [ ] Clicking button shows wallet popup
- [ ] Transaction can be signed

**If all checked** → Everything working! 🎉

---

**Next Step**: Run `wallet-trigger-diagnostic.js` in your browser console and share the output!
