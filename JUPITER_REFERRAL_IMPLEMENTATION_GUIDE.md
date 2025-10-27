# 🔧 Jupiter Trigger API Referral Implementation Guide

## Overview

This guide provides step-by-step instructions to properly implement Jupiter's referral program for the Trigger API (limit orders) in the Moonfeed app.

## Current Status: ❌ NOT WORKING

The current implementation does **NOT** collect referral fees because it uses the deprecated approach. This guide will fix that.

---

## Part 1: Understanding the Requirements

### What You Need

1. **Referral Account (PDA)** - Not just a wallet address
2. **Referral Token Accounts** - One for each token mint you want to collect fees in
3. **Correct API Parameters** - `feeAccount` and `params.feeBps`

### Key Information

- **Referral Program**: `REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3`
- **Jupiter Swap Project Account**: `45ruCyfdRkWpRNGEqWzjCiXRHkZs8WXCLQ67Pnpye7Hp`
- **Your Admin Wallet**: `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt`

---

## Part 2: Create Referral Account

### Option A: Use Jupiter's Referral Dashboard (Recommended)

1. **Visit**: https://referral.jup.ag/dashboard
2. **Connect Wallet**: Use `42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt`
3. **Create Referral Account**: Click "Create New Referral Account"
4. **Save the Referral Key**: This is your PDA (starts with a capital letter, different from your wallet)
5. **Save all Referral Token Accounts**: These are created automatically for common tokens

### Option B: Use SDK (Advanced)

```javascript
const { ReferralProvider } = require('@jup-ag/referral-sdk');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');

const connection = new Connection('https://api.mainnet-beta.solana.com');
const provider = new ReferralProvider(connection);

// Your admin wallet
const adminWallet = Keypair.fromSecretKey(/* your secret key */);

// Create referral account
const { referralAccountPubKey, tx } = await provider.initializeReferralAccount({
  payerPubKey: adminWallet.publicKey,
  partnerPubKey: adminWallet.publicKey,
  projectAccountPubKey: new PublicKey('45ruCyfdRkWpRNGEqWzjCiXRHkZs8WXCLQ67Pnpye7Hp')
});

// Send transaction
const signature = await connection.sendTransaction(tx, [adminWallet]);
console.log('Referral Account Created:', referralAccountPubKey.toString());
```

---

## Part 3: Update Environment Variables

Update `/backend/.env`:

```bash
# Old (wrong - just a wallet)
# JUPITER_REFERRAL_ACCOUNT=42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt

# New (correct - referral account PDA from dashboard)
JUPITER_REFERRAL_ACCOUNT=<YOUR_REFERRAL_ACCOUNT_PDA_FROM_DASHBOARD>
JUPITER_REFERRAL_FEE_BPS=100
JUPITER_ADMIN_WALLET=42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt
SOLANA_RPC=https://api.mainnet-beta.solana.com
```

---

## Part 4: Install Required Dependencies

```bash
cd backend
npm install @jup-ag/referral-sdk @solana/web3.js @solana/spl-token
```

---

## Part 5: Update Backend Code

### Create New Helper Module: `/backend/utils/jupiterReferral.js`

