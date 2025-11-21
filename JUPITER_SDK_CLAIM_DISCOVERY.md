# Jupiter Referral SDK Claim Instruction - Discovery

## Date: January 2025

## Summary

After thorough investigation of the Jupiter Referral SDK source code and TypeScript definitions, I have confirmed that **the SDK DOES provide official claim instructions**.

## What Was Found

### Available Methods in `ReferralProvider` class:

1. **`claim()`** - Single token claim (legacy)
2. **`claimV2()`** - Single token claim (updated)
3. **`claimAll()`** - Claim all tokens with optional strategy
4. **`claimAllV2()`** - Claim all tokens (updated, recommended)
5. **`claimPartially()`** - Claim specific list of tokens

### Method Signatures:

```typescript
async claim({ payerPubKey, referralAccountPubKey, mint }): Promise<VersionedTransaction>

async claimV2({ payerPubKey, referralAccountPubKey, mint }): Promise<VersionedTransaction>

async claimAll({ payerPubKey, referralAccountPubKey, strategy? }): Promise<VersionedTransaction[]>

async claimAllV2({ payerPubKey, referralAccountPubKey }): Promise<VersionedTransaction[]>

async claimPartially({ payerPubKey, referralAccountPubKey, withdrawalableTokenAddress }): Promise<VersionedTransaction[]>
```

## What the Claim Instruction Does

From the IDL (Program Interface Definition):

```javascript
{
  name: "claim";
  accounts: [
    { name: "payer" },                     // Pays transaction fees
    { name: "project" },                   // Jupiter project
    { name: "admin" },                     // Project admin
    { name: "projectAdminTokenAccount" },  // Project admin receives share
    { name: "referralAccount" },           // Your referral account
    { name: "referralTokenAccount" },      // Where fees accumulate
    { name: "partner" },                   // You (the partner)
    { name: "partnerTokenAccount" },       // You receive your share
    { name: "mint" },                      // Token being claimed
    // ... system programs
  ];
  args: [];
}
```

The claim instruction:
1. **Reads your referral account** to get the fee split (`shareBps`)
2. **Calculates splits** based on the configuration
3. **Transfers your share** to your token account
4. **Transfers project share** to Jupiter's token account
5. **Emits ClaimEvent** with amounts transferred

## Previous Misunderstanding

Initially, I thought the SDK didn't provide a claim method and suggested using manual SPL token transfers. This was incorrect because:

1. **Manual transfers don't split fees** correctly between partner and project
2. **Manual transfers bypass** the referral program's accounting
3. **Manual transfers won't work** if you don't directly own the referral token account

## Correct Approach

### Use SDK Claim Methods:

```javascript
const { ReferralProvider } = require('@jup-ag/referral-sdk');

const connection = new Connection(RPC_ENDPOINT);
const referralProvider = new ReferralProvider(connection);

// Claim all tokens (recommended)
const claimTxs = await referralProvider.claimAllV2({
  payerPubKey: wallet.publicKey,
  referralAccountPubKey: referralAccount
});

// Send transactions
for (const tx of claimTxs) {
  const sig = await connection.sendTransaction(tx, [wallet]);
  await connection.confirmTransaction(sig);
}
```

## Files Updated

1. **`withdraw-referral-fees.js`**
   - Now uses `claimAllV2()` instead of manual transfers
   - Supports `--all` and `--token <mint>` flags
   - Properly splits fees using SDK

2. **`JUPITER_REFERRAL_CLAIM_SDK.md`** (NEW)
   - Complete documentation of claim methods
   - Examples and usage patterns
   - Explanation of fee splits

3. **`JUPITER_REFERRAL_COMPLETE_GUIDE.md`**
   - Added section about official claim methods
   - Links to new documentation

4. **`WITHDRAW_REFERRAL_FEES_GUIDE.md`**
   - Updated to reflect SDK claim methods
   - Updated command examples
   - Explains fee splitting

## How to Use

### Claim All Tokens (Recommended):
```bash
node withdraw-referral-fees.js
```

### Claim Specific Token:
```bash
node withdraw-referral-fees.js --token USDC
node withdraw-referral-fees.js --token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

## Verification

To verify the SDK methods exist:
```bash
cd backend
cat node_modules/@jup-ag/referral-sdk/dist/index.d.ts | grep -A 2 "claim"
```

Output shows:
- `claim()`
- `claimV2()`
- `claimAll()`
- `claimAllV2()`
- `claimPartially()`

## Benefits of SDK Claim vs Manual Transfer

| Feature | SDK Claim | Manual Transfer |
|---------|-----------|----------------|
| Fee splitting | ✅ Automatic | ❌ No |
| Event emission | ✅ Yes | ❌ No |
| Account creation | ✅ Automatic | ❌ Manual |
| Token-2022 support | ✅ Yes | ⚠️ Partial |
| Program accounting | ✅ Correct | ❌ Bypassed |
| Recommended | ✅ Yes | ❌ No |

## Next Steps

1. **Wait for swaps** to occur through your referral link
2. **Run claim script** when fees accumulate:
   ```bash
   node withdraw-referral-fees.js
   ```
3. **Check results** on Solscan for claim transactions

## References

- **SDK GitHub**: https://github.com/jup-ag/referral-sdk
- **TypeScript Definitions**: `node_modules/@jup-ag/referral-sdk/dist/index.d.ts`
- **Your Referral Account**: `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt`
- **Jupiter Referral Program**: `REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3`

## Conclusion

The Jupiter Referral SDK provides comprehensive claim functionality. Always use the official SDK methods (`claimV2()` or `claimAllV2()`) instead of manual token transfers. This ensures proper fee splitting, event emission, and compliance with the referral program's accounting.
