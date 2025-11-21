# Jupiter Referral Fee Claiming - Quick Reference

## 🚀 Quick Start

```bash
# Claim all your referral fees (recommended)
node withdraw-referral-fees.js
```

## 📋 Command Options

| Command | Description |
|---------|-------------|
| `node withdraw-referral-fees.js` | Claim all tokens (default) |
| `node withdraw-referral-fees.js --all` | Explicitly claim all tokens |
| `node withdraw-referral-fees.js --token USDC` | Claim specific token by name |
| `node withdraw-referral-fees.js --token <mint>` | Claim specific token by mint address |

## 🔑 Setup Required

Create `.env.referral` file:
```bash
ULTRA_WALLET_PRIVATE_KEY=your_private_key_here
```

## 📊 SDK Methods Used

```javascript
// What the script does internally
const referralProvider = new ReferralProvider(connection);

// Claim all tokens
const claimTxs = await referralProvider.claimAllV2({
  payerPubKey: wallet.publicKey,
  referralAccountPubKey: referralAccount
});

// Or claim specific token
const claimTx = await referralProvider.claimV2({
  payerPubKey: wallet.publicKey,
  referralAccountPubKey: referralAccount,
  mint: tokenMint
});
```

## ✅ What You'll See

```
🚀 Jupiter Referral Fee Claim Tool (Using Official SDK)

✅ Wallet loaded: 42DqmQ...hUPt
📍 Referral Account: 42DqmQ...hUPt
💰 Wallet SOL Balance: 0.5000 SOL
✅ Sufficient SOL for transaction fees

🌟 Mode: Claim ALL tokens (default)

🔍 Scanning for all tokens with fees...

📦 Found 2 token(s) with fees to claim

📤 Claiming token 1/2...
✅ Claim successful!
🔗 Signature: abc123...
🌐 Explorer: https://solscan.io/tx/abc123...

📤 Claiming token 2/2...
✅ Claim successful!
🔗 Signature: def456...
🌐 Explorer: https://solscan.io/tx/def456...

============================================================
📊 CLAIM SUMMARY
============================================================
✅ Successful claims: 2
❌ Failed claims: 0

✨ Done!
```

## 🔍 Check Your Fees

```bash
# Test referral system status
node test-referral-system.js

# View on Solscan
https://solscan.io/account/42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt
```

## 💡 Important Notes

1. **Fee Splitting**: The claim instruction automatically splits fees between you and Jupiter project based on `shareBps`
2. **Token Accounts**: Token accounts are created automatically if they don't exist
3. **SOL Required**: You need ~0.01 SOL for transaction fees
4. **No Fees Yet**: If no swaps have occurred, you'll see "No tokens with fees found"

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Private key not found" | Create `.env.referral` with your private key |
| "Low SOL balance" | Add at least 0.01 SOL to your wallet |
| "No tokens with fees found" | Wait for swaps to occur through your referral link |
| "Claim failed" | Check network status, try again in a few minutes |

## 📚 Full Documentation

- **Claim SDK Details**: [JUPITER_REFERRAL_CLAIM_SDK.md](./JUPITER_REFERRAL_CLAIM_SDK.md)
- **Complete Guide**: [JUPITER_REFERRAL_COMPLETE_GUIDE.md](./JUPITER_REFERRAL_COMPLETE_GUIDE.md)
- **Withdrawal Guide**: [WITHDRAW_REFERRAL_FEES_GUIDE.md](./WITHDRAW_REFERRAL_FEES_GUIDE.md)
- **Discovery Process**: [JUPITER_SDK_CLAIM_DISCOVERY.md](./JUPITER_SDK_CLAIM_DISCOVERY.md)

## 🎯 Your Configuration

- **Referral Account**: `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt`
- **Fee Rate**: 100 BPS (1%)
- **Program**: `REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3`

## 🔗 Links

- **Referral Dashboard**: https://referral.jup.ag/
- **SDK GitHub**: https://github.com/jup-ag/referral-sdk
- **Your Account**: https://solscan.io/account/42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt
