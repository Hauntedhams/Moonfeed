/**
 * Convert Phantom Seed Phrase to Private Key
 * 
 * This script converts your Phantom wallet's recovery phrase (12 or 24 words)
 * into a private key array that can be used with the claim script.
 * 
 * Usage:
 *   node convert-seed-to-key.js "your twelve word seed phrase here..."
 */

const { Keypair } = require('@solana/web3.js');
const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');

// Get seed phrase from command line argument
const seedPhrase = process.argv.slice(2).join(' ');

if (!seedPhrase) {
  console.error('❌ Error: No seed phrase provided\n');
  console.log('Usage:');
  console.log('  node convert-seed-to-key.js "word1 word2 word3 ... word12"');
  console.log('\nExample:');
  console.log('  node convert-seed-to-key.js "apple banana cherry date eagle..."');
  console.log('\n⚠️  Make sure to put the seed phrase in quotes!');
  process.exit(1);
}

console.log('🔐 Converting seed phrase to private key...\n');

try {
  // Validate seed phrase
  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error('Invalid seed phrase. Please check your words and try again.');
  }

  // Convert seed phrase to seed
  const seed = bip39.mnemonicToSeedSync(seedPhrase, '');
  
  // Derive the first account (this is what Phantom uses by default)
  const path = `m/44'/501'/0'/0'`; // Solana derivation path
  const derivedSeed = derivePath(path, seed.toString('hex')).key;
  
  // Create keypair
  const keypair = Keypair.fromSeed(derivedSeed);
  
  // Get private key as array
  const privateKeyArray = Array.from(keypair.secretKey);
  
  console.log('✅ Conversion successful!\n');
  console.log('📋 Wallet Address:');
  console.log(`   ${keypair.publicKey.toBase58()}\n`);
  console.log('🔑 Private Key (copy this entire line):');
  console.log(`   ${JSON.stringify(privateKeyArray)}\n`);
  console.log('📝 Next steps:');
  console.log('   1. Create a file called .env.referral');
  console.log('   2. Add this line to the file:');
  console.log(`      ULTRA_WALLET_PRIVATE_KEY=${JSON.stringify(privateKeyArray)}`);
  console.log('   3. Run: node withdraw-referral-fees.js');
  console.log('\n✅ Done!\n');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.log('\nPlease make sure:');
  console.log('  - Your seed phrase is correct (12 or 24 words)');
  console.log('  - Words are separated by spaces');
  console.log('  - You wrapped the phrase in quotes');
  process.exit(1);
}
