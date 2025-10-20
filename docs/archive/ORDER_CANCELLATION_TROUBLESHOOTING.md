# Order Cancellation Troubleshooting Guide

## "Failed to Decode Transaction" Error - What It Means & How to Fix It

### Problem Description
When clicking "Cancel Order" on a limit order, you see an error message:
```
Failed to decode transaction
```

This means the transaction returned from Jupiter's API couldn't be properly decoded by your wallet for signing.

---

## Why This Happens

### Common Causes

1. **Versioned vs Legacy Transaction Format**
   - Jupiter may return a versioned transaction (v0)
   - Some wallets only support legacy transactions
   - Our app tries both formats automatically

2. **Outdated Transaction**
   - Transaction may have expired blockhash
   - Network state changed since transaction was created
   - Need fresh transaction from Jupiter

3. **Order Already Cancelled/Executed**
   - Order may no longer exist on-chain
   - Trying to cancel an already-processed order
   - UI state not yet updated

4. **Network Issues**
   - RPC connection problem
   - Jupiter API temporarily unavailable
   - Wallet provider connection lost

---

## How Our System Handles It

### Automatic Retry Logic (Already Implemented)

```javascript
// Step 1: Try to decode as versioned transaction (v0)
try {
  transaction = VersionedTransaction.deserialize(transactionBuffer);
  console.log('[Cancel Order] Decoded as versioned transaction');
} catch (versionedError) {
  
  // Step 2: Fallback to legacy transaction format
  try {
    transaction = Transaction.from(transactionBuffer);
    console.log('[Cancel Order] Decoded as legacy transaction');
  } catch (legacyError) {
    
    // Step 3: Show user-friendly error with instructions
    throw new Error('Failed to decode transaction. The order may need to be cancelled directly on Jupiter.ag/limit');
  }
}
```

### Blockhash Update (Implemented)
```javascript
// For versioned transactions, update blockhash to latest
if (isVersioned) {
  const recentBlockhash = await connection.getLatestBlockhash();
  transaction.message.recentBlockhash = recentBlockhash.blockhash;
}
```

---

## What You Should Do

### Immediate Steps

#### 1. **Check Order Status on Solscan**
- Click the **📝 Create TX** link in the order card
- Verify order exists on-chain
- Check if already cancelled or executed

#### 2. **Refresh the Page**
```
1. Reload Moonfeed app
2. Navigate back to Profile → Limit Orders
3. Check if order still appears
4. If order gone = already cancelled/executed
```

#### 3. **Try Again (One More Time)**
```
Sometimes network issues are transient:
- Click "Cancel Order" again
- Approve in wallet when prompted
- Check for success message
```

#### 4. **Use Jupiter Directly (Backup Method)**
If Moonfeed cancellation keeps failing:

```
1. Go to https://limit.jup.ag/
2. Connect your wallet
3. View your active orders
4. Cancel from Jupiter's interface
5. Return to Moonfeed and refresh
```

---

## Detailed Troubleshooting

### Error: "User rejected the request"
**Cause**: You clicked "Reject" in wallet popup  
**Solution**: Click "Cancel Order" again and approve in wallet

### Error: "Wallet does not support signing"
**Cause**: Wallet doesn't support required transaction type  
**Solution**: 
- Try a different wallet (Phantom, Solflare recommended)
- Use Jupiter.ag directly

### Error: "Order not found"
**Cause**: Order already cancelled/executed or never existed  
**Solution**: 
- Check order in History tab
- Verify on Solscan with Create TX link
- Refresh page to clear stale UI

### Error: "Network request failed"
**Cause**: Connection to Jupiter API or RPC lost  
**Solution**:
- Check your internet connection
- Wait 30 seconds and try again
- Try different time if network congested

---

## Understanding Transaction Signatures

### Why Signatures Matter
Every order action creates an on-chain transaction:
- **Create** → When you place order
- **Update** → If you modify order (future feature)
- **Cancel** → When you manually cancel
- **Execute** → When order automatically fills

### How to Use Signatures for Troubleshooting

#### For Active Orders
```
📝 Create TX: 5wK9m...7hP3q ↗
   └─> Click to verify order exists on-chain
   
🔄 Update TX: 8nL2p...4jM9r ↗  (if modified)
   └─> Click to see what changed
```

#### For Historical Orders
```
Transaction History:
Create: 3xB7c...9kF2p ↗
   └─> When order was placed
   
Cancel: 9mK4w...2hL8q ↗
   └─> Proof of cancellation (if cancelled)
   
Execute: 7jP3r...9nM2w ↗
   └─> Proof of execution (if executed)
```

### Verifying on Solscan

1. **Click any transaction link**
2. **Check transaction status**:
   ```
   ✅ Success = Transaction completed
   ❌ Failed = Transaction reverted
   ⏳ Processing = Still confirming
   ```

3. **Read error logs** (if failed):
   - Click "Logs" tab on Solscan
   - Look for error message
   - Common errors:
     - "Order not found" = Already cancelled/executed
     - "Insufficient funds" = Not enough SOL for fees
     - "Blockhash expired" = Transaction too old

---

## Prevention Tips

### ✅ Best Practices

1. **Keep Moonfeed Updated**
   - Refresh page periodically
   - Clear browser cache if issues persist

2. **Monitor Order Status**
   - Check orders regularly
   - Verify create transaction after placing order
   - Don't assume order is active without verification

