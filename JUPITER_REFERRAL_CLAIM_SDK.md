# Jupiter Referral SDK - Official Claim Methods

## Overview

The Jupiter Referral SDK **DOES** provide official claim instructions! This document explains the proper way to claim referral fees using the SDK's built-in methods.

## Available Claim Methods

The `ReferralProvider` class provides several claim methods:

### 1. `claim()` - Claim Single Token
```javascript
const claimTx = await referralProvider.claim({
  payerPubKey: wallet.publicKey,
  referralAccountPubKey: referralAccount,
  mint: tokenMint
});
```

### 2. `claimV2()` - Updated Single Token Claim
```javascript
const claimTx = await referralProvider.claimV2({
  payerPubKey: wallet.publicKey,
  referralAccountPubKey: referralAccount,
  mint: tokenMint
});
```

### 3. `claimAll()` - Claim All Tokens
```javascript
const claimTxs = await referralProvider.claimAll({
  payerPubKey: wallet.publicKey,
  referralAccountPubKey: referralAccount,
  strategy: { type: 'top-tokens', topN: 100 } // optional
});
```

### 4. `claimAllV2()` - Updated Claim All Tokens (Recommended)
```javascript
const claimTxs = await referralProvider.claimAllV2({
  payerPubKey: wallet.publicKey,
  referralAccountPubKey: referralAccount
});
```

### 5. `claimPartially()` - Claim Specific Tokens
```javascript
const claimTxs = await referralProvider.claimPartially({
  payerPubKey: wallet.publicKey,
  referralAccountPubKey: referralAccount,
  withdrawalableTokenAddress: [mint1, mint2, mint3]
});
```

## How the Claim Instruction Works

The claim instruction in the Jupiter Referral program:

1. **Splits fees between project and partner** based on the `shareBps` configuration
2. **Transfers partner's share** to the partner's token account
3. **Transfers project's share** to the project admin's token account
4. **Automatically creates token accounts** if they don't exist

### From the IDL (Program Interface):

```javascript
{
  name: "claim";
  accounts: [
    { name: "payer" },           // Pays for transaction fees
    { name: "project" },         // Jupiter project account
    { name: "admin" },           // Project admin
    { name: "projectAdminTokenAccount" },  // Project admin receives their share
    { name: "referralAccount" },           // Your referral account
    { name: "referralTokenAccount" },      // Where fees are collected
    { name: "partner" },                   // You (the partner)
    { name: "partnerTokenAccount" },       // You receive your share here
    { name: "mint" },            // Token being claimed
    // ... program accounts
  ];
  args: [];
}
```

### Events Emitted:

```javascript
ClaimEvent {
  project: PublicKey;
  projectAdminTokenAccount: PublicKey;
  referralAccount: PublicKey;
  referralTokenAccount: PublicKey;
  partnerTokenAccount: PublicKey;
  mint: PublicKey;
  referralAmount: u64;    // Amount you receive
  projectAmount: u64;     // Amount project receives
}
```

## Why Use SDK Methods Instead of Manual Transfer?

### ❌ Manual SPL Token Transfer Approach:
- Only transfers tokens, doesn't split fees correctly
- Doesn't follow the referral program's accounting
- May break if you're not the direct owner of the referral token account
- Doesn't emit proper events

### ✅ SDK Claim Methods:
- Properly splits fees between you and Jupiter project
- Follows the referral program's rules
- Creates token accounts automatically if needed
- Emits events for tracking
- Handles both Token Program and Token-2022 tokens

## Updated Withdrawal Script

The `withdraw-referral-fees.js` script now uses the official SDK claim methods:

### Usage:

```bash
# Claim all tokens (default, recommended)
node withdraw-referral-fees.js

# Claim all tokens explicitly
node withdraw-referral-fees.js --all

# Claim specific token by name
node withdraw-referral-fees.js --token USDC

# Claim specific token by mint address
node withdraw-referral-fees.js --token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

### What It Does:

1. **Scans for all tokens** with accumulated fees
2. **Creates claim transactions** using `claimAllV2()`
3. **Splits fees** between you and Jupiter project
4. **Sends transactions** and confirms them
5. **Shows results** with Solscan links

## Fee Split Configuration

Your referral account is configured with:
- **Referral Account**: `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt`
- **Fee Rate**: 100 BPS (1% of swap amount)
- **Share Split**: Determined by `shareBps` (you can check this with the SDK)

To check your share percentage:
```javascript
const referralAccount = await referralProvider.getReferralAccount(referralAccountPubkey);
console.log('Your share:', referralAccount.shareBps, 'BPS');
```

## Next Steps

1. **Wait for swaps** to occur through your referral link
2. **Run the claim script** periodically to collect fees:
   ```bash
   node withdraw-referral-fees.js
   ```
3. **Check your wallet** to see the claimed tokens

## Monitoring Your Earnings

### Check fee token accounts:
```bash
node test-referral-system.js
```

### View on Solscan:
```
https://solscan.io/account/42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt
```

### Check claim transactions:
Look for transactions with the Jupiter Referral program:
```
Program: REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3
```

## Troubleshooting

### "No tokens with fees found"
- No swaps have occurred yet with your referral link
- Fee token accounts haven't been created yet
- All fees have already been claimed

### "Claim failed"
- Insufficient SOL for transaction fees (need ~0.01 SOL)
- Network congestion - try again
- Check wallet private key is correct

### "Low SOL balance"
- Add at least 0.01 SOL to your wallet for transaction fees
- Use a faucet for devnet testing

## Resources

- **Jupiter Referral Dashboard**: https://referral.jup.ag/
- **Jupiter Referral SDK**: https://github.com/jup-ag/referral-sdk
- **Your Referral Account**: https://solscan.io/account/42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt
- **Jupiter Referral Program**: REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3
