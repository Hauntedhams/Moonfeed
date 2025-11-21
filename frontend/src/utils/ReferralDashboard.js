/**
 * Referral Dashboard Utility
 * Use this to track and display referral earnings
 */

class ReferralDashboard {
  constructor(backendUrl = 'http://localhost:3001') {
    this.backendUrl = backendUrl;
  }

  /**
   * Fetch referral account information
   */
  async getReferralInfo() {
    const response = await fetch(`${this.backendUrl}/api/jupiter/referral/info`);
    const data = await response.json();
    return data;
  }

  /**
   * Get fee earnings for a specific token
   */
  async getTokenFees(tokenMint) {
    const response = await fetch(`${this.backendUrl}/api/jupiter/referral/fees/${tokenMint}`);
    const data = await response.json();
    return data;
  }

  /**
   * Get fee earnings for multiple tokens
   */
  async getMultipleTokenFees(tokenMints) {
    const promises = tokenMints.map(mint => this.getTokenFees(mint));
    const results = await Promise.all(promises);
    
    return results
      .filter(r => r.success && r.exists && r.balance !== '0')
      .map(r => ({
        tokenMint: r.tokenMint,
        balance: r.balance,
        tokenAccount: r.tokenAccount
      }));
  }

  /**
   * Format balance with decimals
   */
  formatBalance(balance, decimals = 9) {
    const num = parseFloat(balance) / Math.pow(10, decimals);
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 6 
    });
  }

  /**
   * Get referral link for a token
   */
  getReferralLink(tokenMint) {
    return fetch(`${this.backendUrl}/api/jupiter/referral/link/${tokenMint}`)
      .then(res => res.json());
  }

  /**
   * Display earnings summary in console
   */
  async displayEarnings(tokenMints) {
    console.log('💰 Referral Earnings Summary');
    console.log('═══════════════════════════════════════');
    
    const earnings = await this.getMultipleTokenFees(tokenMints);
    
    if (earnings.length === 0) {
      console.log('No earnings yet. Keep promoting your platform!');
      return;
    }

    earnings.forEach(earning => {
      console.log(`\n🪙 Token: ${earning.tokenMint}`);
      console.log(`   Balance: ${this.formatBalance(earning.balance)}`);
      console.log(`   Account: ${earning.tokenAccount}`);
    });
    
    console.log('\n═══════════════════════════════════════');
  }
}

export default ReferralDashboard;

// Example usage in a React component:
/*
import { useEffect, useState } from 'react';
import ReferralDashboard from './utils/ReferralDashboard';

function MyReferralDashboard() {
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const dashboard = new ReferralDashboard('http://localhost:3001');
    
    const popularTokens = [
      'So11111111111111111111111111111111111111112', // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    ];
    
    dashboard.getMultipleTokenFees(popularTokens)
      .then(setEarnings)
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) return <div>Loading earnings...</div>;
  
  return (
    <div className="referral-dashboard">
      <h2>💰 Your Referral Earnings</h2>
      {earnings.length === 0 ? (
        <p>No earnings yet. Start promoting!</p>
      ) : (
        earnings.map(earning => (
          <div key={earning.tokenMint} className="earning-item">
            <div className="token-mint">{earning.tokenMint.substring(0, 8)}...</div>
            <div className="balance">{dashboard.formatBalance(earning.balance)}</div>
          </div>
        ))
      )}
    </div>
  );
}
*/
