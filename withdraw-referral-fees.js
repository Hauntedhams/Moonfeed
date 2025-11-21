/**
 * Withdraw Referral Fees Script
 * 
 * This script uses the Jupiter Referral SDK's official claim methods to withdraw fees 
 * from your referral token accounts to your main wallet. Run this when you want to 
 * claim your accumulated referral earnings.
 * 
 * The SDK provides several claim methods:
 * - claim(): Claim a single token
 * - claimAll(): Claim all tokens with balances
 * - claimPartially(): Claim specific tokens
 * 
 * Usage:
 *   node withdraw-referral-fees.js [--all | --token <mint>]
 * 
 * Examples:
 *   node withdraw-referral-fees.js --all         # Claim all tokens
 *   node withdraw-referral-fees.js --token USDC  # Claim specific token
 *   node withdraw-referral-fees.js               # Interactive mode
 */

const fs = require('fs');
const path = require('path');

// Try to load from .env.referral first, then fall back to .env
const envReferralPath = path.join(__dirname, '.env.referral');
if (fs.existsSync(envReferralPath)) {
  const dotenv = require('dotenv');
  const result = dotenv.config({ path: envReferralPath });
  console.log('✅ Loaded configuration from .env.referral');
  
  // Debug: Show what was loaded
  if (result.parsed) {
    console.log('📋 Environment variables loaded:', Object.keys(result.parsed).join(', '));
  } else {
    console.log('⚠️  Warning: No variables parsed from .env.referral');
  }
  console.log('');
} else {
  require('dotenv').config();
  console.log('✅ Loaded configuration from .env\n');
}

const { Connection, Keypair, PublicKey, sendAndConfirmTransaction } = require('@solana/web3.js');
const { ReferralProvider } = require('@jup-ag/referral-sdk');

// Configuration
const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const REFERRAL_ACCOUNT = '42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt'; // Your Ultra referral account

// Common tokens to check and withdraw
const TOKENS_TO_CHECK = [
  {
    name: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  },
  {
    name: 'SOL',
    mint: 'So11111111111111111111111111111111111111112'
  },
  {
    name: 'USDT',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  },
  {
    name: 'BONK',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
  }
];

async function claimAllTokens(referralProvider, wallet, referralAccountPubkey, connection) {
  console.log('🔍 Scanning for all tokens with fees...\n');
  
  try {
    // Use the SDK's claimAllV2 method to claim all tokens at once
    const claimTransactions = await referralProvider.claimAllV2({
      payerPubKey: wallet.publicKey,
      referralAccountPubKey: referralAccountPubkey
    });

    if (claimTransactions.length === 0) {
      console.log('ℹ️  No tokens with fees found to claim\n');
      return { success: 0, failed: 0, results: [] };
    }

    console.log(`� Found ${claimTransactions.length} token(s) with fees to claim\n`);

    let successCount = 0;
    let failedCount = 0;
    const results = [];

    // Send each claim transaction
    for (let i = 0; i < claimTransactions.length; i++) {
      try {
        console.log(`📤 Claiming token ${i + 1}/${claimTransactions.length}...`);
        
        // The SDK returns a transaction that needs to be signed
        const tx = claimTransactions[i];
        
        // Check if it's a VersionedTransaction or legacy Transaction
        if ('version' in tx) {
          // VersionedTransaction
          tx.sign([wallet]);
        } else {
          // Legacy Transaction  
          // Get recent blockhash if not already set
          if (!tx.recentBlockhash) {
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;
          }
          tx.sign(wallet);
        }
        
        // Send the signed transaction
        const signature = await connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });
        
        await connection.confirmTransaction(signature, 'confirmed');
        
        console.log(`✅ Claim successful!`);
        console.log(`🔗 Signature: ${signature}`);
        console.log(`🌐 Explorer: https://solscan.io/tx/${signature}\n`);
        
        successCount++;
        results.push({ index: i + 1, success: true, signature });
      } catch (error) {
        console.error(`❌ Claim failed: ${error.message}\n`);
        failedCount++;
        results.push({ index: i + 1, success: false, error: error.message });
      }
    }

    return { success: successCount, failed: failedCount, results };
  } catch (error) {
    console.error(`❌ Error scanning for tokens: ${error.message}\n`);
    return { success: 0, failed: 0, results: [], error: error.message };
  }
}

