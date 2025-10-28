/**
 * Referral Tracking Utility
 * Handles referral code detection, storage, and trade attribution
 */

import { API_CONFIG } from '../config/api';

const REFERRAL_CODE_KEY = 'moonfeed_referral_code';
const REFERRAL_EXPIRY_KEY = 'moonfeed_referral_expiry';
const REFERRAL_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

class ReferralTracker {
  /**
   * Initialize referral tracking on app load
   * Checks for ?ref= parameter in URL and stores it
   */
  static initialize() {
    try {
      // Check if there's a referral code in the URL
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref');
      
      if (refCode) {
        this.setReferralCode(refCode);
        console.log('🎯 Referral code detected and saved:', refCode);
        
        // Clean up URL (remove ?ref= parameter)
        const url = new URL(window.location);
        url.searchParams.delete('ref');
        window.history.replaceState({}, '', url);
      } else {
        // Check if we have an existing referral code
        const existingCode = this.getReferralCode();
        if (existingCode) {
          console.log('📦 Existing referral code found:', existingCode);
        }
      }
    } catch (error) {
      console.error('❌ Error initializing referral tracking:', error);
    }
  }

  /**
   * Set referral code in localStorage with expiry
   */
  static setReferralCode(code) {
    try {
      localStorage.setItem(REFERRAL_CODE_KEY, code);
      localStorage.setItem(REFERRAL_EXPIRY_KEY, Date.now() + REFERRAL_TTL);
      return true;
    } catch (error) {
      console.error('❌ Error saving referral code:', error);
      return false;
    }
  }

  /**
   * Get referral code from localStorage (if not expired)
   */
  static getReferralCode() {
    try {
      const code = localStorage.getItem(REFERRAL_CODE_KEY);
      const expiry = localStorage.getItem(REFERRAL_EXPIRY_KEY);

      if (!code || !expiry) {
        return null;
      }

      // Check if expired
      if (Date.now() > parseInt(expiry)) {
        console.log('⏰ Referral code expired, clearing...');
        this.clearReferralCode();
        return null;
      }

      return code;
    } catch (error) {
      console.error('❌ Error getting referral code:', error);
      return null;
    }
  }

  /**
   * Clear referral code from localStorage
   */
  static clearReferralCode() {
    try {
      localStorage.removeItem(REFERRAL_CODE_KEY);
      localStorage.removeItem(REFERRAL_EXPIRY_KEY);
      return true;
    } catch (error) {
      console.error('❌ Error clearing referral code:', error);
      return false;
    }
  }

  /**
   * Validate referral code with backend
   */
  static async validateReferralCode(code) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/affiliates/validate/${code}`);
      const data = await response.json();

      if (data.success && data.valid) {
        console.log('✅ Referral code validated:', data.affiliate);
        return {
          valid: true,
          affiliate: data.affiliate
        };
      }

      console.warn('⚠️ Invalid referral code:', code);
      return { valid: false };
    } catch (error) {
      console.error('❌ Error validating referral code:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Track a trade with referral attribution
   * Call this after a successful Jupiter swap
   */
  static async trackTrade({
    userWallet,
    tradeVolume,
    feeEarned,
    tokenIn,
    tokenOut,
    transactionSignature,
    metadata = {}
  }) {
    try {
      const referralCode = this.getReferralCode();

      // If no referral code, don't track
      if (!referralCode) {
        console.log('📊 No referral code, skipping trade tracking');
        return { success: false, reason: 'no_referral_code' };
      }

      console.log(`📊 Tracking trade for referral: ${referralCode}`);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/affiliates/track-trade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          referralCode,
          userWallet,
          tradeVolume,
          feeEarned,
          tokenIn,
          tokenOut,
          transactionSignature,
          metadata
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Trade tracked successfully:', data.trade);
        return { success: true, trade: data.trade };
      }

      console.error('❌ Failed to track trade:', data.error);
      return { success: false, error: data.error };
    } catch (error) {
      console.error('❌ Error tracking trade:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current referral info (for UI display)
   */
  static async getCurrentReferralInfo() {
    const code = this.getReferralCode();

    if (!code) {
      return null;
    }

    const validation = await this.validateReferralCode(code);

    if (validation.valid) {
      return {
        code,
        affiliate: validation.affiliate
      };
    }

    // Invalid code, clear it
    this.clearReferralCode();
    return null;
  }

  /**
   * Generate referral link for an affiliate
   */
  static generateReferralLink(code) {
    const baseUrl = window.location.origin;
    return `${baseUrl}?ref=${code}`;
  }
}

export default ReferralTracker;
