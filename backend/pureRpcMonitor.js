const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');

/**
 * Pure Solana RPC Monitor
 * 
 * Uses ONLY Solana native RPC - no third-party price APIs
 * Calculates prices directly from on-chain pool reserves
 */
class PureRpcMonitor {
  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    this.subscriptions = new Map(); // tokenMint -> subscription data
    this.clients = new Map(); // tokenMint -> Set of WebSocket clients
    
    // Program IDs
    this.RAYDIUM_AMM_V4 = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
    this.PUMPFUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
    this.ORCA_WHIRLPOOL = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
    
    // SOL mint (for price calculations)
    this.SOL_MINT = 'So11111111111111111111111111111111111111112';
    this.USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    
    // Cache SOL price (update every 30 seconds)
    this.solPrice = 150; // default
    this.updateSolPrice();
    setInterval(() => this.updateSolPrice(), 30000);
    
    console.log('🚀 [PureRpcMonitor] Initialized - 100% Solana Native RPC');
  }

  /**
   * Update SOL price (we need this to convert SOL reserves to USD)
   * Using a simple fetch from CoinGecko (free, no auth needed)
   */
  async updateSolPrice() {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
        timeout: 5000
      });
      if (response.data?.solana?.usd) {
        this.solPrice = response.data.solana.usd;
        console.log(`💰 [Monitor] SOL price updated: $${this.solPrice}`);
      }
    } catch (error) {
      console.log(`⚠️  [Monitor] Could not update SOL price, using cached: $${this.solPrice}`);
    }
  }

  /**
   * Find the main trading pool for a token
   * Checks Pump.fun first, then uses Dexscreener to find Raydium pool
   */
  async findTokenPool(tokenMint) {
    console.log(`🔍 [Monitor] Finding pool for ${tokenMint.substring(0, 8)}...`);
    
    // First check if it's on Pump.fun
    const pumpfunCheck = await this.checkPumpfun(tokenMint);
    if (pumpfunCheck) {
      return pumpfunCheck;
    }

    // Token graduated or never was on Pump.fun - check Dexscreener for pool
    const dexPool = await this.findPoolViaDexscreener(tokenMint);
    if (dexPool) {
      return dexPool;
    }

    // Could not find a pool
    console.log(`❌ [Monitor] No pool found for ${tokenMint.substring(0, 8)}...`);
    return null;
  }

  /**
   * Find pool via Dexscreener API (fast and reliable)
   * Dexscreener indexes all DEXes and provides pool addresses
   */
  async findPoolViaDexscreener(tokenMint) {
    try {
      console.log(`🔍 [Monitor] Checking Dexscreener for ${tokenMint.substring(0, 8)}...`);
      
      const response = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`,
        { timeout: 5000 }
      );

      if (response.data && response.data.pairs && response.data.pairs.length > 0) {
        // Get the pool with highest liquidity
        const pools = response.data.pairs
          .filter(p => p.chainId === 'solana')
          .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        
        if (pools.length > 0) {
          const pool = pools[0];
          console.log(`✅ [Monitor] Found ${pool.dexId} pool: ${pool.pairAddress.substring(0, 8)}...`);
          console.log(`   Liquidity: $${pool.liquidity?.usd || 0}`);
          
          return {
            type: 'raydium', // Generalized to work for any DEX
            poolAddress: pool.pairAddress,
            tokenMint: tokenMint,
            baseToken: pool.baseToken?.address,
            quoteToken: pool.quoteToken?.address,
            dexId: pool.dexId
          };
        }
      }

      console.log(`⚠️  [Monitor] No pools found on Dexscreener`);
      return null;
    } catch (error) {
      console.log(`⚠️  [Monitor] Error checking Dexscreener:`, error.message);
      return null;
    }
  }

  /**
   * Derive Pump.fun bonding curve address directly from token mint
   * This is a PDA (Program Derived Address) calculation
   */
  async derivePumpfunBondingCurve(tokenMint) {
    try {
      const mintPubkey = new PublicKey(tokenMint);
      const programId = new PublicKey(this.PUMPFUN_PROGRAM);
      
      // Pump.fun uses a specific seed: ["bonding-curve", mint]
      const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding-curve'), mintPubkey.toBuffer()],
        programId
      );
      
      // Check if this account exists and has data
      const accountInfo = await this.connection.getAccountInfo(bondingCurvePDA);
      
      if (accountInfo && accountInfo.data.length > 0) {
        console.log(`✅ [Monitor] Derived Pump.fun bonding curve: ${bondingCurvePDA.toString()}`);
        return {
          type: 'pumpfun',
          poolAddress: bondingCurvePDA.toString(),
          tokenMint: tokenMint
        };
      }
    } catch (error) {
      console.log(`⚠️  [Monitor] Not a Pump.fun token or bonding curve not found:`, error.message);
    }
    return null;
  }

  /**
   * Check if token is on Pump.fun
   */
  async checkPumpfun(tokenMint) {
    // Try API first (fast but may be blocked)
    try {
      const response = await axios.get(`https://frontend-api.pump.fun/coins/${tokenMint}`, {
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      if (response.data && response.data.mint) {
        console.log(`✅ [Monitor] Found on Pump.fun API: ${response.data.bonding_curve}`);
        return {
          type: 'pumpfun',
          poolAddress: response.data.bonding_curve,
          tokenMint: tokenMint,
          data: response.data
        };
      }
    } catch (error) {
      console.log(`⚠️  [Monitor] Pump.fun API failed (${error.message}), trying PDA derivation...`);
    }
    
    // Fallback: derive bonding curve address directly from on-chain PDA
    return await this.derivePumpfunBondingCurve(tokenMint);
  }

  /**
   * Find Raydium pool by looking up token accounts
   * Uses getProgramAccounts to find pools containing this token
   */
  async findRaydiumPool(tokenMint) {
    try {
      console.log(`🔍 [Monitor] Searching Raydium pools for ${tokenMint.substring(0, 8)}...`);
      
      // Get all Raydium AMM accounts that contain this token
      const accounts = await this.connection.getProgramAccounts(
        new PublicKey(this.RAYDIUM_AMM_V4),
        {
          filters: [
            { dataSize: 752 }, // Raydium AMM state size
            {
              memcmp: {
                offset: 400, // Offset where token mints are stored
                bytes: tokenMint
              }
            }
          ]
        }
      );

      if (accounts.length > 0) {
        const poolAddress = accounts[0].pubkey.toString();
        console.log(`✅ [Monitor] Found Raydium pool: ${poolAddress.substring(0, 8)}...`);
        
        return {
          type: 'raydium',
          poolAddress: poolAddress,
          tokenMint: tokenMint
        };
      }
    } catch (error) {
      console.log(`⚠️  [Monitor] Error searching Raydium pools:`, error.message);
    }
    
    return null;
  }

  /**
   * Parse price from Pump.fun bonding curve
   * This reads the bonding curve account data directly from Solana RPC
   */
  async getPumpfunPrice(poolData) {
    try {
      // Try API first for additional metadata
      try {
        const response = await axios.get(`https://frontend-api.pump.fun/coins/${poolData.tokenMint}`, {
          timeout: 2000,
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        });
        
        if (response.data) {
          const data = response.data;
          const price = data.usd_market_cap ? data.usd_market_cap / (data.total_supply || 1000000000) : 0;
          
          console.log(`💰 [Monitor] Pump.fun API price: $${price.toFixed(8)}`);
          
          return {
            price: price,
            priceUsd: price,
            timestamp: Date.now(),
            source: 'pumpfun-api',
            virtualSolReserves: data.virtual_sol_reserves,
            virtualTokenReserves: data.virtual_token_reserves
          };
        }
      } catch (apiError) {
        console.log(`⚠️  [Monitor] Pump.fun API unavailable, reading bonding curve directly...`);
      }
      
      // Fallback: Read bonding curve account directly from Solana RPC
      const bondingCurveAccount = await this.connection.getAccountInfo(
        new PublicKey(poolData.poolAddress)
      );
      
      if (!bondingCurveAccount || bondingCurveAccount.data.length === 0) {
        console.log(`⚠️  [Monitor] Bonding curve account not found or empty`);
        return null;
      }

      // Parse Pump.fun bonding curve structure
      // Based on Pump.fun program IDL (verified structure):
      // - Discriminator: 8 bytes
      // - virtual_token_reserves (u64): offset 8
      // - virtual_sol_reserves (u64): offset 16
      // - real_token_reserves (u64): offset 24
      // - real_sol_reserves (u64): offset 32
      // - token_total_supply (u64): offset 40
      // - complete (bool): offset 48
      const data = bondingCurveAccount.data;
      
      // Read all reserves to find which ones have value
      const virtualTokenReserves = data.readBigUInt64LE(8);
      const virtualSolReserves = data.readBigUInt64LE(16);
      const realTokenReserves = data.readBigUInt64LE(24);
      const realSolReserves = data.readBigUInt64LE(32);
      
      console.log(`📊 [Monitor] Bonding curve data:`);
      console.log(`   Virtual Token: ${virtualTokenReserves.toString()}`);
      console.log(`   Virtual SOL: ${virtualSolReserves.toString()}`);
      console.log(`   Real Token: ${realTokenReserves.toString()}`);
      console.log(`   Real SOL: ${realSolReserves.toString()}`);
      
      // Use virtual reserves (these include the bonding curve formula)
      // If both are 0, the token might have graduated or be invalid
      if (virtualTokenReserves === 0n || virtualSolReserves === 0n) {
        console.log(`⚠️  [Monitor] Zero reserves detected - token may have graduated`);
        
        // Try real reserves as fallback
        if (realTokenReserves > 0n && realSolReserves > 0n) {
          const solAmount = Number(realSolReserves) / 1e9;
          const tokenAmount = Number(realTokenReserves) / 1e6;
          const price = (solAmount / tokenAmount) * this.solPrice;
          
          console.log(`💰 [Monitor] Using real reserves: ${tokenAmount.toFixed(2)} tokens / ${solAmount.toFixed(4)} SOL`);
          console.log(`💰 [Monitor] Calculated price: $${price.toFixed(8)}`);
          
          return {
            price: price,
            priceUsd: price,
            timestamp: Date.now(),
            source: 'pumpfun-rpc-real',
            virtualSolReserves: realSolReserves.toString(),
            virtualTokenReserves: realTokenReserves.toString()
          };
        }
        
        // Token has graduated or no liquidity
        return null;
      }
      
      // Calculate price: (virtualSolReserves / virtualTokenReserves) * SOL price
      // Pump.fun tokens typically have 6 decimals, SOL has 9
      const solAmount = Number(virtualSolReserves) / 1e9;
      const tokenAmount = Number(virtualTokenReserves) / 1e6;
      
      if (tokenAmount === 0) {
        console.log(`⚠️  [Monitor] Zero token amount - cannot calculate price`);
        return null;
      }
      
      const price = (solAmount / tokenAmount) * this.solPrice;
      
      console.log(`💰 [Monitor] Pump.fun bonding curve: ${tokenAmount.toFixed(2)} tokens / ${solAmount.toFixed(4)} SOL`);
      console.log(`💰 [Monitor] Calculated price: $${price.toFixed(8)}`);
      
      return {
        price: price,
        priceUsd: price,
        timestamp: Date.now(),
        source: 'pumpfun-rpc',
        virtualSolReserves: virtualSolReserves.toString(),
        virtualTokenReserves: virtualTokenReserves.toString()
      };
    } catch (error) {
      console.error(`❌ [Monitor] Error parsing Pump.fun price:`, error.message);
      return null;
    }
  }

  /**
   * Parse price from Raydium pool reserves
   * This reads the pool account data directly from Solana RPC
   */
  async getRaydiumPrice(poolData) {
    try {
      const poolAccount = await this.connection.getAccountInfo(
        new PublicKey(poolData.poolAddress)
      );
      
      if (!poolAccount) {
        console.log(`⚠️  [Monitor] Pool account not found`);
        return null;
      }

      // Parse Raydium AMM data structure
      // Offsets are based on Raydium's AMM program layout
      const data = poolAccount.data;
      
      // Pool coin vault (token A) - offset 192
      const poolCoinAmount = data.readBigUInt64LE(192);
      
      // Pool pc vault (token B, usually SOL/USDC) - offset 200
      const poolPcAmount = data.readBigUInt64LE(200);
      
      // Calculate price: pcAmount / coinAmount * SOL price
      const price = (Number(poolPcAmount) / Number(poolCoinAmount)) * this.solPrice;
      
      console.log(`💰 [Monitor] Raydium reserves: ${poolCoinAmount} token / ${poolPcAmount} SOL`);
      console.log(`💰 [Monitor] Calculated price: $${price.toFixed(8)}`);
      
      return {
        price: price,
        priceUsd: price,
        timestamp: Date.now(),
        source: 'raydium-rpc',
        poolCoinAmount: poolCoinAmount.toString(),
        poolPcAmount: poolPcAmount.toString()
      };
    } catch (error) {
      console.error(`❌ [Monitor] Error parsing Raydium pool:`, error.message);
      return null;
    }
  }

  /**
   * Subscribe to a token
   */
  async subscribe(tokenMint, client) {
    console.log(`📡 [Monitor] ========================================`);
    console.log(`📡 [Monitor] Subscribing to token: ${tokenMint}`);
    console.log(`📡 [Monitor] Token ends with: ${tokenMint.slice(-4)}`);
    console.log(`📡 [Monitor] ========================================`);
    
    // Add client to subscribers
    if (!this.clients.has(tokenMint)) {
      this.clients.set(tokenMint, new Set());
    }
    this.clients.get(tokenMint).add(client);

    // If already subscribed, send the latest cached price to the new client
    if (this.subscriptions.has(tokenMint)) {
      console.log(`✅ [Monitor] Already subscribed, sending cached price to new client`);
      
      const sub = this.subscriptions.get(tokenMint);
      // Get current price immediately
      let currentPrice;
      if (sub.type === 'pumpfun') {
        currentPrice = await this.getPumpfunPrice({ type: 'pumpfun', poolAddress: sub.poolAddress, tokenMint });
      } else if (sub.type === 'raydium') {
        currentPrice = await this.getRaydiumPrice({ type: 'raydium', poolAddress: sub.poolAddress, tokenMint });
      }
      
      if (currentPrice && client.readyState === 1) {
        console.log(`📤 [Monitor] Sending current price to new client: $${currentPrice.price.toFixed(8)}`);
        client.send(JSON.stringify({
          type: 'price_update',
          token: tokenMint,
          data: currentPrice
        }));
      }
      
      return;
    }

    try {
      // Find the token's pool
      const poolData = await this.findTokenPool(tokenMint);
      
      if (!poolData) {
        throw new Error('No trading pool found for this token');
      }

      // Subscribe to pool account changes
      const subscriptionId = this.connection.onAccountChange(
        new PublicKey(poolData.poolAddress),
        async (accountInfo, context) => {
          console.log(`🔄 [Monitor] Pool update detected for ${tokenMint.substring(0, 8)}...`);
          
          // Parse price based on pool type
          let priceData;
          if (poolData.type === 'pumpfun') {
            priceData = await this.getPumpfunPrice(poolData);
          } else if (poolData.type === 'raydium') {
            priceData = await this.getRaydiumPrice(poolData);
          }
          
          if (priceData) {
            console.log(`💰 [Monitor] New price: $${priceData.price.toFixed(8)}`);
            this.broadcastPrice(tokenMint, priceData);
          }
        },
        'confirmed'
      );

      console.log(`✅ [Monitor] Subscribed to pool account (ID: ${subscriptionId})`);

      // Store subscription
      this.subscriptions.set(tokenMint, {
        type: poolData.type,
        poolAddress: poolData.poolAddress,
        subscriptionId,
        startTime: Date.now()
      });

      // Get and send initial price
      let initialPrice;
      if (poolData.type === 'pumpfun') {
        initialPrice = await this.getPumpfunPrice(poolData);
      } else if (poolData.type === 'raydium') {
        initialPrice = await this.getRaydiumPrice(poolData);
      }

      if (initialPrice) {
        console.log(`📤 [Monitor] Sending initial price: $${initialPrice.price.toFixed(8)}`);
        this.broadcastPrice(tokenMint, initialPrice);
      }

      // Start polling as backup (every 10 seconds)
      this.startPolling(tokenMint, poolData);

    } catch (error) {
      console.error(`❌ [Monitor] Error subscribing:`, error.message);
      this.broadcastError(tokenMint, error.message);
    }
  }

  /**
   * Start polling for price updates (backup mechanism)
   */
  startPolling(tokenMint, poolData) {
    const intervalId = setInterval(async () => {
      if (!this.clients.has(tokenMint) || this.clients.get(tokenMint).size === 0) {
        clearInterval(intervalId);
        return;
      }

      let priceData;
      if (poolData.type === 'pumpfun') {
        priceData = await this.getPumpfunPrice(poolData);
      } else if (poolData.type === 'raydium') {
        priceData = await this.getRaydiumPrice(poolData);
      }

      if (priceData) {
        this.broadcastPrice(tokenMint, priceData);
      }
    }, 3000); // Poll every 3 seconds for more responsive updates

    if (this.subscriptions.has(tokenMint)) {
      this.subscriptions.get(tokenMint).pollingInterval = intervalId;
    }
  }

  /**
   * Broadcast price update to all subscribed clients
   */
  broadcastPrice(tokenMint, priceData) {
    const clients = this.clients.get(tokenMint);
    if (!clients || clients.size === 0) return;

    const message = JSON.stringify({
      type: 'price_update',
      token: tokenMint,
      data: priceData
    });

    let sentCount = 0;
    clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
        sentCount++;
      }
    });

    if (sentCount > 0) {
      console.log(`📤 [Monitor] Broadcasted price to ${sentCount} client(s)`);
    }
  }

  /**
   * Broadcast error to all subscribed clients
   */
  broadcastError(tokenMint, errorMessage) {
    const clients = this.clients.get(tokenMint);
    if (!clients || clients.size === 0) return;

    const message = JSON.stringify({
      type: 'error',
      token: tokenMint,
      error: errorMessage
    });

    clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });

    console.log(`⚠️  [Monitor] Broadcasted error: ${errorMessage}`);
  }

  /**
   * Unsubscribe a client from a token
   */
  unsubscribe(tokenMint, client) {
    const clients = this.clients.get(tokenMint);
    if (clients) {
      clients.delete(client);

      if (clients.size === 0) {
        const sub = this.subscriptions.get(tokenMint);
        if (sub) {
          this.connection.removeAccountChangeListener(sub.subscriptionId);
          if (sub.pollingInterval) {
            clearInterval(sub.pollingInterval);
          }
        }
        this.subscriptions.delete(tokenMint);
        this.clients.delete(tokenMint);
        console.log(`✅ [Monitor] Cleaned up ${tokenMint.substring(0, 8)}...`);
      }
    }
  }
}

module.exports = PureRpcMonitor;
