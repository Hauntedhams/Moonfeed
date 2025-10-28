import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../config/api';
import './AffiliateAdminDashboard.css';

/**
 * Affiliate Admin Dashboard
 * Manage affiliates, view earnings, and process payouts
 */
const AffiliateAdminDashboard = () => {
  const [activeView, setActiveView] = useState('affiliates'); // 'affiliates', 'trades', 'payouts'
  const [affiliates, setAffiliates] = useState([]);
  const [trades, setTrades] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [platformEarnings, setPlatformEarnings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  
  // New affiliate form
  const [newAffiliate, setNewAffiliate] = useState({
    code: '',
    name: '',
    walletAddress: '',
    sharePercentage: 50,
    email: '',
    telegram: ''
  });

  // Load data on mount
  useEffect(() => {
    loadAffiliates();
    loadPlatformEarnings();
  }, []);

  // Load affiliates
  const loadAffiliates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/affiliates/list`);
      const data = await response.json();
      
      if (data.success) {
        setAffiliates(data.affiliates);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load platform earnings
  const loadPlatformEarnings = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/affiliates/platform/earnings`);
      const data = await response.json();
      
      if (data.success) {
        setPlatformEarnings(data.platformEarnings);
      }
    } catch (err) {
      console.error('Error loading platform earnings:', err);
    }
  };

  // Load all trades
  const loadAllTrades = async (payoutStatus = null) => {
    try {
      setLoading(true);
      const url = payoutStatus 
        ? `${API_CONFIG.BASE_URL}/api/affiliates/trades/all?payoutStatus=${payoutStatus}`
        : `${API_CONFIG.BASE_URL}/api/affiliates/trades/all`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setTrades(data.trades);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load all payouts
  const loadAllPayouts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/affiliates/payouts/all`);
      const data = await response.json();
      
      if (data.success) {
        setPayouts(data.payouts);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create new affiliate
  const handleCreateAffiliate = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/affiliates/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAffiliate)
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Affiliate "${newAffiliate.name}" created successfully!`);
        setNewAffiliate({
          code: '',
          name: '',
          walletAddress: '',
          sharePercentage: 50,
          email: '',
          telegram: ''
        });
        loadAffiliates();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // View affiliate details
  const viewAffiliateDetails = async (code) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/affiliates/${code}/stats`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedAffiliate(data);
        
        // Load trades for this affiliate
        const tradesResponse = await fetch(`${API_CONFIG.BASE_URL}/api/affiliates/${code}/trades`);
        const tradesData = await tradesResponse.json();
        if (tradesData.success) {
          setTrades(tradesData.trades);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate referral link
  const generateReferralLink = (code) => {
    return `${window.location.origin}?ref=${code}`;
  };

  // Copy referral link
  const copyReferralLink = (code) => {
    const link = generateReferralLink(code);
    navigator.clipboard.writeText(link);
    alert(`✅ Referral link copied: ${link}`);
  };

  // Render affiliates list
  const renderAffiliatesList = () => (
    <div className="affiliates-section">
      <div className="section-header">
        <h2>Affiliates ({affiliates.length})</h2>
        <button onClick={() => setActiveView('new-affiliate')} className="btn-primary">
          + New Affiliate
        </button>
      </div>

      <div className="affiliates-grid">
        {affiliates.map(affiliate => (
          <div key={affiliate.code} className="affiliate-card">
            <div className="affiliate-header">
              <h3>{affiliate.name}</h3>
              <span className={`status ${affiliate.status}`}>{affiliate.status}</span>
            </div>
            
            <div className="affiliate-stats">
              <div className="stat">
                <span className="stat-label">Code</span>
                <span className="stat-value">{affiliate.code}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Share</span>
                <span className="stat-value">{affiliate.sharePercentage}%</span>
              </div>
              <div className="stat">
                <span className="stat-label">Total Earned</span>
                <span className="stat-value">${affiliate.totalEarned.toFixed(2)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Total Volume</span>
                <span className="stat-value">${affiliate.totalVolume.toLocaleString()}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Trades</span>
                <span className="stat-value">{affiliate.totalTrades}</span>
              </div>
            </div>

            <div className="affiliate-wallet">
              <span className="wallet-label">Wallet:</span>
              <span className="wallet-address">{affiliate.walletAddress.slice(0, 8)}...{affiliate.walletAddress.slice(-8)}</span>
            </div>

            <div className="affiliate-actions">
              <button 
                onClick={() => viewAffiliateDetails(affiliate.code)}
                className="btn-secondary"
              >
                View Details
              </button>
              <button 
                onClick={() => copyReferralLink(affiliate.code)}
                className="btn-secondary"
              >
                Copy Link
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render new affiliate form
  const renderNewAffiliateForm = () => (
    <div className="new-affiliate-section">
      <div className="section-header">
        <h2>Create New Affiliate</h2>
        <button onClick={() => setActiveView('affiliates')} className="btn-secondary">
          ← Back
        </button>
      </div>

      <form onSubmit={handleCreateAffiliate} className="affiliate-form">
        <div className="form-group">
          <label>Referral Code *</label>
          <input
            type="text"
            value={newAffiliate.code}
            onChange={(e) => setNewAffiliate({...newAffiliate, code: e.target.value})}
            placeholder="e.g., cryptokid123"
            pattern="[a-zA-Z0-9_-]+"
            required
          />
          <small>Only letters, numbers, hyphens, and underscores</small>
        </div>

        <div className="form-group">
          <label>Name *</label>
          <input
            type="text"
            value={newAffiliate.name}
            onChange={(e) => setNewAffiliate({...newAffiliate, name: e.target.value})}
            placeholder="e.g., CryptoKid"
            required
          />
        </div>

        <div className="form-group">
          <label>Wallet Address *</label>
          <input
            type="text"
            value={newAffiliate.walletAddress}
            onChange={(e) => setNewAffiliate({...newAffiliate, walletAddress: e.target.value})}
            placeholder="Solana wallet address"
            required
          />
        </div>

        <div className="form-group">
          <label>Share Percentage *</label>
          <input
            type="number"
            value={newAffiliate.sharePercentage}
            onChange={(e) => setNewAffiliate({...newAffiliate, sharePercentage: parseInt(e.target.value)})}
            min="1"
            max="100"
            required
          />
          <small>Percentage of net fees (after Jupiter's 20% cut)</small>
        </div>

        <div className="form-group">
          <label>Email (optional)</label>
          <input
            type="email"
            value={newAffiliate.email}
            onChange={(e) => setNewAffiliate({...newAffiliate, email: e.target.value})}
            placeholder="email@example.com"
          />
        </div>

        <div className="form-group">
          <label>Telegram (optional)</label>
          <input
            type="text"
            value={newAffiliate.telegram}
            onChange={(e) => setNewAffiliate({...newAffiliate, telegram: e.target.value})}
            placeholder="@username"
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create Affiliate'}
        </button>
      </form>
    </div>
  );

  // Render affiliate details
  const renderAffiliateDetails = () => (
    <div className="affiliate-details-section">
      <div className="section-header">
        <h2>{selectedAffiliate.affiliate.name} Details</h2>
        <button onClick={() => {
          setSelectedAffiliate(null);
          setActiveView('affiliates');
        }} className="btn-secondary">
          ← Back
        </button>
      </div>

      <div className="stats-overview">
        <div className="stat-card">
          <h4>Total Earnings</h4>
          <p className="stat-big">${selectedAffiliate.stats.totalEarnings.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h4>Pending Earnings</h4>
          <p className="stat-big pending">${selectedAffiliate.stats.pendingEarnings.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h4>Paid Earnings</h4>
          <p className="stat-big paid">${selectedAffiliate.stats.paidEarnings.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h4>Total Volume</h4>
          <p className="stat-big">${selectedAffiliate.stats.totalVolume.toLocaleString()}</p>
        </div>
      </div>

      <div className="trades-list">
        <h3>Recent Trades ({trades.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Volume</th>
              <th>Total Fee</th>
              <th>Influencer Share</th>
              <th>Platform Share</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 10).map(trade => (
              <tr key={trade.tradeId}>
                <td>{new Date(trade.timestamp).toLocaleDateString()}</td>
                <td>${trade.tradeVolume.toFixed(2)}</td>
                <td>${trade.feeEarned.toFixed(4)}</td>
                <td className="influencer-share">${trade.influencerShare.toFixed(4)}</td>
                <td className="platform-share">${trade.platformShare.toFixed(4)}</td>
                <td>
                  <span className={`status ${trade.payoutStatus}`}>
                    {trade.payoutStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="affiliate-admin-dashboard">
      <header className="dashboard-header">
        <h1>🎯 Affiliate Dashboard</h1>
        <div className="header-actions">
          <button 
            onClick={loadAffiliates}
            className={activeView === 'affiliates' ? 'active' : ''}
          >
            Affiliates
          </button>
          <button 
            onClick={() => {
              setActiveView('trades');
              loadAllTrades();
            }}
          >
            All Trades
          </button>
          <button 
            onClick={() => {
              setActiveView('payouts');
              loadAllPayouts();
            }}
          >
            Payouts
          </button>
        </div>
      </header>

      {/* Platform Earnings Summary */}
      {platformEarnings && (
        <div className="platform-earnings-summary">
          <h3>💰 Ultra Wallet Earnings (Platform Share)</h3>
          <div className="platform-stats">
            <div className="platform-stat-card">
              <span className="stat-label">Total Earned</span>
              <span className="stat-value total">${platformEarnings.total.toFixed(2)}</span>
            </div>
            <div className="platform-stat-card">
              <span className="stat-label">Pending</span>
              <span className="stat-value pending">${platformEarnings.pending.toFixed(2)}</span>
            </div>
            <div className="platform-stat-card">
              <span className="stat-label">Paid Out</span>
              <span className="stat-value paid">${platformEarnings.paid.toFixed(2)}</span>
            </div>
            <div className="platform-stat-card">
              <span className="stat-label">Total Trades</span>
              <span className="stat-value">{platformEarnings.tradeCount}</span>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-content">
        {loading && <div className="loading">Loading...</div>}
        {error && <div className="error">Error: {error}</div>}
        
        {!loading && !error && (
          <>
            {activeView === 'affiliates' && renderAffiliatesList()}
            {activeView === 'new-affiliate' && renderNewAffiliateForm()}
            {selectedAffiliate && renderAffiliateDetails()}
          </>
        )}
      </div>
    </div>
  );
};

export default AffiliateAdminDashboard;
