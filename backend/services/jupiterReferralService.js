/**
 * Jupiter Referral Service
 * Manages referral accounts and token accounts for collecting Jupiter swap fees
 * 
 * Your Referral Account: 42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt
 * Fee Rate: 100 BPS (1%)
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');

class JupiterReferralService {
  constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    
    // Your referral account from .env
    this.referralAccount = process.env.JUPITER_REFERRAL_ACCOUNT || '42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt';
    this.feeBps = parseInt(process.env.JUPITER_REFERRAL_FEE_BPS || '100'); // 1%
    
    console.log(`🪐 Jupiter Referral Service initialized`);
    console.log(`   📋 Referral Account: ${this.referralAccount}`);
    console.log(`   💰 Fee Rate: ${this.feeBps} BPS (${this.feeBps / 100}%)`);
  }

  /**
   * Get referral token account for a specific token mint
   * This is where your fees will be collected for each token
   */
  async getReferralTokenAccount(tokenMint) {
    try {
      const referralPubkey = new PublicKey(this.referralAccount);
      const mintPubkey = new PublicKey(tokenMint);
      
      // Get the Associated Token Account (ATA) for this mint
      const tokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        referralPubkey,
        false // allowOwnerOffCurve
      );
      
      return tokenAccount.toBase58();
    } catch (error) {
      console.error('❌ Error getting referral token account:', error);
      throw error;
    }
  }

  /**
   * Get referral configuration for Jupiter API
   * Returns the feeAccount parameter needed for Jupiter swap requests
   */
  async getReferralConfig(outputMint) {
    try {
      const tokenAccount = await this.getReferralTokenAccount(outputMint);
      
      return {
        referralAccount: this.referralAccount,
        feeAccount: tokenAccount,
        feeBps: this.feeBps
      };
    } catch (error) {
      console.error('❌ Error getting referral config:', error);
      return null;
    }
  }

  /**
   * Check if a token account exists for fee collection
   */
  async checkTokenAccountExists(tokenMint) {
    try {
      const tokenAccount = await this.getReferralTokenAccount(tokenMint);
      const accountInfo = await this.connection.getAccountInfo(new PublicKey(tokenAccount));
      
      return {
        exists: accountInfo !== null,
        tokenAccount,
        tokenMint
      };
    } catch (error) {
      console.error('❌ Error checking token account:', error);
      return {
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Get accumulated fees for a specific token
   */
  async getAccumulatedFees(tokenMint) {
    try {
      const tokenAccount = await this.getReferralTokenAccount(tokenMint);
      const accountInfo = await this.connection.getAccountInfo(new PublicKey(tokenAccount));
      
      if (!accountInfo) {
        return {
          tokenMint,
          balance: 0,
          exists: false
        };
      }

      // Parse token account data to get balance
      // Token account layout: 
      // - mint: 32 bytes
      // - owner: 32 bytes  
      // - amount: 8 bytes (u64)
      const data = accountInfo.data;
      const amount = data.readBigUInt64LE(64); // Balance is at offset 64
      
      return {
        tokenMint,
        tokenAccount,
        balance: amount.toString(),
        exists: true,
        raw: accountInfo
      };
    } catch (error) {
      console.error('❌ Error getting accumulated fees:', error);
      return {
        tokenMint,
        balance: 0,
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Get referral link for Jupiter swap UI
   * Users can use this link to trade with your referral
   */
  getReferralLink(tokenMint) {
    const params = new URLSearchParams({
      referral: this.referralAccount,
      feeBps: this.feeBps.toString(),
      outputMint: tokenMint
    });
    
    return `https://jup.ag/swap/${tokenMint}?${params.toString()}`;
  }

  /**
   * Validate referral account format
   */
  isValidReferralAccount() {
    try {
      new PublicKey(this.referralAccount);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get referral account info
   */
  async getReferralAccountInfo() {
    try {
      if (!this.isValidReferralAccount()) {
        throw new Error('Invalid referral account');
      }

      const pubkey = new PublicKey(this.referralAccount);
      const accountInfo = await this.connection.getAccountInfo(pubkey);
      
      return {
        address: this.referralAccount,
        exists: accountInfo !== null,
        feeBps: this.feeBps,
        lamports: accountInfo?.lamports || 0,
        owner: accountInfo?.owner?.toBase58() || null
      };
    } catch (error) {
      console.error('❌ Error getting referral account info:', error);
      return {
        address: this.referralAccount,
        exists: false,
        error: error.message
      };
    }
  }
}

// Singleton instance
let instance = null;

function getJupiterReferralService() {
  if (!instance) {
    instance = new JupiterReferralService();
  }
  return instance;
}

module.exports = {
  JupiterReferralService,
  getJupiterReferralService
};
