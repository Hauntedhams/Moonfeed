/**
 * Affiliate System Storage
 * Manages affiliates and trade tracking using file-based storage
 */

const fs = require('fs').promises;
const path = require('path');

class AffiliateStorage {
  constructor() {
    this.storageDir = path.join(__dirname, '../storage/affiliates');
    this.affiliatesFile = path.join(this.storageDir, 'affiliates.json');
    this.tradesFile = path.join(this.storageDir, 'trades.json');
    this.payoutsFile = path.join(this.storageDir, 'payouts.json');
    
    this.affiliates = new Map(); // code -> affiliate data
    this.trades = []; // array of trade records
    this.payouts = []; // array of payout records
    
    this.initialized = false;
  }

  /**
   * Initialize storage (create directories and load data)
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storageDir, { recursive: true });
      
      // Load existing data
      await this.loadAffiliates();
      await this.loadTrades();
      await this.loadPayouts();
      
      this.initialized = true;
      console.log('✅ Affiliate storage initialized');
      console.log(`📊 Loaded: ${this.affiliates.size} affiliates, ${this.trades.length} trades, ${this.payouts.length} payouts`);
    } catch (error) {
      console.error('❌ Error initializing affiliate storage:', error);
      throw error;
    }
  }

  /**
   * Load affiliates from file
   */
  async loadAffiliates() {
    try {
      const data = await fs.readFile(this.affiliatesFile, 'utf8');
      const affiliatesArray = JSON.parse(data);
      this.affiliates = new Map(affiliatesArray.map(a => [a.code, a]));
      console.log(`📥 Loaded ${this.affiliates.size} affiliates`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📝 No affiliates file found, starting fresh');
        this.affiliates = new Map();
        await this.saveAffiliates();
      } else {
        throw error;
      }
    }
  }

  /**
   * Save affiliates to file
   */
  async saveAffiliates() {
    try {
      const affiliatesArray = Array.from(this.affiliates.values());
      await fs.writeFile(this.affiliatesFile, JSON.stringify(affiliatesArray, null, 2));
      console.log(`💾 Saved ${affiliatesArray.length} affiliates`);
    } catch (error) {
      console.error('❌ Error saving affiliates:', error);
      throw error;
    }
  }

  /**
   * Load trades from file
   */
  async loadTrades() {
    try {
      const data = await fs.readFile(this.tradesFile, 'utf8');
      this.trades = JSON.parse(data);
      console.log(`📥 Loaded ${this.trades.length} trades`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📝 No trades file found, starting fresh');
        this.trades = [];
        await this.saveTrades();
      } else {
        throw error;
      }
    }
  }

  /**
   * Save trades to file
   */
  async saveTrades() {
    try {
      await fs.writeFile(this.tradesFile, JSON.stringify(this.trades, null, 2));
      console.log(`💾 Saved ${this.trades.length} trades`);
    } catch (error) {
      console.error('❌ Error saving trades:', error);
      throw error;
    }
  }

  /**
   * Load payouts from file
   */
  async loadPayouts() {
    try {
      const data = await fs.readFile(this.payoutsFile, 'utf8');
      this.payouts = JSON.parse(data);
      console.log(`📥 Loaded ${this.payouts.length} payouts`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📝 No payouts file found, starting fresh');
        this.payouts = [];
        await this.savePayouts();
      } else {
        throw error;
      }
    }
  }

  /**
   * Save payouts to file
   */
  async savePayouts() {
    try {
      await fs.writeFile(this.payoutsFile, JSON.stringify(this.payouts, null, 2));
      console.log(`💾 Saved ${this.payouts.length} payouts`);
    } catch (error) {
      console.error('❌ Error saving payouts:', error);
      throw error;
    }
  }

  // ==================== AFFILIATE METHODS ====================

