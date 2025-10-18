# How to Cancel Your Stuck Limit Order

## Quick Guide

Your limit order didn't execute and your funds are stuck. Here's how to get them back:

### Step 1: Refresh the App
```bash
# In your browser
Press Ctrl+Shift+R (Windows/Linux)
Or Cmd+Shift+R (Mac)
```

This ensures you have the latest code with the fix.

### Step 2: Go to Profile
1. Click the **Profile** icon (bottom navigation bar)
2. Your wallet should already be connected
3. You should see your stuck order under "Active Orders"

### Step 3: Cancel the Order
1. Find your stuck order in the list
2. Click the **"🗑️ Cancel Order"** button
3. **Important**: A wallet popup will appear

### Step 4: Approve in Wallet
1. Your wallet (Phantom/Solflare) will show a popup
2. Review the transaction
3. Click **"Approve"** or **"Confirm"**
4. Wait 5-10 seconds

### Step 5: Verify Funds Returned
1. You'll see a success message with the transaction signature
2. Click "OK" to view the transaction on Solscan
3. Check your wallet balance - funds should be back!

## Expected Timeline
- **Transaction approval**: 5-10 seconds
- **Blockchain confirmation**: 30 seconds to 2 minutes
- **Funds in wallet**: Immediately after confirmation

## What You'll See

### Before Cancellation
```
📊 Limit Orders
   Active

Order Card:
┌──────────────────────────┐
│ BONK  🟢 Buy             │
│ Status: active           │
│                          │
│ Current Price: $0.00001  │
│ Trigger Price: $0.00002  │
│ Amount: 1,000,000 BONK   │
│ Created: 8h 15m ago      │
│ Expires In: Expired      │
│ Est. Value: 0.5 SOL      │
│                          │
│ [🗑️ Cancel Order]        │
└──────────────────────────┘
```

### During Cancellation
```
Order Card:
┌──────────────────────────┐
│ BONK  🟢 Buy             │
│                          │
│ [⏳ Cancelling...]       │
└──────────────────────────┘

+ Wallet popup appears
```

### After Cancellation
```
✅ Order cancelled successfully!

Transaction: 5x7k9m2n...

[OK - View on Solscan]

(Order disappears from list)
```

## Console Logs (Press F12)

Look for these messages in the browser console:

### Success
```
[Cancel Order] Step 1: Requesting cancel transaction from backend...
[Cancel Order] Step 2: Transaction received, requesting wallet signature...
[Cancel Order] Step 3: Sending transaction to wallet for signing...
[Cancel Order] Step 4: Executing signed transaction...
[Cancel Order] ✅ Order cancelled successfully! 5x7k9m...
```

### If You Rejected
```
[Cancel Order] ❌ Error: User rejected the request
```

## Troubleshooting

### Problem: "Please connect your wallet first"
**Solution**: 
1. Click "Select Wallet" button
2. Choose your wallet (Phantom/Solflare)
3. Approve the connection
4. Try cancelling again

### Problem: Wallet popup doesn't appear
**Solution**:
1. Check if popup blocker is enabled (disable it)
2. Make sure wallet extension is unlocked
3. Try refreshing the page
4. Try cancelling again

### Problem: "Wallet does not support transaction signing"
**Solution**:
1. Update your wallet extension to latest version
2. Or switch to Phantom/Solflare wallet
3. Try cancelling again

### Problem: Transaction failed
**Solution**:
1. Make sure you have at least 0.001 SOL for fees
2. Wait a few seconds and try again
3. Check Solana network status (solana.com/status)

### Problem: Order still showing after cancellation
**Solution**:
1. Wait 30 seconds for blockchain confirmation
2. Refresh the page (Ctrl+R)
3. Check your wallet balance - funds might already be there

## Alternative: Cancel via Jupiter

If the app method doesn't work, you can cancel directly on Jupiter:

1. Go to https://jup.ag/limit
2. Connect your wallet
3. Find your order in the list
4. Click "Cancel"
5. Approve in wallet

## Checking Transaction Status

### View on Solscan
1. Copy the transaction signature from the success message
2. Go to https://solscan.io/tx/YOUR_SIGNATURE
3. Check status (should say "Success")

### Check Your Wallet
1. Open your wallet app/extension
2. View recent transactions
3. Look for "Jupiter Limit Order Cancel"
4. Check your SOL balance increased

## Expected Refund Amount

Your refund will be:
```
Original locked amount: [Your SOL amount]
Minus network fee:      ~0.000005 SOL
──────────────────────────────────────
Refund to wallet:       [Original - fee]
```

Example:
- Locked: 0.5 SOL
- Fee: 0.000005 SOL
- Refund: 0.499995 SOL

## Why Didn't My Order Execute?

Your order didn't execute because:
1. ❌ Price never reached your trigger ($0.00002 in your case)
2. ❌ Or price moved too fast past the trigger
3. ❌ Or no liquidity at that exact price
4. ❌ Order expired before price reached target

This is **normal** for limit orders - they only execute if conditions are perfect.

## Important Notes

### Your Funds Are Safe
- ✅ Funds are locked in Jupiter's smart contract
- ✅ Not lost or stolen
- ✅ Can always be recovered by cancelling
- ✅ Automatically refunded if order expires

### Transaction Fees
- ✅ Very cheap (~$0.0005)
- ✅ Paid in SOL from your wallet
- ✅ Not paid from locked funds

### Order History
- After cancellation, order moves to "History" tab
- Shows as "cancelled" status
- Transaction signature saved for reference

## Need Help?

If you're still having trouble:

1. **Check Console Logs** (Press F12)
   - Look for error messages
   - Screenshot any red errors

2. **Verify Wallet Connection**
   - Wallet shows "Connected"
   - Your address is displayed

3. **Check Backend**
   - Backend should be running on port 3001
   - Check terminal for errors

4. **Try Alternative Method**
   - Use Jupiter.ag directly
   - Wait for auto-expiration refund

## Success!

Once cancelled:
- ✅ Order disappears from Active Orders
- ✅ Appears in History tab as "cancelled"
- ✅ Funds back in your wallet
- ✅ Can create new orders

You can now:
- Create a new limit order with better trigger price
- Trade directly instead of using limit orders
- Keep your SOL in wallet for other uses

---

**Good luck recovering your funds! The fix is now live and working!** 🎉
