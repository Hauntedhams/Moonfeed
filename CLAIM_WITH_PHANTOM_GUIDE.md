# How to Claim Your 0.029 SOL with Phantom Wallet

## Your Setup Understanding

**Your Phantom Wallet**: `GwW5v8ArhtE9DbT6HDC7ow7ZE8rmkyTPacb8ci2ENHQH`
- This is the **partner wallet**
- You control the referral account with this wallet

**Referral Account**: `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt`
- Created through Jupiter Referral Dashboard
- Controlled by your Phantom wallet above
- Has 0.029 SOL in fees waiting

---

## 🎯 How to Claim (Easiest Method)

### Step 1: Complete Token Account Setup

You're on the "Create Token Accounts" page. You need to:

1. **Select SOL** from the left list (since you have SOL fees)
2. Click "Create" or "Add" button
3. **Phantom will pop up** asking you to sign
4. Click "Approve" in Phantom
5. Wait for confirmation

Do this for any other tokens you want to earn fees in (USDC, USDT, etc.)

---

### Step 2: Navigate to Claim/Withdraw Section

After creating token accounts, look for:

**Possible tab names:**
- "Withdraw"
- "Claim"
- "My Earnings"
- "Dashboard"

**Or look for:**
- A hamburger menu (≡) in the top left
- Tabs at the top of the page
- A sidebar navigation

**Navigate around the Jupiter Referral site** until you find where you can claim/withdraw fees.

---

### Step 3: Claim with Phantom

Once you find the claim section:

1. Make sure Phantom is connected (should show `GwW5...NHQH` in top right)
2. Find your "MoonFeed" referral account
3. Click "Claim" or "Withdraw" for SOL
4. **Phantom will pop up asking to sign the transaction**
5. Click "Approve"
6. Wait for confirmation

**Fees will go to your Phantom wallet** `GwW5...NHQH` ✅

---

## 🔧 Alternative: Use Our Script (If Dashboard Doesn't Work)

Since you have the Phantom wallet that controls the referral account, you can use our script:

### Step 1: Export Private Key from Phantom

**⚠️ Important: This is YOUR wallet, you already have full access to it!**

1. Open Phantom
2. Click Settings (gear icon)
3. Click "Show Secret Recovery Phrase" or "Export Private Key"
4. **Choose "Show Private Key"** (NOT the seed phrase)
5. Enter your Phantom password
6. **Copy the private key** (array format: `[123,45,67,...]`)

---

### Step 2: Create `.env.referral` File

In your project, create `.env.referral`:

```bash
# This is YOUR Phantom wallet's private key
ULTRA_WALLET_PRIVATE_KEY=[paste_private_key_array_here]
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

**Security:**
- This file stays on YOUR computer only
- Never commit to git (already in .gitignore)
- Never share with anyone
- This is the same key Phantom uses - you're just exporting it

---

### Step 3: Run Claim Script

```bash
node withdraw-referral-fees.js
```

**What happens:**
```
🚀 Jupiter Referral Fee Claim Tool (Using Official SDK)

✅ Wallet loaded: GwW5...NHQH  ← Your Phantom wallet
📍 Referral Account: 42Dq...hUPt
💰 Wallet SOL Balance: X.XXXX SOL

🔍 Scanning for all tokens with fees...
📦 Found 1 token(s) with fees to claim

📤 Claiming token 1/1...
✅ Claim successful!
🔗 Signature: abc123...

============================================================
📊 CLAIM SUMMARY
============================================================
✅ Successful claims: 1

✨ Done!
```

**The claimed SOL will appear in your Phantom wallet!** 💰

---

## 🤔 Where Do Claimed Fees Go?

**Fees get claimed TO your partner wallet** (the one that created the referral account):

```
Before Claiming:
  Referral Account (42Dq...hUPt)
    └─ SOL Token Account: 0.029 SOL

After Claiming:
  Your Phantom Wallet (GwW5...NHQH)
    └─ Balance increases by ~0.022 SOL (after split)
  
  Jupiter Project Admin
    └─ Gets ~0.007 SOL (their share)
```

**You check your Phantom wallet balance** - the SOL will be there!

---

## 📊 Fee Split

Jupiter referral fees are split:
- **Your share**: ~75% (depends on your referral agreement)
- **Jupiter's share**: ~25%

From 0.029 SOL:
- You get: ~0.022 SOL → Your Phantom wallet ✅
- Jupiter gets: ~0.007 SOL → Jupiter project

---

## 🎯 Recommended Steps RIGHT NOW

### Option A: Dashboard Method (Try First)
1. On the page you showed, **create SOL token account**
2. Look for navigation to "Withdraw" or "Claim" section
3. Click claim with Phantom connected
4. Approve in Phantom popup

### Option B: Script Method (If Dashboard Fails)
1. Export private key from Phantom
2. Put in `.env.referral`
3. Run `node withdraw-referral-fees.js`
4. Check your Phantom wallet balance

---

## ✅ Quick Checklist

- [ ] Phantom wallet `GwW5...NHQH` is connected to Jupiter Referral Dashboard
- [ ] Create SOL token account on the "Create Token Accounts" page
- [ ] Find and navigate to "Claim" or "Withdraw" section
- [ ] Claim fees (Phantom will sign)
- [ ] OR export Phantom private key and use script
- [ ] Check Phantom wallet balance to see claimed SOL

---

## 🚨 Important Notes

1. **The fees go to your PHANTOM wallet** (`GwW5...NHQH`), not the referral account
2. **The referral account** (`42Dq...hUPt`) is just for collecting fees
3. **You already have full control** via your Phantom wallet
4. **No one else can claim your fees** - only you with Phantom

---

## 📞 If You're Still Stuck

**Can you:**
1. Take a screenshot of the full Jupiter Referral Dashboard page?
2. Show me if there are any tabs/navigation options?
3. Tell me what happens when you click on "SOL" in the left list?

This will help me guide you to the exact claim button! 🎯

---

**The good news**: You have the Phantom wallet, so you have full control. You just need to find the right button or use the script! 💪
