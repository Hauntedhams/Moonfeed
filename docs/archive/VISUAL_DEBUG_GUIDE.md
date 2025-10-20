# 👁️ VISUAL GUIDE - What to Look For

## BEFORE Opening Modal

### ✅ Check 1: Wallet Connected in UI
Look at the **top-right corner** of the app:
- Should see your wallet address (e.g., "GXa7...abc")
- If you DON'T see it, click the wallet button to connect

### ✅ Check 2: Browser Console Clear
- Open DevTools (F12)
- Go to Console tab
- Clear old logs (Cmd+K or click 🚫)

---

## WHEN Opening Trigger Modal

### What Happens:
1. Click any coin's "Trigger" button
2. Modal opens
3. Console logs appear immediately

### What to Watch For:

#### 🟢 GOOD - Working Correctly
```
🔄 Modal opened - triggering wallet recheck...
🔄 Rechecking wallet connection...
   Checking Phantom...
   window.solana.isConnected: true          👈 TRUE is good!
   window.solana.publicKey: GXa7...         👈 Address is good!
✅ Phantom IS connected! Setting state...   👈 Setting state!
   Setting walletAddress to: GXa7...
```

Then after a moment:
```
🔍 TriggerOrderModal - Detailed Wallet State: {
  From Context - walletAddress: 'GXa7...',  👈 Has address!
  From Context - connected: ✅ true,         👈 Connected!
  Button will be: ✅ ENABLED                 👈 BUTTON WORKS!
}
```

**Result:** Button should be BLUE and clickable ✅

---

#### 🔴 BAD - Not Working

**Scenario A: Wallet Not Connected**
```
🔄 Rechecking wallet connection...
   Checking Phantom...
   window.solana.isConnected: false         👈 FALSE is bad!
   window.solana.publicKey: null            👈 No address!
❌ Phantom not connected
```

**Fix:** Connect your wallet first!
- Look for wallet button in top-right
- Click it and approve connection in Phantom
- Try opening modal again

---

**Scenario B: State Not Updating**
```
✅ Phantom IS connected! Setting state...   👈 Says it's setting...
   Setting walletAddress to: GXa7...

[but then later...]

🔍 TriggerOrderModal - Detailed Wallet State: {
  From Context - walletAddress: ❌ NULL,    👈 But state is still null!
  From Context - connected: ❌ false,
  Button will be: 🔒 DISABLED
}
```

**This Means:** React state isn't updating properly
**Try:**
1. Hard refresh (Cmd+Shift+R)
2. Clear browser cache
3. If still broken, report this - it's a React context issue

---

**Scenario C: No Logs At All**
```
[Nothing appears in console when modal opens]
```

**This Means:** JavaScript not running or console filtered
**Try:**
1. Make sure Console tab is selected
2. Check filter isn't hiding logs
3. Check if JavaScript errors above
4. Hard refresh page

---

## QUICK VISUAL CHECK

### The Button

#### ✅ ENABLED (Working!)
- Button is **BLUE**
- Text is bright/readable
- Cursor changes to pointer on hover
- You can click it

#### ❌ DISABLED (Not Working)
- Button is **GRAY** or faded
- Text is dim
- Cursor is default/not-allowed
- Can't click it

---

## What to Share

If button is still grayed out, share this info:

1. **Screenshot** of the modal showing the grayed button
2. **Console output** - Copy the entire log when you open modal
3. **Wallet status** - What do you see in top-right?
   - Address visible?
   - "Connect Wallet" button?
   - Nothing?

---

## Quick Tests

### Test 1: Is Phantom Connected?
Paste in console:
```javascript
console.log({
  connected: window.solana?.isConnected,
  address: window.solana?.publicKey?.toString()
});
```

Should show:
```
{ connected: true, address: "GXa7..." }
```

### Test 2: Run Full Diagnostic
Paste entire contents of `wallet-diagnostic-v2.js` into console.

### Test 3: Manual Recheck
After running diagnostic, type:
```javascript
testWallet()
```

---

## Expected Timeline

1. **Click Trigger** → Modal opens (instant)
2. **First logs** → "Modal opened" (instant)
3. **Recheck logs** → "Rechecking connection..." (instant)
4. **State check** → "Detailed Wallet State" (after 100ms)
5. **Button updates** → Should be enabled by now

If button is still gray after 1-2 seconds, something is wrong.

---

## Bottom Line

The console logs will tell us EXACTLY what's happening:
- ✅ Is Phantom installed and connected?
- ✅ Is recheckConnection finding the wallet?
- ✅ Is it setting the state?
- ✅ Is the modal receiving the state?
- ✅ Why is the button disabled?

**Just open the modal and check the console!** 🔍
