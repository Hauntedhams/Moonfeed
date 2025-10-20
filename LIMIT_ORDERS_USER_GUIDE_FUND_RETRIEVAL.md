# 💰 How to Retrieve Funds from Expired Limit Orders - User Guide

## 🎯 Quick Answer

**If your limit order expired, your funds are held in Jupiter's escrow and won't return automatically. You MUST cancel the order to get your money back.**

MoonFeed now provides **two easy ways** to retrieve your funds!

---

## 🔍 How to Find Expired Orders

### Method 1: Active Orders Tab

1. Open your **Profile** (top right corner)
2. Click **"Active Orders"** tab
3. Look for orders with a **red pulsing button** that says:
   ```
   ⚡ CANCEL & RETRIEVE FUNDS
   ```

### Method 2: History Tab

1. Open your **Profile**
2. Click **"History"** tab
3. Look for orders with a **red warning badge**:
   ```
   ⚠️ This order expired - Retrieve your funds now!
   ```

---

## ✅ How to Retrieve Your Funds

You have **TWO options**. Both work equally well!

### 🥇 Option 1: Cancel In-App (Recommended)

**Best for**: Most users, fastest method

**Steps**:
1. Find the expired order (see above)
2. Click the **"💰 Cancel & Retrieve"** button (or large red button in Active tab)
3. Your wallet (Phantom/Solflare) will pop up
4. Click **"Approve"** to sign the transaction
5. Wait a few seconds for confirmation
6. ✅ Done! Your funds are back in your wallet

**What to expect**:
- Button changes to "⏳ Cancelling..." while processing
- You'll see a wallet signature prompt
- Transaction appears on Solana blockchain
- Order disappears from active list
- Order moves to history as "Cancelled"

---

### 🥈 Option 2: Cancel on Jupiter (Fallback)

**Best for**: If in-app cancel doesn't work, or you prefer Jupiter's interface

**Steps**:
1. Find the expired order
2. Click **"Or use Jupiter ↗"** link (or "manage on Jupiter ↗")
3. New tab opens at https://jup.ag/limit/YourWallet
4. You'll see all your limit orders on Jupiter
5. Find the expired order
6. Click **"Cancel Order"** on Jupiter
7. Approve in your wallet
8. ✅ Done! Funds back in wallet

**What to expect**:
- Opens Jupiter's official limit order page
- Your wallet address is pre-filled
- Same cancellation process, different UI
- Can manage all Jupiter orders in one place

---

## 🎨 What You'll See

### Active Orders Tab (Expired Order)

```
┌───────────────────────────────┐
│  Token: MEME                  │
│  Trigger: $0.0025            │
│  ⚠️ EXPIRED                   │
│                                │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃ ⚡ CANCEL & RETRIEVE   ┃  │
│  ┃    FUNDS              ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━┛  │
│  (Red, pulsing button)        │
│                                │
│  Click to return funds from   │
│  escrow                       │
│                                │
│  or manage on Jupiter ↗       │
└───────────────────────────────┘
```

### History Tab (Expired Order)

```
┌────────────────────────────────┐
│  ╔══════════════════════════╗ │
│  ║ ⚠️ This order expired -   ║ │
│  ║ Retrieve your funds now! ║ │
│  ║                           ║ │
│  ║ Your funds are held in   ║ │
│  ║ Jupiter's escrow. You    ║ │
│  ║ must cancel to get them  ║ │
│  ║ back.                    ║ │
│  ║                           ║ │
│  ║ [💰 Cancel] [Jupiter ↗] ║ │
│  ╚══════════════════════════╝ │
│                                 │
│  Trigger Price: $0.0025        │
│  Amount: 1000 MEME             │
│  Created: Jan 15, 2024         │
└────────────────────────────────┘
```

---

## ❓ Common Questions

### Q: Why didn't my order execute automatically?

**A**: Your order expired before the market price reached your trigger price. Limit orders have expiration dates to prevent indefinite escrow locking.

---

### Q: Where are my funds right now?

**A**: Your funds are safely held in **Jupiter's escrow** (a secure smart contract on Solana). They can only be retrieved by you, but you must actively cancel the order.

---

### Q: Will my funds return automatically?

**A**: No. You **must manually cancel** the expired order to get your funds back. This is how Solana limit orders work - cancellation is required.

---

### Q: Which method should I use?

**A**: 
- **In-app cancel** (💰 Cancel & Retrieve): Faster, stays in MoonFeed
- **Jupiter link**: Useful if in-app fails, or if you have multiple Jupiter orders to manage

Both methods are equally safe and reliable!

---

### Q: What if the cancel button doesn't work?