  /**
   * Create a new affiliate
   */
  async createAffiliate({ code, name, walletAddress, sharePercentage = 50, email = null, telegram = null }) {
    await this.initialize();

    if (this.affiliates.has(code)) {
      throw new Error(`Affiliate code "${code}" already exists`);
    }

    const affiliate = {
      code,
      name,
      walletAddress,
      sharePercentage,
      email,
      telegram,
      totalEarned: 0,
      totalVolume: 0,
      totalTrades: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.affiliates.set(code, affiliate);
    await this.saveAffiliates();

    console.log(`✅ Created affiliate: ${name} (${code})`);
    return affiliate;
  }

  /**
   * Get affiliate by code
   */
  async getAffiliate(code) {
    await this.initialize();
    return this.affiliates.get(code) || null;
  }

  /**
   * Get all affiliates
   */
  async getAllAffiliates() {
    await this.initialize();
    return Array.from(this.affiliates.values());
  }

  /**
   * Update affiliate
   */
  async updateAffiliate(code, updates) {
    await this.initialize();

    const affiliate = this.affiliates.get(code);
    if (!affiliate) {
      throw new Error(`Affiliate "${code}" not found`);
    }

    const updatedAffiliate = {
      ...affiliate,
      ...updates,
      code: affiliate.code, // Don't allow code change
      updatedAt: new Date().toISOString()
    };

    this.affiliates.set(code, updatedAffiliate);
    await this.saveAffiliates();

    console.log(`✅ Updated affiliate: ${code}`);
    return updatedAffiliate;
  }

  /**
   * Delete affiliate
   */
  async deleteAffiliate(code) {
    await this.initialize();

    if (!this.affiliates.has(code)) {
      throw new Error(`Affiliate "${code}" not found`);
    }

    this.affiliates.delete(code);
    await this.saveAffiliates();

    console.log(`✅ Deleted affiliate: ${code}`);
    return true;
  }

  // ==================== TRADE METHODS ====================

  /**
   * Record a new trade
   */
  async recordTrade({
    referralCode,
    userWallet,
    tradeVolume,
    feeEarned,
    tokenIn,
    tokenOut,
    transactionSignature = null,
    metadata = {}
  }) {
    await this.initialize();

    // Validate affiliate exists
    const affiliate = this.affiliates.get(referralCode);
    if (!affiliate) {
      console.warn(`⚠️ Trade recorded with unknown referral code: ${referralCode}`);
    }

    // Calculate shares
    const jupiterCut = feeEarned * 0.20; // Jupiter takes 20%
    const netFee = feeEarned - jupiterCut;
    const influencerShare = affiliate ? (netFee * (affiliate.sharePercentage / 100)) : 0;
    const platformShare = netFee - influencerShare;

    const trade = {
      tradeId: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      referralCode,
      influencerWallet: affiliate?.walletAddress || null,
      influencerName: affiliate?.name || null,
      userWallet,
      tradeVolume,
      feeEarned,
      jupiterCut,
      netFee,
      influencerShare,
      platformShare,
      tokenIn,
      tokenOut,
      transactionSignature,
      metadata,
      payoutStatus: 'pending',
      payoutId: null,
      timestamp: new Date().toISOString()
    };

    this.trades.push(trade);
    await this.saveTrades();

    // Update affiliate stats
    if (affiliate) {
      await this.updateAffiliate(referralCode, {
        totalEarned: affiliate.totalEarned + influencerShare,
        totalVolume: affiliate.totalVolume + tradeVolume,
        totalTrades: affiliate.totalTrades + 1
      });
    }

    console.log(`📊 Trade recorded: ${tradeVolume} volume, ${influencerShare.toFixed(4)} to ${referralCode}`);
    return trade;
  }

  /**
   * Get trades by referral code
   */
  async getTradesByReferral(referralCode, options = {}) {
    await this.initialize();

    let trades = this.trades.filter(t => t.referralCode === referralCode);

    // Filter by payout status
    if (options.payoutStatus) {
      trades = trades.filter(t => t.payoutStatus === options.payoutStatus);
    }

    // Sort by timestamp (newest first)
    trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Pagination
    if (options.limit) {
      const offset = options.offset || 0;
      trades = trades.slice(offset, offset + options.limit);
    }

    return trades;
  }

  /**
   * Get all trades
   */
  async getAllTrades(options = {}) {
    await this.initialize();

    let trades = [...this.trades];

    // Filter by payout status
    if (options.payoutStatus) {
      trades = trades.filter(t => t.payoutStatus === options.payoutStatus);
    }

    // Sort by timestamp (newest first)
    trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Pagination
    if (options.limit) {
      const offset = options.offset || 0;
      trades = trades.slice(offset, offset + options.limit);
    }

    return trades;
  }

  /**
   * Get pending earnings by referral code
   */
  async getPendingEarnings(referralCode) {
    await this.initialize();

    const pendingTrades = this.trades.filter(
      t => t.referralCode === referralCode && t.payoutStatus === 'pending'
    );

    const totalPending = pendingTrades.reduce((sum, t) => sum + t.influencerShare, 0);

    return {
      referralCode,
      totalPending,
      tradeCount: pendingTrades.length,
      trades: pendingTrades
    };
  }

  // ==================== PAYOUT METHODS ====================

  /**
   * Create a payout
   */
  async createPayout({
    referralCode,
    amount,
    tradeIds,
    transactionSignature = null,
    notes = null
  }) {
    await this.initialize();

    const affiliate = this.affiliates.get(referralCode);
    if (!affiliate) {
      throw new Error(`Affiliate "${referralCode}" not found`);
    }

    const payout = {
      payoutId: `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      referralCode,
      influencerWallet: affiliate.walletAddress,
      influencerName: affiliate.name,
      amount,
      tradeIds,
      tradeCount: tradeIds.length,
      transactionSignature,
      notes,
      status: transactionSignature ? 'completed' : 'pending',
      createdAt: new Date().toISOString(),
      completedAt: transactionSignature ? new Date().toISOString() : null
    };

    this.payouts.push(payout);
    await this.savePayouts();

    // Mark trades as paid
    if (transactionSignature) {
      await this.markTradesAsPaid(tradeIds, payout.payoutId);
    }

    console.log(`💰 Payout created: ${amount} to ${referralCode} (${tradeIds.length} trades)`);
    return payout;
  }

  /**
   * Mark trades as paid
   */
  async markTradesAsPaid(tradeIds, payoutId) {
    await this.initialize();

    this.trades = this.trades.map(trade => {
      if (tradeIds.includes(trade.tradeId)) {
        return {
          ...trade,
          payoutStatus: 'paid',
          payoutId,
          paidAt: new Date().toISOString()
        };
      }
      return trade;
    });

    await this.saveTrades();
    console.log(`✅ Marked ${tradeIds.length} trades as paid (payout: ${payoutId})`);
  }

  /**
   * Get payouts by referral code
   */
  async getPayoutsByReferral(referralCode, options = {}) {
    await this.initialize();

    let payouts = this.payouts.filter(p => p.referralCode === referralCode);

    // Sort by createdAt (newest first)
    payouts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    if (options.limit) {
      const offset = options.offset || 0;
      payouts = payouts.slice(offset, offset + options.limit);
    }

    return payouts;
  }

  /**
   * Get all payouts
   */
  async getAllPayouts(options = {}) {
    await this.initialize();

    let payouts = [...this.payouts];

    // Sort by createdAt (newest first)
    payouts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    if (options.limit) {
      const offset = options.offset || 0;
      payouts = payouts.slice(offset, offset + options.limit);
    }

    return payouts;
  }

  /**
   * Get affiliate statistics
   */
  async getAffiliateStats(referralCode) {
    await this.initialize();

    const affiliate = this.affiliates.get(referralCode);
    if (!affiliate) {
      throw new Error(`Affiliate "${referralCode}" not found`);
    }

    const allTrades = this.trades.filter(t => t.referralCode === referralCode);
    const pendingTrades = allTrades.filter(t => t.payoutStatus === 'pending');
    const paidTrades = allTrades.filter(t => t.payoutStatus === 'paid');

    const pendingEarnings = pendingTrades.reduce((sum, t) => sum + t.influencerShare, 0);
    const paidEarnings = paidTrades.reduce((sum, t) => sum + t.influencerShare, 0);

    return {
      affiliate,
      stats: {
        totalTrades: allTrades.length,
        totalVolume: affiliate.totalVolume,
        totalEarnings: affiliate.totalEarned,
        pendingEarnings,
        paidEarnings,
        pendingTradeCount: pendingTrades.length,
        paidTradeCount: paidTrades.length
      }
    };
  }
}

module.exports = new AffiliateStorage();
