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
 * After claiming, fees are automatically transferred to the destination wallet.
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

const { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } = require('@solana/web3.js');
const { ReferralProvider } = require('@jup-ag/referral-sdk');
const { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');

// Configuration
const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const REFERRAL_ACCOUNT = '42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt'; // Your Ultra referral account

// 🎯 DESTINATION WALLET - Where all claimed fees will be sent
const DESTINATION_WALLET = '34GAnxxnJQpSbPbe7sbgDTdBzBD4Hq74bSZicZiyRpmd';

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

/**
 * Transfer tokens from source wallet to destination wallet
 */
async function transferTokensToDestination(connection, sourceWallet, tokenMint, destinationAddress) {
  try {
    const mintPubkey = new PublicKey(tokenMint);
    const destinationPubkey = new PublicKey(destinationAddress);
    
    // Get source token account
    const sourceTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      sourceWallet.publicKey
    );
    
    // Check source balance
    let sourceBalance;
    try {
      const accountInfo = await getAccount(connection, sourceTokenAccount);
      sourceBalance = accountInfo.amount;
    } catch (error) {
      console.log(`   ℹ️  No balance to transfer for this token`);
      return { success: false, reason: 'no_balance' };
    }
    
    if (sourceBalance === BigInt(0)) {
      console.log(`   ℹ️  Zero balance, nothing to transfer`);
      return { success: false, reason: 'zero_balance' };
    }
    
    console.log(`   💰 Found ${sourceBalance.toString()} tokens to transfer`);
    
    // Get or create destination token account
    const destinationTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      destinationPubkey
    );
    
    const transaction = new Transaction();
    
    // Check if destination token account exists
    try {
      await getAccount(connection, destinationTokenAccount);
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`   📝 Creating token account for destination wallet...`);
      transaction.add(
        createAssociatedTokenAccountInstruction(
          sourceWallet.publicKey, // payer
          destinationTokenAccount, // ata
          destinationPubkey, // owner
          mintPubkey // mint
        )
      );
    }
    
    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        sourceTokenAccount, // source
        destinationTokenAccount, // destination
        sourceWallet.publicKey, // owner
        sourceBalance // amount
      )
    );
    
    // Send transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = sourceWallet.publicKey;
    
    const signature = await sendAndConfirmTransaction(connection, transaction, [sourceWallet]);
    
    console.log(`   ✅ Transferred to ${DESTINATION_WALLET}`);
    console.log(`   🔗 Signature: ${signature}`);
    
    return { success: true, signature, amount: sourceBalance.toString() };
  } catch (error) {
    console.error(`   ❌ Transfer failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

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
      return { success: 0, failed: 0, results: [], transferred: 0 };
    }

    console.log(`📦 Found ${claimTransactions.length} token(s) with fees to claim\n`);

    let successCount = 0;
    let failedCount = 0;
    let transferredCount = 0;
    const results = [];
    const claimedTokens = []; // Track which tokens were claimed for transfer

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
        
        // Mark for transfer - we'll transfer all common tokens
        claimedTokens.push(i);
      } catch (error) {
        console.error(`❌ Claim failed: ${error.message}\n`);
        failedCount++;
        results.push({ index: i + 1, success: false, error: error.message });
      }
    }

    // After claiming, transfer all tokens to destination wallet
    if (successCount > 0) {
      console.log('\n' + '='.repeat(60));
      console.log(`📤 TRANSFERRING FEES TO DESTINATION WALLET`);
      console.log(`🎯 Destination: ${DESTINATION_WALLET}`);
      console.log('='.repeat(60) + '\n');
      
      // Transfer common tokens (these are the ones most likely to have balances)
      for (const token of TOKENS_TO_CHECK) {
        console.log(`💸 Checking ${token.name}...`);
        const transferResult = await transferTokensToDestination(
          connection, 
          wallet, 
          token.mint, 
          DESTINATION_WALLET
        );
        if (transferResult.success) {
          transferredCount++;
        }
        console.log('');
      }
    }

    return { success: successCount, failed: failedCount, results, transferred: transferredCount };
  } catch (error) {
    console.error(`❌ Error scanning for tokens: ${error.message}\n`);
    return { success: 0, failed: 0, results: [], error: error.message, transferred: 0 };
  }
}

async function claimSpecificToken(referralProvider, wallet, referralAccountPubkey, tokenMint, tokenName, connection) {
  console.log(`🔍 Claiming fees for token: ${tokenName || tokenMint}\n`);
  
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
    
    // After claiming, transfer to destination wallet
    console.log('\n' + '='.repeat(60));
    console.log(`📤 TRANSFERRING TO DESTINATION WALLET`);
    console.log(`🎯 Destination: ${DESTINATION_WALLET}`);
    console.log('='.repeat(60) + '\n');
    
    console.log(`💸 Transferring ${tokenName || 'token'}...`);
    const transferResult = await transferTokensToDestination(
      connection, 
      wallet, 
      tokenMint, 
      DESTINATION_WALLET
    );
    
    return { success: true, signature, transferred: transferResult.success };
  } catch (error) {
    console.error(`❌ Claim failed: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Jupiter Referral Fee Claim Tool (Using Official SDK)\n');
  console.log('='.repeat(60));
  console.log('📍 Referral Account:', REFERRAL_ACCOUNT);
  console.log('🎯 Destination Wallet:', DESTINATION_WALLET);
  console.log('='.repeat(60) + '\n');

  // Load wallet from private key
  const privateKeyEnvVar = process.env.ULTRA_WALLET_PRIVATE_KEY || process.env.REFERRAL_ACCOUNT_PRIVATE_KEY;
  
  if (!privateKeyEnvVar) {
    console.error('❌ Error: Private key not found');
    console.log('\n📝 Please create a .env.referral file with:');
    console.log('ULTRA_WALLET_PRIVATE_KEY=your_private_key_here');
    console.log('\nOr add to your existing .env file:');
    console.log('REFERRAL_ACCOUNT_PRIVATE_KEY=your_private_key_here\n');
    console.log('⚠️  This should be the private key for the wallet that owns the referral account\n');
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

  console.log('✅ Signing Wallet loaded:', wallet.publicKey.toBase58());
  console.log('');

  // Initialize connection and SDK
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const referralAccountPubkey = new PublicKey(REFERRAL_ACCOUNT);
  const referralProvider = new ReferralProvider(connection);

  // Check SOL balance for transaction fees
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Signing Wallet SOL Balance: ${(balance / 1e9).toFixed(4)} SOL`);
  
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
    console.log('🌟 Mode: Claim ALL tokens and transfer to destination\n');
    result = await claimAllTokens(referralProvider, wallet, referralAccountPubkey, connection);
  } else if (specificToken) {
    // Try to find the token in TOKENS_TO_CHECK
    const token = TOKENS_TO_CHECK.find(t => 
      t.name.toLowerCase() === specificToken.toLowerCase() || 
      t.mint === specificToken
    );
    
    if (token) {
      console.log(`🌟 Mode: Claim ${token.name} and transfer to destination\n`);
      result = await claimSpecificToken(referralProvider, wallet, referralAccountPubkey, token.mint, token.name, connection);
    } else {
      // Assume it's a mint address
      console.log(`🌟 Mode: Claim specific token and transfer to destination\n`);
      result = await claimSpecificToken(referralProvider, wallet, referralAccountPubkey, specificToken, null, connection);
    }
  } else {
    // Default: Claim all tokens (most convenient)
    console.log('🌟 Mode: Claim ALL tokens and transfer to destination (default)\n');
    console.log('💡 Tip: Use --token <mint> to claim a specific token\n');
    result = await claimAllTokens(referralProvider, wallet, referralAccountPubkey, connection);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 CLAIM & TRANSFER SUMMARY');
  console.log('='.repeat(60));
  console.log(`🎯 Destination: ${DESTINATION_WALLET}`);
  
  if (result.success !== undefined && typeof result.success === 'number') {
    console.log(`✅ Successful claims: ${result.success}`);
    console.log(`❌ Failed claims: ${result.failed}`);
    console.log(`📤 Successful transfers: ${result.transferred || 0}`);
  } else if (result.success) {
    console.log('✅ Claim successful');
    console.log(`📤 Transfer: ${result.transferred ? 'Success' : 'No balance to transfer'}`);
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