3. **Use Recommended Wallets**
   - **Phantom** (best support for versioned transactions)
   - **Solflare** (excellent compatibility)
   - **Backpack** (modern, well-maintained)

4. **Check Network Status**
   - During high congestion, cancellations may be slow
   - Wait for full confirmation before trying again
   - Use https://status.solana.com/ to check network

### ❌ Common Mistakes

1. **Clicking Cancel Multiple Times**
   - Don't spam cancel button
   - Wait for wallet popup
   - Each attempt costs gas if successful

2. **Ignoring Wallet Prompts**
   - Always read wallet messages
   - Check transaction details before approving
   - Don't approve if details look wrong

3. **Not Verifying on Solscan**
   - Always check create transaction
   - Verify cancellation completed
   - Don't trust UI alone

---

## Technical Details (For Advanced Users)

### Transaction Format Issue
```javascript
// What happens when you click "Cancel Order"

1. Frontend requests cancel transaction from backend
   POST /api/trigger/cancel-order
   { maker: "YourWallet...", orderId: "3xB7c..." }

2. Backend calls Jupiter API
   POST https://lite-api.jup.ag/trigger/v1/cancelOrder
   Returns: { transaction: "base64_encoded_data" }

3. Frontend decodes transaction
   - Try VersionedTransaction.deserialize() first
   - Fallback to Transaction.from() if that fails
   - Update blockhash to latest
   
4. Wallet signs transaction
   - User approves in wallet
   - Wallet returns signed transaction

5. Backend executes on Solana
   POST /api/trigger/execute
   { signedTransaction: "base64..." }
   Returns: { signature: "9mK4w..." }

6. Success! Order cancelled
   - Signature saved to order record
   - UI updates to show in History
   - Solscan link becomes available
```

### Why Decoding Can Fail

**Blockhash Expiration**
```
Solana transactions include a recent blockhash.
Blockhash expires after ~60 seconds.
If Jupiter returns old transaction → decode may fail.
Solution: We fetch fresh blockhash and update.
```

**Transaction Version**
```
v0 (versioned) = Modern format, address lookup tables
Legacy = Old format, no lookup tables
Some wallets only support one format.
Solution: We try both formats automatically.
```

**Corrupted Data**
```
Network error during API call
Incomplete base64 string
Invalid transaction structure
Solution: Retry or use Jupiter directly.
```

---

## When to Contact Support

### Include This Information

1. **Transaction Signatures**
   - Copy all available signatures from order card
   - Include create TX at minimum
   - If cancellation partially succeeded, include cancel TX

2. **Error Message**
   - Exact error text from app
   - Screenshot of error if possible
   - Browser console errors (F12 → Console tab)

3. **Order Details**
   - Order ID (if visible)
   - Token pair (e.g., SOL/TOKEN)
   - Order type (buy/sell)
   - Trigger price and amount

4. **Wallet Type**
   - Which wallet you're using (Phantom, Solflare, etc.)
   - Browser (Chrome, Firefox, etc.)
   - Device (Desktop/Mobile)

### Example Support Message
```
Subject: Cannot cancel limit order - decode error

Hi, I'm unable to cancel my limit order:

Order Details:
- Token: BONK
- Type: Buy
- Trigger: $0.000025
- Amount: 1,000,000 BONK

Error: "Failed to decode transaction"

Transaction Signatures:
Create TX: 5wK9m4hJ3qL8nP2rT7vW9xY1zA3bC5dE6fG7hI8jK9lM
(Click to view: https://solscan.io/tx/5wK9m4h...)

Wallet: Phantom (v24.1.0)
Browser: Chrome (v120)
Device: MacOS Desktop

I tried:
1. Refreshing page
2. Reconnecting wallet
3. Clicking cancel 3 times (all failed)

Can you help? Thank you!
```

---

## Alternative: Manual Order Cancellation

### Via Jupiter Interface

If Moonfeed cancellation continues to fail, use Jupiter's official interface:

```
Step 1: Visit Jupiter Limit Orders
   https://limit.jup.ag/

Step 2: Connect Wallet
   - Click "Connect Wallet"
   - Select your wallet
   - Approve connection

Step 3: View Your Orders
   - Look for "My Orders" section
   - Find the order you want to cancel
   - Verify order details match Moonfeed

Step 4: Cancel Order
   - Click "Cancel" button next to order
   - Approve transaction in wallet
   - Wait for confirmation

Step 5: Verify on Solscan
   - Jupiter shows transaction signature
   - Click to view on Solscan
   - Confirm status is "Success"

Step 6: Return to Moonfeed
   - Refresh Moonfeed app
   - Order should now be in History tab
   - Cancel TX signature should appear
```

---

## Summary

**The "Failed to decode transaction" error is rare but recoverable:**

1. ✅ Our app automatically tries both transaction formats
2. ✅ Updates blockhash to prevent expiration issues
3. ✅ Provides fallback instructions (use Jupiter directly)
4. ✅ All transactions visible on Solscan for verification
5. ✅ Clear error messages guide next steps

**If cancellation fails:**
- Check order on Solscan (may already be cancelled)
- Refresh page and try once more
- Use Jupiter.ag/limit as backup method
- Contact support with transaction signatures

**Transaction signatures provide complete transparency:**
- Every order action has an on-chain proof
- Click any Solscan link to verify independently
- Never trust UI alone - blockchain is source of truth

---

**Questions?** All transaction signatures are available in Profile → Limit Orders with direct Solscan links for verification! 🔍