async function claimSpecificToken(referralProvider, wallet, referralAccountPubkey, tokenMint, connection) {
  console.log(`🔍 Claiming fees for token: ${tokenMint}\n`);
  
  try {
    // Use the SDK's claimV2 method for a specific token
    const claimTransaction = await referralProvider.claimV2({
      payerPubKey: wallet.publicKey,
      referralAccountPubKey: referralAccountPubkey,
      mint: new PublicKey(tokenMint)
    });

    console.log('📤 Sending claim transaction...');
    
    // The SDK returns a transaction that needs to be signed
    const tx = claimTransaction;
    
    // Check if it's a VersionedTransaction or legacy Transaction
    if ('version' in tx) {
      // VersionedTransaction
      tx.sign([wallet]);
    } else {
      // Legacy Transaction
      // Get recent blockhash if not already set
      if (!tx.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.publicKey;
      }
      tx.sign(wallet);
    }
    
    // Send the signed transaction
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log(`✅ Claim successful!`);
    console.log(`🔗 Signature: ${signature}`);
    console.log(`🌐 Explorer: https://solscan.io/tx/${signature}\n`);
    
    return { success: true, signature };
  } catch (error) {
    console.error(`❌ Claim failed: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Jupiter Referral Fee Claim Tool (Using Official SDK)\n');

  // Load wallet from private key
  const privateKeyEnvVar = process.env.ULTRA_WALLET_PRIVATE_KEY || process.env.REFERRAL_ACCOUNT_PRIVATE_KEY;
  
  if (!privateKeyEnvVar) {
    console.error('❌ Error: Private key not found');
    console.log('\n📝 Please create a .env.referral file with:');
    console.log('ULTRA_WALLET_PRIVATE_KEY=your_private_key_here');
    console.log('\nOr add to your existing .env file:');
    console.log('REFERRAL_ACCOUNT_PRIVATE_KEY=your_private_key_here\n');
    console.log('⚠️  This should be the private key for wallet: 42DqmQ...hUPt\n');
    process.exit(1);
  }

  let wallet;
  try {
    const privateKeyArray = JSON.parse(privateKeyEnvVar);
    wallet = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
  } catch (error) {
    // Try base58 format
    const bs58 = require('bs58');
    wallet = Keypair.fromSecretKey(bs58.decode(privateKeyEnvVar));
  }

  console.log('✅ Wallet loaded:', wallet.publicKey.toBase58());
  console.log('📍 Referral Account:', REFERRAL_ACCOUNT);
  console.log('');

  // Initialize connection and SDK
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const referralAccountPubkey = new PublicKey(REFERRAL_ACCOUNT);
  const referralProvider = new ReferralProvider(connection);

  // Check SOL balance for transaction fees
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Wallet SOL Balance: ${(balance / 1e9).toFixed(4)} SOL`);
  
  if (balance < 0.01 * 1e9) {
    console.warn('⚠️  Warning: Low SOL balance. You may need more SOL for transaction fees.\n');
  } else {
    console.log('✅ Sufficient SOL for transaction fees\n');
  }

  // Check command line arguments
  const args = process.argv.slice(2);
  const claimAllFlag = args.includes('--all');
  const tokenIndex = args.indexOf('--token');
  const specificToken = tokenIndex !== -1 ? args[tokenIndex + 1] : null;

  let result;

  if (claimAllFlag) {
    console.log('🌟 Mode: Claim ALL tokens\n');
    result = await claimAllTokens(referralProvider, wallet, referralAccountPubkey, connection);
  } else if (specificToken) {
    // Try to find the token in TOKENS_TO_CHECK
    const token = TOKENS_TO_CHECK.find(t => 
      t.name.toLowerCase() === specificToken.toLowerCase() || 
      t.mint === specificToken
    );
    
    if (token) {
      console.log(`🌟 Mode: Claim ${token.name}\n`);
      result = await claimSpecificToken(referralProvider, wallet, referralAccountPubkey, token.mint, connection);
    } else {
      // Assume it's a mint address
      console.log(`🌟 Mode: Claim specific token\n`);
      result = await claimSpecificToken(referralProvider, wallet, referralAccountPubkey, specificToken, connection);
    }
  } else {
    // Default: Claim all tokens (most convenient)
    console.log('🌟 Mode: Claim ALL tokens (default)\n');
    console.log('💡 Tip: Use --token <mint> to claim a specific token\n');
    result = await claimAllTokens(referralProvider, wallet, referralAccountPubkey, connection);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 CLAIM SUMMARY');
  console.log('='.repeat(60));
  
  if (result.success !== undefined) {
    console.log(`✅ Successful claims: ${result.success}`);
    console.log(`❌ Failed claims: ${result.failed}`);
  } else if (result.success) {
    console.log('✅ Claim successful');
  } else {
    console.log('❌ Claim failed');
  }

  if ((result.success || 0) === 0 && !result.success) {
    console.log('\n💡 No fees claimed. Possible reasons:');
    console.log('   1. No swaps have been completed using your referral link yet');
    console.log('   2. Fee token accounts haven\'t been created yet');
    console.log('   3. All fees have already been claimed');
    console.log('\n📝 Make sure someone completes a swap with your referral link first!');
  }

  console.log('\n✨ Done!\n');
}

main().catch(console.error);
