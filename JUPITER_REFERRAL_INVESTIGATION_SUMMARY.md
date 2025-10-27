# 🔍 Jupiter Referral Investigation Summary

## Executive Summary

After investigating the Jupiter referral integration against their official documentation, **the current implementation is NOT correctly configured** and is likely **NOT collecting referral fees**.

---

## Problem Discovered

### Current Implementation (INCORRECT)

The backend currently uses this approach in `jupiterTriggerService.js`:

```javascript
// ❌ INCORRECT - Deprecated approach
if (REFERRAL_ACCOUNT) {
  payload.referralAccount = REFERRAL_ACCOUNT; // Just a wallet address
  payload.feeBps = FEE_BPS; // Wrong parameter location
}
```

**Issues:**
1. `referralAccount` parameter is not recognized by Trigger API
2. `feeBps` should be inside `params` object, not at root level
3. Missing `feeAccount` parameter (referral token account)
4. Using a wallet address instead of a proper Referral Account PDA

### Required Implementation (CORRECT)

Per [Jupiter's official documentation](https://dev.jup.ag/docs/swap/add-fees-to-swap#for-trigger-api-integrator-fee):

```javascript
// ✅ CORRECT - Current required approach
const payload = {
  maker,
  payer,
  inputMint,
  outputMint,
  params: {
    makingAmount: "...",
    takingAmount: "...",
    feeBps: "100" // INSIDE params object
  },
  feeAccount: referralTokenAccount, // Referral token account PDA
  computeUnitPrice: "auto"
};
```

**Requirements:**
1. Create a **Referral Account** (PDA) via dashboard or SDK
2. Create **Referral Token Accounts** for each token mint
3. Use `feeAccount` parameter with the referral token account
4. Put `feeBps` inside the `params` object

---

## Key Findings

### 1. Referral Account vs Wallet Address

**Current:**
- Using: `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt` (regular wallet)

**Required:**
- Need: A **Referral Account PDA** created via the Referral Program
- This is different from a wallet address
- Must be created through https://referral.jup.ag/dashboard or the SDK

### 2. Referral Token Accounts

**Current:**
- None created

**Required:**
- Must create a referral token account for EVERY token you want to collect fees in
- These are PDAs derived from: `[referral_ata, referralAccount, tokenMint]`
- Each token (SOL, USDC, USDT, etc.) needs its own account
- Created via dashboard or SDK

### 3. API Parameter Format

**Current Format (Wrong):**
```json
{
  "maker": "...",
  "inputMint": "...",
  "outputMint": "...",
  "params": {
    "makingAmount": "1000",
    "takingAmount": "2000"
  },
  "referralAccount": "42Dqm...", // ❌ Not recognized
  "feeBps": 100 // ❌ Wrong location
}
```

**Required Format (Correct):**
```json
{
  "maker": "...",
  "inputMint": "...",
  "outputMint": "...",
  "params": {
    "makingAmount": "1000",
    "takingAmount": "2000",
    "feeBps": "100" // ✅ Inside params
  },
  "feeAccount": "7x3g..." // ✅ Referral token account
}
```

---

## Why the UI Shows 0.1%

This was confusing but is now clear:

**Jupiter's UI displays:**
- Only Jupiter's own platform fee (~0.1-0.2%)
- Does NOT display partner referral fees

**Your referral fee (1%):**
- Is separate and additional
- Goes to your referral token accounts
- Not shown in Jupiter's UI
- Collected automatically when orders execute

**Total fee structure:**
- Jupiter Platform Fee: ~0.1% → Jupiter
- Your Referral Fee: 1.0% → Your referral token accounts
- Total: ~1.1% (user pays this in execution price)

---

## Impact Assessment

### Current Status

**Referral fees are likely NOT being collected** because:

1. ❌ No proper Referral Account created
2. ❌ No referral token accounts exist
3. ❌ API parameters in wrong format
4. ❌ `feeAccount` not provided to API
5. ❌ `feeBps` in wrong location

### After Fix

✅ Referral fees will be collected properly
✅ 1% of every limit order goes to your token accounts
✅ Automatic fee collection when orders execute
✅ Compliant with Jupiter's latest API requirements

---

## Required Actions

### Immediate (Setup)

1. **Create Referral Account**
   - Visit: https://referral.jup.ag/dashboard
   - Connect wallet: `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt`
   - Create new referral account
   - Save the "Referral Key" (PDA)

2. **Create Referral Token Accounts**
   - For common tokens: SOL, USDC, USDT, etc.
   - Via dashboard: Click "Create Token Account"
   - Or use SDK (see implementation guide)

3. **Update Environment Variables**
   ```bash
   # In /backend/.env
   JUPITER_REFERRAL_ACCOUNT=<YOUR_REFERRAL_ACCOUNT_PDA>
   JUPITER_REFERRAL_FEE_BPS=100
   ```

### Code Changes

1. **Install Dependencies**
   ```bash
   cd backend
   npm install @jup-ag/referral-sdk @solana/web3.js @solana/spl-token
   ```

2. **Create Helper Module**
   - New file: `/backend/utils/jupiterReferral.js`
   - Handles referral token account lookup
   - See implementation guide for full code

3. **Update Jupiter Service**
   - File: `/backend/services/jupiterTriggerService.js`
   - Remove `referralAccount` and root-level `feeBps`
   - Add `feeAccount` parameter
   - Move `feeBps` into `params` object
   - See implementation guide for full code

### Testing

1. **Run Integration Test**
   ```bash
   node test-jupiter-referral-integration.js
   ```

2. **Create Test Order**
   - Create a small limit order through the app
   - Check backend logs for referral confirmation
   - Wait for order execution
   - Check referral token accounts for fee deposits

### Monitoring

1. **Check Balances**
   - Via Solscan: `https://solscan.io/account/<REFERRAL_ACCOUNT>`
   - Via script: See monitoring section in guide

2. **Track Revenue**
   - Monitor incoming transactions to referral token accounts
   - Each deposit = 1% of an executed order
   - Balances grow as orders execute

---

## Documentation Created

1. **JUPITER_REFERRAL_FIX.md** (Updated)
   - Added critical update section
   - Explains why current implementation doesn't work
   - Lists required changes

2. **JUPITER_REFERRAL_IMPLEMENTATION_GUIDE.md** (New)
   - Complete step-by-step implementation guide
   - Includes all code examples
   - Testing and monitoring instructions
   - Troubleshooting section

3. **JUPITER_REFERRAL_INVESTIGATION_SUMMARY.md** (This file)
   - Summary of findings
   - Impact assessment
   - Action items

---

## Timeline Estimate

- **Setup (Dashboard)**: 15 minutes
  - Create referral account
  - Create token accounts for top 10 tokens

- **Code Changes**: 2-3 hours
  - Create helper module
  - Update jupiter service
  - Write tests
  - Update documentation

- **Testing**: 1 hour
  - Run integration tests
  - Create test orders
  - Verify fee collection

- **Total**: ~4 hours to fully implement

---

## Revenue Potential

Once properly implemented:

| Daily Limit Order Volume | 1% Referral Fee | Monthly Revenue |
|--------------------------|-----------------|-----------------|
| $10,000                  | $100            | $3,000          |
| $50,000                  | $500            | $15,000         |
| $100,000                 | $1,000          | $30,000         |
| $500,000                 | $5,000          | $150,000        |

**Note**: Current implementation is collecting $0 because it's not configured correctly.

---

## Key Takeaways

1. ✅ **Scroll system is working great** - One swipe = one coin
2. ⚠️ **Referral system needs proper setup** - Not collecting fees yet
3. 📚 **Documentation is clear** - Implementation guide is ready
4. 🚀 **Revenue opportunity** - Once fixed, 1% of all order volume
5. ⏱️ **Quick fix** - Can be implemented in ~4 hours

---

## Next Steps

**Recommended Priority: HIGH**

This is revenue-generating infrastructure that's currently not working. Suggest implementing immediately.

1. Start with dashboard setup (15 min)
2. Update code per implementation guide (2-3 hrs)
3. Test with small orders (1 hr)
4. Deploy and monitor (ongoing)

---

## Resources

- [Jupiter Referral Dashboard](https://referral.jup.ag/dashboard)
- [Jupiter API Documentation](https://dev.jup.ag/docs/swap/add-fees-to-swap#for-trigger-api-integrator-fee)
- [Referral Program Source](https://github.com/TeamRaccoons/referral)
- [Implementation Guide](./JUPITER_REFERRAL_IMPLEMENTATION_GUIDE.md)

---

**Status**: Investigation complete. Implementation guide ready. Awaiting setup and code changes.

**Impact**: Once implemented, the app will properly collect 1% referral fees on all limit order volume. 💰
