# Jupiter Referral System - Complete Guide

## 🎉 UPDATE: Official Claim Methods Available!

**Good news!** The Jupiter Referral SDK **does provide** official claim instructions. You don't need to use manual SPL token transfers!

### Official SDK Claim Methods:

```javascript
// Claim all tokens at once (recommended)
const claimTxs = await referralProvider.claimAllV2({
  payerPubKey: wallet.publicKey,
  referralAccountPubKey: referralAccount
});

// Claim specific token
const claimTx = await referralProvider.claimV2({
  payerPubKey: wallet.publicKey,
  referralAccountPubKey: referralAccount,
  mint: tokenMint
});
```

**See [JUPITER_REFERRAL_CLAIM_SDK.md](./JUPITER_REFERRAL_CLAIM_SDK.md) for full details.**

---

## 🎯 Quick Start

Your Jupiter referral system is **fully implemented and ready to use**. This guide explains how to claim your earnings.

## 📊 Current Status

- ✅ Referral system integrated into your app
- ✅ SDK and backend services configured
- ✅ Withdrawal script ready to use
- 🟡 Dashboard may have redirect issues (use SDK instead)

## 💰 How to Withdraw Your Fees

### Option 1: SDK Withdrawal (Recommended by Jupiter Support)

This is the **most reliable method** and bypasses any dashboard issues.

**Steps:**

1. **Set up your private key:**
   ```bash
   # Copy the example file
   cp .env.referral.example .env.referral
   
   # Edit .env.referral and add your private key
   nano .env.referral
   ```

2. **Run the withdrawal script:**
   ```bash
   node withdraw-referral-fees.js
   ```

3. **Confirm the withdrawal:**
   The script will show you:
   - All tokens with referral fees
   - Balance for each token
   - Estimated USD value
   - Ask for confirmation before withdrawing

**Full instructions:** See `WITHDRAW_REFERRAL_FEES_GUIDE.md`

### Option 2: Jupiter Dashboard (May Have Issues)

Visit: https://referral.jup.ag/dashboard

⚠️ **Known Issue:** Dashboard may redirect to account creation instead of showing existing account. If this happens, use Option 1 instead.

## 🔍 Check Your Referral Status

### Via API (Shows Referral Fee Accounts)

```bash
# Check if referral token accounts exist
curl http://localhost:3001/api/referral/check-account

# Check USDC referral fee balance
curl "http://localhost:3001/api/referral/balance?token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Get referral link
curl http://localhost:3001/api/referral/link
```

### Via Test Script

```bash
node test-referral-system.js
```

## 💡 Understanding Your Balances

### Personal Wallet Balance
- Your main wallet: `42DqmQMZrVeZkP2B1j2cS96ES81jYxFqwUzVhUPt`
- Contains your personal tokens (USDC, SOL, etc.)
- Check at: https://solscan.io/account/42DqmQMZrVeZkP2B1j2cS96ES81jYxFqwUzVhUPt

### Referral Fee Token Accounts
- **Separate accounts** for each token (USDC, SOL, etc.)
- Auto-created on first swap through your referral
- Accumulate fees from swaps made in your app
- **Different addresses** from your main wallet

**Example:**
- Your wallet: `42DqmQ...hUPt` has 100 USDC (personal funds)
- Your USDC referral account: `7xKXtg...example` has 5 USDC (referral fees)
- These are **separate** and both belong to you

## 🚀 How Referral Fees Work

1. **User opens your app** → Jupiter swap interface loads with your referral config
2. **User makes a swap** → Jupiter:
   - Executes the swap
   - Creates referral fee token accounts (if first time)
   - Sends referral fees to those accounts
3. **Fees accumulate** → Each swap adds more fees to your token accounts
4. **You withdraw** → Use the SDK script to move fees to your main wallet

## 📈 Maximizing Your Earnings

### Drive Traffic to Your App
- Share your app with users
- All swaps through your app earn referral fees
- No special links needed - just use your app

### Monitor Your Earnings
```bash
# Run this regularly to check balances
node withdraw-referral-fees.js
```

### Withdraw Regularly
- Fees stay in token accounts until you withdraw
- No minimum withdrawal amount
- Each withdrawal costs a small transaction fee (~0.00001 SOL)

## 🔧 Troubleshooting

### "Account does not exist" or "Balance: 0"
✅ **This is normal before first swap!**
- Token accounts are created on FIRST swap through your referral
- No swaps = no accounts = no balance yet
- Solution: Get users to make swaps through your app

### "Dashboard redirects to create account"
✅ **Use the SDK script instead**
- This is a known dashboard issue
- The SDK method (Option 1) is more reliable
- Recommended by Jupiter support team

### "Private key error"
❌ **Check your .env.referral file**
- Make sure you're using the correct wallet's private key
- Format: base58 string or JSON array
- Should be for wallet: `42DqmQ...hUPt`

### "Low SOL balance"
❌ **Need SOL for transaction fees**
- Keep ~0.01 SOL in your wallet for fees
- Each withdrawal costs a small amount
- Add more SOL if needed

## 📝 Files Reference

| File | Purpose |
|------|---------|
| `withdraw-referral-fees.js` | SDK script to claim fees |
| `.env.referral.example` | Template for private key config |
| `WITHDRAW_REFERRAL_FEES_GUIDE.md` | Detailed withdrawal instructions |
| `test-referral-system.js` | Test your referral setup |
| `JUPITER_REFERRAL_IMPLEMENTED.md` | Technical implementation details |
| `REFERRAL_SYSTEM_COMPLETE.md` | System architecture |

## 🎓 Next Steps

1. ✅ Create `.env.referral` with your private key
2. ✅ Test the withdrawal script: `node withdraw-referral-fees.js`
3. ✅ Drive traffic to your app to generate swaps
4. ✅ Check balances regularly and withdraw when ready

## 🆘 Still Need Help?

**Check console output** - Error messages are detailed and helpful

**Review documentation:**
- `WITHDRAW_REFERRAL_FEES_GUIDE.md` - Step-by-step withdrawal guide
- `JUPITER_REFERRAL_QUICKSTART.md` - Quick reference
- `REFERRAL_FLOW_DIAGRAM.txt` - Visual flow of the system

**Common misconceptions:**
- ❌ "My wallet shows X USDC but API shows 0" → API shows referral fees, not personal balance
- ❌ "Fees should be in my main wallet" → They're in separate token accounts until withdrawn
- ❌ "Dashboard should show my balance" → Dashboard may have issues, use SDK instead

---

## ✅ Your System Is Ready!

Everything is configured correctly. The next step is to:
1. Make sure swaps happen through your app
2. Use the SDK script to withdraw fees when they accumulate
3. Enjoy your referral earnings! 🎉
