# How to View Transaction Signatures in Moonfeed

## Quick Guide: Finding Your Order Transactions 🔍

All your limit order transactions are now fully visible with direct Solscan links for blockchain verification.

---

## Active Orders

### Where to Look
1. Open **Profile** page
2. Select **Active** orders tab
3. Look for order card details

### What You'll See

```
┌─────────────────────────────────────────┐
│  TOKEN  🟢 Buy           Active          │
├─────────────────────────────────────────┤
│                                         │
│  Current Price      →      Trigger      │
│    $0.0045                  $0.0040     │
│                                         │
│  💰 Amount       ⏱️ Created             │
│    1,000 TOKEN      2h 15m ago          │
│                                         │
│  ⏰ Expires In   💵 Est. Value          │
│    22h 45m          0.5000 SOL          │
│                                         │
│  📅 Created on Dec 18, 2:30 PM          │
│  🔑 Order ID: 3xB7c...9kF2pL             │
│  📝 Create TX: 5wK9m...7hP3q ↗  ← CLICK │
│  🔄 Update TX: 8nL2p...4jM9r ↗  ← CLICK │
│                                         │
│       [🗑️ Cancel Order]                 │
└─────────────────────────────────────────┘
```

### Transaction Links
- **📝 Create TX** - Click to view order creation on Solscan
- **🔄 Update TX** - Click to view order modifications (if any)

---

## Historical Orders

### Where to Look
1. Open **Profile** page
2. Select **History** tab
3. View cancelled or executed orders

### What You'll See

```
┌─────────────────────────────────────────┐
│  TOKEN  🔴 Sell        Cancelled         │
├─────────────────────────────────────────┤
│  Trigger Price: $0.0125                 │
│  Amount: 500.00 TOKEN                   │
│  Created: Dec 17, 10:15 AM              │
│                                         │
│  ✓ Cancelled: View TX ↗  ← CLICK       │
│                                         │
│  Transaction History:                   │
│  Create: 2xA8n...5kQ1m ↗  ← CLICK       │
│  Cancel: 7jP3r...9nM2w ↗  ← CLICK       │
└─────────────────────────────────────────┘
```

### For Executed Orders

```
┌─────────────────────────────────────────┐
│  TOKEN  🟢 Buy         Executed          │
├─────────────────────────────────────────┤
│  Trigger Price: $0.0040                 │
│  Amount: 1,000.00 TOKEN                 │
│  Created: Dec 18, 2:30 PM               │
│                                         │
│  ✓ Executed: Dec 18, 4:45 PM            │
│                                         │
│  Transaction History:                   │
│  Create: 3xB7c...9kF2p ↗  ← CLICK       │
│  Execute: 9mK4w...2hL8q ↗  ← CLICK      │
└─────────────────────────────────────────┘
```

---

## What Each Transaction Type Means

### 📝 Create Transaction
- **What it is**: Your order being submitted to Jupiter
- **What to check**: Order details, SOL escrow, timestamp
- **Common use**: Verify order exists on-chain

### 🔄 Update Transaction  
- **What it is**: Modifications to your existing order
- **What to check**: New trigger price, new amounts
- **Common use**: Confirm order parameter changes

### ✓ Cancel Transaction
- **What it is**: Order removal from Jupiter
- **What to check**: SOL return, cancellation success
- **Common use**: Verify stuck order is actually cancelled

### Execute Transaction
- **What it is**: Order automatically filled when price hit
- **What to check**: Token swap details, execution price
- **Common use**: Confirm tokens received and price paid

---

## How to Use Solscan Links

### Step-by-Step
1. **Click any transaction link** (e.g., "Create TX: 5wK9m...7hP3q ↗")
2. **Solscan opens in new tab** showing full transaction details
3. **Verify transaction info**:
   - ✅ Status: Success/Failed
   - 💰 SOL and token transfers
   - ⏱️ Block time and confirmations
   - 📋 Program instructions

### What You'll See on Solscan