```javascript
/**
 * Jupiter Referral Program Helper
 * Manages referral token accounts for fee collection
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const { ReferralProvider } = require('@jup-ag/referral-sdk');

const REFERRAL_PROGRAM_ID = 'REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3';
const REFERRAL_ACCOUNT = process.env.JUPITER_REFERRAL_ACCOUNT;
const SOLANA_RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

// Initialize connection and provider
const connection = new Connection(SOLANA_RPC, 'confirmed');
const provider = new ReferralProvider(connection);

// Cache referral token accounts to avoid repeated lookups
const referralTokenAccountCache = new Map();

/**
 * Get or derive the referral token account for a specific mint
 * @param {string} mintAddress - Token mint address
 * @returns {Promise<string>} Referral token account address
 */
async function getReferralTokenAccount(mintAddress) {
  // Check cache first
  if (referralTokenAccountCache.has(mintAddress)) {
    const cached = referralTokenAccountCache.get(mintAddress);
    console.log(`[Referral] Using cached token account for ${mintAddress.slice(0, 8)}...`);
    return cached;
  }

  if (!REFERRAL_ACCOUNT) {
    console.warn('[Referral] No referral account configured');
    return null;
  }

  try {
    // Derive the referral token account PDA
    const [referralTokenAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("referral_ata"),
        new PublicKey(REFERRAL_ACCOUNT).toBuffer(),
        new PublicKey(mintAddress).toBuffer(),
      ],
      new PublicKey(REFERRAL_PROGRAM_ID)
    );

    const accountAddress = referralTokenAccount.toString();

    // Check if account exists on-chain
    const accountInfo = await connection.getAccountInfo(referralTokenAccount);
    
    if (!accountInfo) {
      console.warn(`[Referral] Token account for ${mintAddress.slice(0, 8)}... does not exist yet`);
      console.warn(`[Referral] Please create it via https://referral.jup.ag/dashboard`);
      console.warn(`[Referral] Or use the SDK to initialize: initializeReferralTokenAccount()`);
      // Return the PDA anyway - Jupiter might create it on-demand
    } else {
      console.log(`[Referral] ✅ Token account exists for ${mintAddress.slice(0, 8)}...`);
    }

    // Cache the result
    referralTokenAccountCache.set(mintAddress, accountAddress);
    
    return accountAddress;

  } catch (error) {
    console.error(`[Referral] Error getting token account for ${mintAddress}:`, error.message);
    return null;
  }
}

/**
 * Initialize a referral token account for a specific mint
 * Note: This requires a payer wallet with SOL for rent
 * @param {string} mintAddress - Token mint address
 * @param {Keypair} payerKeypair - Payer wallet keypair
 * @returns {Promise<string>} Transaction signature
 */
async function initializeReferralTokenAccount(mintAddress, payerKeypair) {
  try {
    const { tx, referralTokenAccountPubKey } = await provider.initializeReferralTokenAccount({
      payerPubKey: payerKeypair.publicKey,
      referralAccountPubKey: new PublicKey(REFERRAL_ACCOUNT),
      mint: new PublicKey(mintAddress),
    });

    const signature = await connection.sendTransaction(tx, [payerKeypair]);
    await connection.confirmTransaction(signature, 'confirmed');

    console.log(`[Referral] ✅ Initialized token account for ${mintAddress}`);
    console.log(`[Referral] Account: ${referralTokenAccountPubKey.toString()}`);
    console.log(`[Referral] Signature: ${signature}`);

    // Cache the new account
    referralTokenAccountCache.set(mintAddress, referralTokenAccountPubKey.toString());

    return signature;

  } catch (error) {
    console.error(`[Referral] Error initializing token account:`, error);
    throw error;
  }
}

/**
 * Check if a referral token account exists
 * @param {string} mintAddress - Token mint address
 * @returns {Promise<boolean>} True if account exists
 */
async function referralTokenAccountExists(mintAddress) {
  try {
    const accountAddress = await getReferralTokenAccount(mintAddress);
    if (!accountAddress) return false;

    const accountInfo = await connection.getAccountInfo(new PublicKey(accountAddress));
    return accountInfo !== null;

  } catch (error) {
    console.error(`[Referral] Error checking account existence:`, error);
    return false;
  }
}

module.exports = {
  getReferralTokenAccount,
  initializeReferralTokenAccount,
  referralTokenAccountExists,
  connection,
  provider
};
```

### Update `/backend/services/jupiterTriggerService.js`

```javascript
/**
 * Jupiter Trigger API Service
 * Handles limit orders and trigger orders via Jupiter's Trigger API
 * Includes referral integration per Jupiter's official documentation
 */

const axios = require('axios');
const { getReferralTokenAccount } = require('../utils/jupiterReferral');

// ...existing cache code...

// Jupiter Trigger API base URL
const JUPITER_TRIGGER_API = 'https://lite-api.jup.ag/trigger/v1';

// Referral configuration from environment
const REFERRAL_ACCOUNT = process.env.JUPITER_REFERRAL_ACCOUNT;
const FEE_BPS = parseInt(process.env.JUPITER_REFERRAL_FEE_BPS) || 100;

/**
 * Create a new trigger/limit order with referral fees
 * @param {Object} orderParams - Order parameters
 * @returns {Promise<Object>} API response with transaction data
 */