**A**: 
1. Check your wallet is connected
2. Make sure you have enough SOL for transaction fees (~0.001 SOL)
3. Try the **Jupiter link** as a backup
4. Contact support if both methods fail

---

### Q: How long does cancellation take?

**A**: Usually **5-10 seconds**. Steps:
1. Click button (instant)
2. Sign transaction (you control timing)
3. Blockchain confirmation (3-5 seconds)
4. Funds in wallet (instant after confirmation)

---

### Q: Will I lose money on fees?

**A**: You'll pay a small Solana transaction fee (~$0.001-0.01). Your original funds return in full.

---

### Q: Can I cancel an order that's NOT expired?

**A**: Yes! Active orders can also be cancelled anytime using the same buttons.

---

### Q: What happens after I cancel?

**A**: 
1. Order disappears from "Active Orders"
2. Order appears in "History" as "Cancelled"
3. Transaction signature stored (viewable on Solscan)
4. Funds immediately available in your wallet

---

## 🚨 Important Notes

### ⚠️ Action Required
Expired orders **will not** automatically return funds. You must cancel them manually.

### 🔒 Security
- Your funds are safe in Jupiter's escrow
- Only YOU can cancel (with your wallet signature)
- No one else can access your funds
- Escrow is audited and battle-tested

### 💸 Transaction Fees
- Cancellation requires a small SOL fee
- Usually ~0.001 SOL (~$0.10)
- Make sure you have SOL in your wallet

### ⏱️ No Rush
- Funds stay in escrow indefinitely
- No penalty for delayed cancellation
- Cancel whenever convenient

---

## 📊 Step-by-Step Flowchart

```
START: You have an expired limit order
    ↓
Open MoonFeed Profile
    ↓
Go to "Active Orders" or "History" tab
    ↓
Find the order with red warning/button
    ↓
CHOOSE YOUR METHOD:
    ↓                          ↓
In-App Cancel           Jupiter Link
    ↓                          ↓
Click "💰 Cancel"      Click "Jupiter ↗"
    ↓                          ↓
Wallet prompts         Opens Jupiter site
    ↓                          ↓
Click "Approve"         Find order
    ↓                          ↓
Wait 5-10 sec           Click "Cancel"
    ↓                          ↓
✅ FUNDS RETURNED      ✅ FUNDS RETURNED
    ↓
Order marked "Cancelled"
    ↓
END: Funds in your wallet!
```

---

## 🎓 Educational: Why Escrow?

**What is escrow?**
A secure holding account that locks your funds until the order executes or you cancel.

**Why use it?**
- **Security**: Funds can't be stolen
- **Atomicity**: Order executes only if conditions met
- **Decentralization**: No central party holds funds

**Who controls it?**
Jupiter's smart contract (audited, open-source)

**How do I get funds back?**
Cancel the order → Escrow releases funds → Back in your wallet

---

## 💡 Pro Tips

### Tip 1: Check Before Expiry
Set reminders to check orders before they expire. Extend if needed!

### Tip 2: Use Perpetual Orders
If you don't mind indefinite waiting, create orders with no expiration.

### Tip 3: Monitor Price Alerts
Enable MoonFeed notifications to know when prices approach your trigger.

### Tip 4: Have SOL Ready
Always keep ~0.01 SOL in wallet for transaction fees.

### Tip 5: Bookmark Jupiter
Save https://jup.ag/limit/YourWallet for quick access.

---

## 🆘 Need Help?

### Self-Help
1. Check wallet connection (top right)
2. Verify SOL balance for fees
3. Try alternate method (in-app ↔ Jupiter)
4. Check Solana network status

### Contact Support
If both methods fail:
- Discord: [Your server]
- Email: support@moonfeed.app
- Twitter: @MoonFeedApp

---

## ✅ Success Checklist

After cancelling, verify:
- [ ] Order disappeared from "Active Orders"
- [ ] Order appears in "History" as "Cancelled"
- [ ] Transaction signature visible (click to view on Solscan)
- [ ] Funds visible in wallet
- [ ] Correct token amount received

---

## 🎉 You're All Set!

Your expired limit orders can now be easily cancelled with:

✅ **Clear visual warnings** (you won't miss them)  
✅ **Two reliable methods** (in-app + Jupiter)  
✅ **Simple process** (2-3 clicks)  
✅ **Fast retrieval** (5-10 seconds)  
✅ **Safe & secure** (audited escrow)  

**Happy trading!** 🚀

---

**Last Updated**: January 2024  
**App Version**: MoonFeed Alpha  
**Feature**: Enhanced Fund Retrieval UX
