# 🚀 Quick Start: Getting Money from Your Referral Account

## Current Status
✅ Your app is configured to collect referral fees  
✅ Backend is serving the referral config  
✅ Frontend includes referral account in swaps  
⏳ **Waiting for users to perform swaps**

---

## The Complete Process

### 📍 **You Are Here:** Step 0 - Setup (One Time Only)

Create a `.env.referral` file with your wallet's private key:

```bash
# In your project root, create .env.referral
echo 'ULTRA_WALLET_PRIVATE_KEY=[your_private_key_array_here]' > .env.referral
```

**Important**: This should be the private key for wallet `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt`

**Format options**:
```bash
# Array format (preferred):
ULTRA_WALLET_PRIVATE_KEY=[123,45,67,89,...]

# Or base58 format:
ULTRA_WALLET_PRIVATE_KEY=your_base58_private_key_here
```

---

### 🎮 **Step 1:** Users Swap Through Your App

**What happens:**
1. User opens your app
2. User clicks trade/swap button
3. Jupiter Terminal opens with your referral config
4. User completes a swap
5. **🎉 Fees are collected automatically!**

**Where fees go:**
- Fees accumulate in **referral token accounts**
- Each token (USDC, SOL, BONK) has its own account
- These are separate from your main wallet balance

**Example:**
```
User swaps 1000 USDC → BONK
Your referral fee: 10 USDC (1%)
Location: Referral Token Account for USDC
NOT in your main wallet yet!
```

---

### 🔍 **Step 2:** Check Your Accumulated Fees

Run this command anytime to see your fees:

```bash
node test-referral-system.js
```

**What you'll see:**
```
🪐 Jupiter Referral System Test

📋 Referral Configuration:
   Referral Account: 42DqmQ...hUPt
   Fee Rate: 100 BPS (1%)

🔍 Checking referral account status...
   ✅ Account exists

📊 Token Account Status:
   USDC (EPjFW...): ✅ Exists - Balance: 50.00 USDC
   SOL (So111...): ✅ Exists - Balance: 2.50 SOL
   BONK (DezXA...): ✅ Exists - Balance: 1000000 BONK

💡 You have fees to claim!
```

**If no fees yet:**
```
📊 Token Account Status:
   USDC: ❌ Account not created yet (no swaps)
   SOL: ❌ Account not created yet (no swaps)

💡 No fees accumulated yet. Wait for swaps to occur!
```

---

### 💰 **Step 3:** Claim Your Fees

When you see fees in Step 2, claim them:

```bash
# Claim ALL tokens (recommended)
node withdraw-referral-fees.js
```

**What happens:**
```
🚀 Jupiter Referral Fee Claim Tool (Using Official SDK)

✅ Wallet loaded: 42DqmQ...hUPt
📍 Referral Account: 42DqmQ...hUPt
💰 Wallet SOL Balance: 0.5000 SOL
✅ Sufficient SOL for transaction fees

🌟 Mode: Claim ALL tokens (default)

🔍 Scanning for all tokens with fees...
📦 Found 3 token(s) with fees to claim

📤 Claiming token 1/3...
✅ Claim successful!
🔗 Signature: abc123def456...
🌐 Explorer: https://solscan.io/tx/abc123def456

📤 Claiming token 2/3...
✅ Claim successful!
🔗 Signature: ghi789jkl012...

📤 Claiming token 3/3...
✅ Claim successful!
🔗 Signature: mno345pqr678...

============================================================
📊 CLAIM SUMMARY
============================================================
✅ Successful claims: 3
❌ Failed claims: 0

✨ Done!
```

**What gets transferred:**
- Your share (e.g., 75%) → **Your main wallet** ✅
- Project share (e.g., 25%) → Jupiter project
- You can now spend/withdraw from your main wallet!

---

## 🎯 Quick Commands Reference

```bash
# Check if you have fees to claim
node test-referral-system.js

# Claim all fees (when available)
node withdraw-referral-fees.js

# Claim specific token only
node withdraw-referral-fees.js --token USDC

# Check your wallet balance on Solscan
open https://solscan.io/account/42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt
```

---

## ❓ Common Questions

### **Q: When will I get fees?**
A: As soon as users perform swaps through your Jupiter integration in your app.

### **Q: Where do fees go first?**
A: They go to referral token accounts (one per token type), not your main wallet yet.

### **Q: How do I get fees into my wallet?**
A: Run `node withdraw-referral-fees.js` - this claims them from token accounts → your wallet.

### **Q: Do I get 100% of the fees?**
A: No, fees are split between you and Jupiter project (based on `shareBps` config).

### **Q: How often should I claim?**
A: Whenever you want! Daily, weekly, monthly - it's up to you.

### **Q: Can I see fees accumulating in real-time?**
A: Run `node test-referral-system.js` anytime to see current balances.

### **Q: What if no swaps have happened yet?**
A: You'll see "No tokens with fees found" - just wait for users to swap!

### **Q: Do I need SOL to claim?**
A: Yes, you need ~0.01 SOL in your wallet for transaction fees.

---

## 🔄 The Cycle

```
Users Swap → Fees Accumulate → You Check → You Claim → Repeat!
    ↓              ↓               ↓            ↓
  (Auto)       (Auto)      (test script)  (claim script)
```

---

## 🚨 Troubleshooting

### "Private key not found"
```bash
# Create .env.referral file
echo 'ULTRA_WALLET_PRIVATE_KEY=your_key_here' > .env.referral
```

### "No tokens with fees found"
- No swaps have occurred yet through your app
- Wait for users to swap
- Check that your app is using the Jupiter integration

### "Low SOL balance"
- Add at least 0.01 SOL to your wallet for transaction fees
- Your wallet: `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt`

### "Claim failed"
- Network congestion - try again
- Check wallet has sufficient SOL
- Verify private key is correct

---

## 📚 More Help

- **Full Guide**: `JUPITER_REFERRAL_COMPLETE_GUIDE.md`
- **SDK Details**: `JUPITER_REFERRAL_CLAIM_SDK.md`
- **Quick Ref**: `JUPITER_REFERRAL_QUICK_REF.md`
- **All Docs**: `JUPITER_REFERRAL_INDEX.md`

---

## ✅ Next Steps

1. ✅ Create `.env.referral` with your private key (if you haven't)
2. ✅ Make sure you have ~0.01 SOL in your wallet
3. ⏳ Wait for users to swap through your app
4. 🔍 Check fees: `node test-referral-system.js`
5. 💰 Claim fees: `node withdraw-referral-fees.js`
6. 🎉 Check your wallet - money is there!

---

**You're all set!** The system is ready. Now you just need users to perform swaps through your app. 🚀