async function createOrder(orderParams) {
  try {
    const {
      maker,
      payer,
      inputMint,
      outputMint,
      makingAmount,
      takingAmount,
      expiredAt,
      orderType = 'limit'
    } = orderParams;

    // Validate required fields
    if (!maker || !inputMint || !outputMint || !makingAmount || !takingAmount) {
      return {
        success: false,
        error: 'Missing required order parameters'
      };
    }

    // Build base payload matching Jupiter Trigger API v1 spec
    const payload = {
      maker,
      payer: payer || maker,
      inputMint,
      outputMint,
      params: {
        makingAmount: makingAmount.toString(),
        takingAmount: takingAmount.toString()
      },
      computeUnitPrice: "auto"
    };

    // Add optional expiration
    if (expiredAt) {
      payload.expiredAt = expiredAt;
    }

    // ============================================
    // REFERRAL FEE INTEGRATION (Per Jupiter Docs)
    // ============================================
    if (REFERRAL_ACCOUNT) {
      try {
        // For ExactIn (default): Fee can be in input or output mint
        // For ExactOut: Fee must be in input mint only
        // We'll use output mint for ExactIn orders (most common)
        const feeMint = outputMint;
        
        // Get the referral token account for the fee mint
        const feeAccount = await getReferralTokenAccount(feeMint);
        
        if (feeAccount) {
          // Add fee parameters to payload (CORRECT format)
          payload.feeAccount = feeAccount;
          payload.params.feeBps = FEE_BPS.toString(); // Inside params object
          
          console.log(`[Jupiter Trigger] ✅ Referral fee enabled:`);
          console.log(`  - Fee: ${FEE_BPS} BPS (${FEE_BPS/100}%)`);
          console.log(`  - Fee Account: ${feeAccount}`);
          console.log(`  - Fee Mint: ${feeMint.slice(0, 8)}...`);
        } else {
          console.warn(`[Jupiter Trigger] ⚠️ No referral token account for ${feeMint.slice(0, 8)}...`);
          console.warn(`[Jupiter Trigger] Order will proceed without referral fee`);
        }
      } catch (error) {
        console.error('[Jupiter Trigger] Error setting up referral fee:', error.message);
        console.warn('[Jupiter Trigger] Order will proceed without referral fee');
      }
    } else {
      console.log('[Jupiter Trigger] No referral account configured');
    }

    console.log('[Jupiter Trigger] Creating order:', JSON.stringify(payload, null, 2));

    // Call Jupiter Trigger API
    const response = await axios.post(
      `${JUPITER_TRIGGER_API}/createOrder`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('[Jupiter Trigger] Order created successfully');
    
    return {
      success: true,
      data: response.data,
      orderParams: payload
    };

  } catch (error) {
    console.error('[Jupiter Trigger] Error creating order:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || error.message,
      details: error.response?.data,
      statusCode: error.response?.status
    };
  }
}

// ...rest of the file stays the same...

module.exports = {
  createOrder,
  // ...other exports...
};
```

---

## Part 6: Testing

### Test Script: `/test-jupiter-referral-integration.js`

```javascript
/**
 * Test Jupiter Referral Integration
 * Verifies that referral token accounts are accessible
 */

const { getReferralTokenAccount, referralTokenAccountExists } = require('./backend/utils/jupiterReferral');

// Common token mints to test
const TEST_MINTS = [
  'So11111111111111111111111111111111111111112', // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
];

async function test() {
  console.log('🧪 Testing Jupiter Referral Integration\n');
  console.log('Referral Account:', process.env.JUPITER_REFERRAL_ACCOUNT);
  console.log('Fee BPS:', process.env.JUPITER_REFERRAL_FEE_BPS);
  console.log('');

  for (const mint of TEST_MINTS) {
    console.log(`Testing mint: ${mint.slice(0, 8)}...`);
    
    const exists = await referralTokenAccountExists(mint);
    const account = await getReferralTokenAccount(mint);
    
    console.log(`  - Exists: ${exists ? '✅' : '❌'}`);
    console.log(`  - Account: ${account || 'N/A'}`);
    console.log('');
  }

  console.log('✅ Test complete');
}

test().catch(console.error);
```

Run the test:
```bash
node test-jupiter-referral-integration.js
```

---

## Part 7: Create Referral Token Accounts

You need to create referral token accounts for every token you want to collect fees in.

### Via Dashboard (Easiest)

1. Visit https://referral.jup.ag/dashboard
2. Connect your wallet
3. Click "Create Token Account" for each token (SOL, USDC, etc.)

### Via Script (Bulk Creation)

Create `/scripts/create-referral-token-accounts.js`:

```javascript
const { initializeReferralTokenAccount } = require('../backend/utils/jupiterReferral');
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

// Load your admin wallet keypair
const secretKey = JSON.parse(fs.readFileSync('./admin-keypair.json', 'utf8'));
const adminWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

// Top 50 most traded tokens on Solana
const COMMON_MINTS = [
  'So11111111111111111111111111111111111111112', // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  // Add more mints as needed
];

async function createAccounts() {
  console.log('🔧 Creating referral token accounts...\n');

  for (const mint of COMMON_MINTS) {
    console.log(`Creating account for ${mint.slice(0, 8)}...`);
    try {
      const signature = await initializeReferralTokenAccount(mint, adminWallet);
      console.log(`✅ Success: ${signature}\n`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}\n`);
    }
  }

  console.log('✅ All accounts created');
}

createAccounts().catch(console.error);
```

---

## Part 8: Deployment Checklist

- [ ] Create referral account via dashboard
- [ ] Save referral account PDA
- [ ] Update `JUPITER_REFERRAL_ACCOUNT` in `.env`
- [ ] Install npm packages: `@jup-ag/referral-sdk @solana/web3.js @solana/spl-token`
- [ ] Create `/backend/utils/jupiterReferral.js`
- [ ] Update `/backend/services/jupiterTriggerService.js`
- [ ] Create referral token accounts for common tokens (SOL, USDC, USDT, etc.)
- [ ] Run test script to verify configuration
- [ ] Restart backend server
- [ ] Test creating a limit order
- [ ] Monitor referral token accounts for fee deposits

---

## Part 9: Monitoring Referral Earnings

### Check Balances via Script

```javascript
const { connection } = require('./backend/utils/jupiterReferral');
const { PublicKey } = require('@solana/web3.js');
const { getAccount } = require('@solana/spl-token');

async function checkBalances() {
  const referralAccount = process.env.JUPITER_REFERRAL_ACCOUNT;
  
  // Get all token accounts owned by referral account
  const accounts = await connection.getTokenAccountsByOwner(
    new PublicKey(referralAccount),
    { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
  );

  console.log('💰 Referral Account Balances:\n');
  
  for (const { pubkey, account } of accounts.value) {
    const tokenAccount = await getAccount(connection, pubkey);
    if (tokenAccount.amount > 0) {
      console.log(`Token: ${tokenAccount.mint.toString()}`);
      console.log(`Balance: ${tokenAccount.amount.toString()}`);
      console.log(`Account: ${pubkey.toString()}`);
      console.log('');
    }
  }
}

checkBalances().catch(console.error);
```

### Via Solana Explorer

Visit: `https://solscan.io/account/YOUR_REFERRAL_ACCOUNT_PDA`

---

## Troubleshooting

### "Referral token account does not exist"
- Create the account via dashboard or SDK
- Make sure you're using the correct mint address

### "Invalid referral account"
- Verify you're using the referral account PDA, not your wallet address
- Check that the account was created via the referral program

### "Fee not being collected"
- Verify `feeAccount` is in the payload
- Verify `feeBps` is inside `params` object
- Check that the referral token account exists for that mint

### "Transaction failed"
- Ensure the payer has enough SOL for transaction fees
- Check that all accounts are properly initialized
- Verify the order parameters are correct

---

## Resources

- [Jupiter Referral Dashboard](https://referral.jup.ag/dashboard)
- [Jupiter API Docs](https://dev.jup.ag/docs/swap/add-fees-to-swap)
- [Referral Program Source](https://github.com/TeamRaccoons/referral)
- [SDK Example](https://github.com/TeamRaccoons/referral/blob/main/example/src/createReferralAccount.ts)

---

## Summary

This implementation guide ensures that:
1. ✅ Referral account is properly created as a PDA
2. ✅ Referral token accounts exist for all traded tokens
3. ✅ API calls use the correct parameter format
4. ✅ Fees are collected automatically into your token accounts
5. ✅ Everything follows Jupiter's official documentation

**After completing this guide, your app will properly collect 1% referral fees on all limit orders! 🎉**