```
┌────────────────────────────────────────────┐
│ Solscan - Transaction Details              │
├────────────────────────────────────────────┤
│ Status: ✅ Success                         │
│ Block: 251,234,567                         │
│ Timestamp: Dec 18, 2025 2:30:15 PM        │
│                                            │
│ SOL Changes:                               │
│   Your Wallet: -0.5000 SOL (order escrow) │
│                                            │
│ Token Changes:                             │
│   None (escrow locked)                     │
│                                            │
│ Fee: 0.000005 SOL                          │
│                                            │
│ Instructions:                              │
│   1. Jupiter Limit Order: Create          │
│   2. System Program: Transfer             │
└────────────────────────────────────────────┘
```

---

## Common Troubleshooting Scenarios

### ❓ "My order shows active but I don't see it in my wallet"
**Solution**: Click **Create TX** to verify on Solscan
- ✅ If transaction is successful → Order is on-chain (normal)
- ❌ If transaction failed → Order didn't submit (contact support)

### ❓ "I cancelled an order but it still appears"
**Solution**: Click **Cancel TX** to verify cancellation
- ✅ If cancellation successful → Refresh page to clear from UI
- ❌ If cancellation failed → Try cancelling again or use Jupiter.ag directly

### ❓ "Order executed but I didn't receive tokens"
**Solution**: Click **Execute TX** to see token transfers
- Check "Token Changes" section for your wallet
- Verify token mint address matches expected token
- Check for any warnings or errors in transaction

### ❓ "Transaction link doesn't work"
**Possible reasons**:
- Transaction still pending (wait 30-60 seconds)
- Network congestion (try again in a minute)
- Invalid signature (rare - contact support)

---

## Mobile View

### On Mobile Devices
- All transaction links work the same way
- May open Solscan in mobile browser or in-app browser
- Tap any "↗" arrow to view full transaction details
- Use browser "back" button to return to Moonfeed

### Mobile Layout

```
┌───────────────────────┐
│ TOKEN   Active        │
├───────────────────────┤
│ Current: $0.0045      │
│ Trigger: $0.0040      │
│                       │
│ 💰 1,000 TOKEN        │
│ ⏱️ 2h 15m ago         │
│                       │
│ 📝 Create TX ↗        │
│ 🔄 Update TX ↗        │
│                       │
│ [Cancel Order]        │
└───────────────────────┘
```

---

## Privacy & Security

### What Solscan Shows
- ✅ **Public blockchain data** (transaction details, amounts, addresses)
- ✅ **Open to everyone** (anyone with signature can view)
- ❌ **NOT your private keys** (read-only view)
- ❌ **NOT your wallet balance** (unless you look up your address separately)

### Security Notes
- Transaction links use `noopener noreferrer` for security
- Links always open in new tab (your Moonfeed session stays safe)
- Solscan is a trusted Solana blockchain explorer
- No need to connect wallet on Solscan (view only)

---

## Tips & Best Practices

### ✅ Do This
- ✓ Verify all order creations on Solscan
- ✓ Save important transaction signatures
- ✓ Check execution transactions to confirm prices
- ✓ Use Solscan to debug stuck orders

### ❌ Avoid This
- ✗ Don't trust UI alone - always verify on-chain
- ✗ Don't share transaction signatures as "proof of payment" (they're public anyway)
- ✗ Don't panic if Solscan shows "Processing" - wait for confirmation

---

## Need More Help?

### Transaction Failed?
1. Click the transaction link
2. Read error message on Solscan
3. Check "Logs" tab for detailed errors
4. Contact support with transaction signature

### Order Issues?
- Include transaction signatures when reporting bugs
- Screenshots helpful but Solscan link is better
- Check Jupiter.ag/limit to see if order appears there

### General Questions?
- All transactions are on public Solana blockchain
- Moonfeed UI is a frontend to Jupiter Limit Orders
- Your wallet controls all funds (Moonfeed never holds assets)

---

## Summary

**Every limit order transaction is now fully transparent with one-click Solscan verification.** 

- 📝 **Create** - Verify order submission
- 🔄 **Update** - Check modifications  
- ✓ **Cancel** - Confirm cancellation
- **Execute** - Review trade execution

**All signatures are always available in your Profile → Limit Orders section.**

---

**Questions?** Click any transaction link and explore Solscan to see the full blockchain details!
