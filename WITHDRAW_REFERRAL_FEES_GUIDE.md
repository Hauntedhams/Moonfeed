# How to Claim Your Jupiter Referral Fees

## ✨ Updated: Using Official SDK Claim Methods

The Jupiter Referral SDK provides **official claim instructions** to properly withdraw your referral fees. The updated script now uses these SDK methods instead of manual token transfers.

## The Solution
Use the Jupiter SDK's `claimAllV2()` method to claim all your referral fees at once. This is the **official and recommended** way to claim fees.

## Step-by-Step Instructions

### 1. Set Up Your Private Key

Create a file called `.env.referral` in the project root:

```bash
ULTRA_WALLET_PRIVATE_KEY=your_private_key_here
```

⚠️ **IMPORTANT**: 
- Never share this file or commit it to git
- This is your actual wallet private key (the one for wallet: 42DqmQMZrVeZkP2BtjzcS96ES81jvxFqwUzVNhUPt...)
- Keep it secure!

### 2. Run the Claim Script

```bash
# Claim all tokens (default and recommended)
node withdraw-referral-fees.js

# Claim all tokens explicitly
node withdraw-referral-fees.js --all

# Claim specific token
node withdraw-referral-fees.js --token USDC
node withdraw-referral-fees.js --token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

This script will:
1. Connect to your wallet using the SDK
2. Find all token accounts with accumulated fees
3. Use the official `claimAllV2()` SDK method to claim fees
4. Properly split fees between you and the Jupiter project
5. Show transaction results with Solscan links

### 3. Understanding the Claim Process

The SDK's claim method does more than just transfer tokens:
- **Splits fees** between partner (you) and project (Jupiter) based on `shareBps`
- **Creates token accounts** automatically if they don't exist
- **Emits events** for proper tracking
- **Handles Token-2022** tokens as well as standard SPL tokens

## What Happens When You Run It

```
🔍 Checking referral fees for wallet: 42DqmQ...hUPt

Found referral accounts:
✅ SOL: 0.5 SOL ($50.00)
✅ USDC: 100.25 USDC ($100.25)

Total value: $150.25

Do you want to withdraw all fees? (yes/no): yes

Withdrawing SOL fees...
✅ Withdrew 0.5 SOL - Transaction: abc123...

Withdrawing USDC fees...
✅ Withdrew 100.25 USDC - Transaction: def456...

🎉 All fees withdrawn successfully!
```

## Troubleshooting

### "Error: Account does not exist"
- This means no one has swapped through your referral yet, so no fee accounts have been created
- Fee accounts are auto-created on the FIRST swap through your referral link

### "Balance: 0"
- Fee accounts exist but have no balance yet
- Users need to make swaps through your app/referral link

### "Private key error"
- Double-check your `.env.referral` file has the correct private key
- Make sure it's the private key for wallet: 42DqmQ...hUPt

## Why This Works Better Than the Dashboard

1. **Direct access**: SDK talks directly to the blockchain
2. **No redirects**: Bypasses any dashboard routing issues  
3. **More reliable**: As confirmed by Jupiter support team
4. **Full control**: You can see exactly what's happening

## Need Help?

If you run into issues:
1. Check that your private key is correct in `.env.referral`
2. Make sure you have funds for transaction fees (small amount of SOL)
3. Verify that swaps have been made through your referral link
4. Check the console output for specific error messages

## Security Notes

- The script only withdraws YOUR referral fees to YOUR wallet
- It never sends funds anywhere else
- Your private key never leaves your machine
- The script is open source - you can review the code
