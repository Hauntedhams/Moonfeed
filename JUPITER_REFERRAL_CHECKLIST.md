# ✅ Jupiter Referral Fix Checklist

## Quick Status Check

**Current State**: ❌ NOT collecting referral fees
**Target State**: ✅ Collecting 1% on all limit orders
**Time Required**: ~4 hours
**Priority**: HIGH (Revenue-generating feature)

---

## Phase 1: Dashboard Setup (15 min)

### Step 1: Create Referral Account
- [ ] Visit https://referral.jup.ag/dashboard
- [ ] Connect wallet: `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt`
- [ ] Click "Create New Referral Account"
- [ ] Save the "Referral Key" (Your referral account PDA)
- [ ] Write down the PDA: `_________________________________`

### Step 2: Create Referral Token Accounts
Create token accounts for these common mints:
- [ ] SOL: `So11111111111111111111111111111111111111112`
- [ ] USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- [ ] USDT: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- [ ] (Add more as needed via dashboard)

---

## Phase 2: Environment Setup (5 min)

### Update `/backend/.env`
```bash
# Replace this line
JUPITER_REFERRAL_ACCOUNT=42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt

# With this (use your PDA from dashboard)
JUPITER_REFERRAL_ACCOUNT=<YOUR_REFERRAL_ACCOUNT_PDA_FROM_DASHBOARD>
JUPITER_REFERRAL_FEE_BPS=100
JUPITER_ADMIN_WALLET=42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt
```

- [ ] Updated `JUPITER_REFERRAL_ACCOUNT` with PDA
- [ ] Verified `JUPITER_REFERRAL_FEE_BPS=100`
- [ ] Added `JUPITER_ADMIN_WALLET`

---

## Phase 3: Install Dependencies (2 min)

```bash
cd backend
npm install @jup-ag/referral-sdk @solana/web3.js @solana/spl-token
```

- [ ] Dependencies installed
- [ ] No errors in installation

---

## Phase 4: Create Helper Module (30 min)

### Create `/backend/utils/jupiterReferral.js`

- [ ] Created new file
- [ ] Copied code from implementation guide
- [ ] Verified all imports are correct
- [ ] File saved

**Key functions to include:**
- `getReferralTokenAccount(mintAddress)`
- `initializeReferralTokenAccount(mintAddress, payerKeypair)`
- `referralTokenAccountExists(mintAddress)`

---

## Phase 5: Update Jupiter Service (1 hour)

### Modify `/backend/services/jupiterTriggerService.js`

- [ ] Added import: `const { getReferralTokenAccount } = require('../utils/jupiterReferral');`
- [ ] Removed old referral code (lines ~122-126)
- [ ] Added new referral integration code in `createOrder` function
- [ ] Moved `feeBps` inside `params` object
- [ ] Added `feeAccount` parameter to payload
- [ ] Updated console logs for better debugging
- [ ] Saved file

**Before (Remove this):**
```javascript
// Lines ~122-126
if (REFERRAL_ACCOUNT) {
  payload.referralAccount = REFERRAL_ACCOUNT;
  payload.feeBps = FEE_BPS;
  console.log(`[Jupiter Trigger] Using referral account: ${REFERRAL_ACCOUNT} with ${FEE_BPS} BPS`);
}
```

**After (Add this):**
```javascript
// Referral fee integration
if (REFERRAL_ACCOUNT) {
  try {
    const feeMint = outputMint; // or inputMint for ExactOut
    const feeAccount = await getReferralTokenAccount(feeMint);
    
    if (feeAccount) {
      payload.feeAccount = feeAccount;
      payload.params.feeBps = FEE_BPS.toString();
      
      console.log(`[Jupiter Trigger] ✅ Referral fee enabled:`);
      console.log(`  - Fee: ${FEE_BPS} BPS`);
      console.log(`  - Fee Account: ${feeAccount}`);
    }
  } catch (error) {
    console.error('[Jupiter Trigger] Referral error:', error.message);
  }
}
```

---

## Phase 6: Testing (1 hour)

### Create Test Script
- [ ] Created `/test-jupiter-referral-integration.js`
- [ ] Copied test code from implementation guide
- [ ] Saved file

### Run Tests
```bash
# Test 1: Configuration
node test-jupiter-referral-config.js

# Test 2: Referral Integration
node test-jupiter-referral-integration.js
```

- [ ] Test 1 passed (config loads correctly)
- [ ] Test 2 passed (referral accounts accessible)
- [ ] No errors in console

### Manual Testing
- [ ] Restart backend: `cd backend && npm run dev`
- [ ] Check logs show referral account PDA
- [ ] Create a small test limit order through UI
- [ ] Check backend logs for referral confirmation:
  ```
  [Jupiter Trigger] ✅ Referral fee enabled:
    - Fee: 100 BPS
    - Fee Account: 7x3g...
  ```
- [ ] Order created successfully
- [ ] Wait for order execution (or cancel to test)

---

## Phase 7: Verification (30 min)

### Check Referral Token Accounts

**Via Solscan:**
- [ ] Visit: `https://solscan.io/account/<YOUR_REFERRAL_ACCOUNT_PDA>`
- [ ] View token accounts owned by referral account
- [ ] Verify accounts exist for SOL, USDC, USDT

**Via Dashboard:**
- [ ] Visit: https://referral.jup.ag/dashboard
- [ ] Connect wallet
- [ ] View "Referral Token Accounts" section
- [ ] Confirm accounts are listed

### Monitor First Fee Collection

After an order executes:
- [ ] Check referral token account balances
- [ ] Verify fee was collected (1% of order value)
- [ ] Amount matches expected fee

---

## Phase 8: Documentation (30 min)

- [ ] Update `README.md` with referral setup notes
- [ ] Add referral account PDA to team docs
- [ ] Document monitoring procedures
- [ ] Share with team

---

## Troubleshooting

### "Referral token account does not exist"
- Go back to dashboard and create it
- Or use SDK to initialize (see implementation guide)

### "Invalid referral account"
- Verify you're using the PDA from dashboard, not wallet address
- Should start with a capital letter and look different from wallet

### "Fee not being collected"
- Check backend logs for "✅ Referral fee enabled"
- Verify `feeAccount` is in payload
- Verify `feeBps` is inside `params` object
- Check referral token account exists for that mint

### Backend won't start
- Check npm packages installed
- Verify `/backend/utils/jupiterReferral.js` exists
- Check for syntax errors in modified files
- Review error logs

---

## Success Criteria

✅ **Phase 1-3**: Setup complete
- Referral account created (PDA)
- Token accounts created for common mints
- Environment variables updated
- Dependencies installed

✅ **Phase 4-5**: Code complete
- Helper module created
- Jupiter service updated
- No syntax errors
- Backend starts successfully

✅ **Phase 6-7**: Testing complete
- Integration tests pass
- Manual order creation works
- Backend logs show referral info
- Referral accounts visible on explorer

✅ **Phase 8**: Production ready
- All tests passing
- Documentation updated
- Team notified
- Monitoring in place

---

## Completion Status

**Overall Progress**: __ / 35 tasks completed

**Phase Status:**
- [ ] Phase 1: Dashboard Setup (__ / 4)
- [ ] Phase 2: Environment Setup (__ / 3)
- [ ] Phase 3: Install Dependencies (__ / 2)
- [ ] Phase 4: Create Helper Module (__ / 4)
- [ ] Phase 5: Update Jupiter Service (__ / 7)
- [ ] Phase 6: Testing (__ / 9)
- [ ] Phase 7: Verification (__ / 6)
- [ ] Phase 8: Documentation (__ / 4)

---

## Quick Reference

**Key URLs:**
- Referral Dashboard: https://referral.jup.ag/dashboard
- API Docs: https://dev.jup.ag/docs/swap/add-fees-to-swap#for-trigger-api-integrator-fee
- Implementation Guide: `./JUPITER_REFERRAL_IMPLEMENTATION_GUIDE.md`
- Investigation Summary: `./JUPITER_REFERRAL_INVESTIGATION_SUMMARY.md`

**Key Files:**
- `/backend/.env` - Configuration
- `/backend/utils/jupiterReferral.js` - Helper (NEW)
- `/backend/services/jupiterTriggerService.js` - Main service (MODIFY)
- `/test-jupiter-referral-integration.js` - Test script (NEW)

**Key Accounts:**
- Admin Wallet: `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt`
- Referral Account PDA: `_________________________________` (Fill in from dashboard)
- Referral Program: `REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3`
- Jupiter Project: `45ruCyfdRkWpRNGEqWzjCiXRHkZs8WXCLQ67Pnpye7Hp`

---

## Notes

**Start Date**: _______________
**Completed Date**: _______________
**Implemented By**: _______________
**First Fee Collected**: _______________

---

**Good luck! 🚀 Once complete, you'll be earning 1% on all limit order volume!**
