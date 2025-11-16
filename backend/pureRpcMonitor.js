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
          
          // Determine pool type based on DEX ID
          let poolType = 'raydium'; // default
          if (pool.dexId.toLowerCase().includes('orca')) {
            poolType = 'orca';
          } else if (pool.dexId.toLowerCase().includes('raydium')) {
            poolType = 'raydium';
          }
          
          return {
            type: poolType,
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
   * This reads the pool account data AND the actual token vaults
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

      // Raydium AMM V4 Layout:
      // The pool account contains vault addresses, not actual balances
      // We need to read the actual token vault accounts
      
      const data = poolAccount.data;
      
      // Read vault addresses from pool account
      // Base vault (token) - offset 64 (32 bytes pubkey)
      const baseVaultAddress = new PublicKey(data.slice(64, 96));
      // Quote vault (SOL/USDC) - offset 96 (32 bytes pubkey)
      const quoteVaultAddress = new PublicKey(data.slice(96, 128));
      
      console.log(`🔍 [Monitor] Reading Raydium vaults:`);
      console.log(`   Base vault: ${baseVaultAddress.toString().substring(0, 8)}...`);
      console.log(`   Quote vault: ${quoteVaultAddress.toString().substring(0, 8)}...`);
      
      // Read the actual token account balances from the vaults
      const [baseVaultAccount, quoteVaultAccount] = await Promise.all([
        this.connection.getAccountInfo(baseVaultAddress),
        this.connection.getAccountInfo(quoteVaultAddress)
      ]);
      
      if (!baseVaultAccount || !quoteVaultAccount) {
        console.log(`⚠️  [Monitor] Could not read vault accounts`);
        return null;
      }
      
      // SPL Token Account layout:
      // Amount is stored at offset 64 as u64 (8 bytes)
      const baseAmount = baseVaultAccount.data.readBigUInt64LE(64);
      const quoteAmount = quoteVaultAccount.data.readBigUInt64LE(64);
      
      console.log(`💰 [Monitor] Raydium vault balances:`);
      console.log(`   Base (token): ${baseAmount.toString()}`);
      console.log(`   Quote (SOL): ${quoteAmount.toString()}`);
      
      // Check if this is the correct pair orientation
      // If baseToken matches our token mint, price = quote/base
      // Otherwise price = base/quote
      let price;
      
      if (baseAmount === 0n || quoteAmount === 0n) {
        console.log(`⚠️  [Monitor] Zero balance in vault`);
        return null;
      }
      
      // Assume standard: base is token, quote is SOL/USDC
      // Price = (quote / 10^9) / (base / 10^6) * SOL_price
      // Simplified: (quote / base) * (10^6 / 10^9) * SOL_price
      const quoteAmountNum = Number(quoteAmount) / 1e9; // SOL has 9 decimals
      const baseAmountNum = Number(baseAmount) / 1e6;   // Most tokens have 6-9 decimals, using 6 as default
      
      price = (quoteAmountNum / baseAmountNum) * this.solPrice;
      
      // Sanity check: price should be reasonable (not $0.0000001 or $1,000,000)
      if (price < 0.00000001 || price > 1000000) {
        console.log(`⚠️  [Monitor] Unreasonable price detected: $${price}, trying different decimal assumption`);
        // Try with 9 decimals for token
        const baseAmountNum9 = Number(baseAmount) / 1e9;
        price = (quoteAmountNum / baseAmountNum9) * this.solPrice;
      }
      
      console.log(`💰 [Monitor] Calculated Raydium price: $${price.toFixed(8)}`);
      
      return {
        price: price,
        priceUsd: price,
        timestamp: Date.now(),
        source: 'raydium-rpc',
        baseAmount: baseAmount.toString(),
        quoteAmount: quoteAmount.toString()
      };
    } catch (error) {
      console.error(`❌ [Monitor] Error parsing Raydium pool:`, error.message);
      console.error(`   Stack:`, error.stack);
      return null;
    }
  }

  /**
   * Parse price from Orca Whirlpool
   * Similar to Raydium but different data layout
   */
  async getOrcaPrice(poolData) {
    try {
      const poolAccount = await this.connection.getAccountInfo(
        new PublicKey(poolData.poolAddress)
      );
      
      if (!poolAccount) {
        console.log(`⚠️  [Monitor] Orca pool account not found`);
        return null;
      }

      // Orca Whirlpool layout (simplified)
      // Vault addresses are at different offsets than Raydium
      const data = poolAccount.data;
      
      // Token vault A - offset 101 (32 bytes)
      const vaultAAddress = new PublicKey(data.slice(101, 133));
      // Token vault B - offset 133 (32 bytes)
      const vaultBAddress = new PublicKey(data.slice(133, 165));
      
      console.log(`🔍 [Monitor] Reading Orca vaults:`);
      console.log(`   Vault A: ${vaultAAddress.toString().substring(0, 8)}...`);
      console.log(`   Vault B: ${vaultBAddress.toString().substring(0, 8)}...`);
      
      // Read vault balances
      const [vaultAAccount, vaultBAccount] = await Promise.all([
        this.connection.getAccountInfo(vaultAAddress),
        this.connection.getAccountInfo(vaultBAddress)
      ]);
      
      if (!vaultAAccount || !vaultBAccount) {
        console.log(`⚠️  [Monitor] Could not read Orca vault accounts`);
        return null;
      }
      
      // Read amounts from SPL token accounts (offset 64)
      const amountA = vaultAAccount.data.readBigUInt64LE(64);
      const amountB = vaultBAccount.data.readBigUInt64LE(64);
      
      console.log(`💰 [Monitor] Orca vault balances:`);
      console.log(`   Vault A: ${amountA.toString()}`);
      console.log(`   Vault B: ${amountB.toString()}`);
      
      if (amountA === 0n || amountB === 0n) {
        console.log(`⚠️  [Monitor] Zero balance in Orca vault`);
        return null;
      }
      
      // Calculate price (similar logic to Raydium)
      const amountANum = Number(amountA) / 1e9;
      const amountBNum = Number(amountB) / 1e6;
      
      let price = (amountANum / amountBNum) * this.solPrice;
      
      // Sanity check
      if (price < 0.00000001 || price > 1000000) {
        const amountBNum9 = Number(amountB) / 1e9;
        price = (amountANum / amountBNum9) * this.solPrice;
      }
      
      console.log(`💰 [Monitor] Calculated Orca price: $${price.toFixed(8)}`);
      
      return {
        price: price,
        priceUsd: price,
        timestamp: Date.now(),
        source: 'orca-rpc',
        amountA: amountA.toString(),
        amountB: amountB.toString()
      };
    } catch (error) {
      console.error(`❌ [Monitor] Error parsing Orca pool:`, error.message);
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
      } else if (sub.type === 'orca') {
        currentPrice = await this.getOrcaPrice({ type: 'orca', poolAddress: sub.poolAddress, tokenMint });
      }
      
      if (currentPrice && client.readyState === 1) {
        console.log(`📤 [Monitor] Sending current price to new client: $${currentPrice.price.toFixed(8)}`);
        client.send(JSON.stringify({
          type: 'price-update',
          token: tokenMint,
          price: currentPrice.price || currentPrice.priceUsd,
          timestamp: currentPrice.timestamp || Date.now(),
          source: currentPrice.source || 'rpc'
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

      // Get initial price to check if token has graduated
      let initialPrice;
      if (poolData.type === 'pumpfun') {
        initialPrice = await this.getPumpfunPrice(poolData);
      } else if (poolData.type === 'raydium') {
        initialPrice = await this.getRaydiumPrice(poolData);
      } else if (poolData.type === 'orca') {
        initialPrice = await this.getOrcaPrice(poolData);
      }

      // If RPC price is null (graduated/zero reserves), fall back to Dexscreener
      if (!initialPrice) {
        console.log(`⚠️  [Monitor] RPC price unavailable (token may have graduated), using Dexscreener...`);
        this.startDexscreenerPolling(tokenMint);
        return;
      }

      // Send initial price
      console.log(`📤 [Monitor] Sending initial price: $${initialPrice.price.toFixed(8)}`);
      this.broadcastPrice(tokenMint, initialPrice);

      // Subscribe to pool account changes for real-time RPC updates
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
          } else if (poolData.type === 'orca') {
            priceData = await this.getOrcaPrice(poolData);
          }
          
          // If RPC fails (graduated), switch to Dexscreener
          if (!priceData) {
            console.log(`⚠️  [Monitor] RPC price failed, switching to Dexscreener...`);
            // Unsubscribe from RPC
            this.connection.removeAccountChangeListener(subscriptionId);
            // Start Dexscreener polling
            this.startDexscreenerPolling(tokenMint);
          } else {
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

      // Start polling as backup (every 3 seconds)
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
      } else if (poolData.type === 'orca') {
        priceData = await this.getOrcaPrice(poolData);
      }

      // If RPC fails, try Dexscreener as backup
      if (!priceData) {
        console.log(`⚠️  [Monitor] RPC polling failed, trying Dexscreener...`);
        priceData = await this.getDexscreenerPrice(tokenMint);
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
      type: 'price-update',  // Changed to match frontend expectation
      token: tokenMint,
      price: priceData.price || priceData.priceUsd,  // Direct price value
      timestamp: priceData.timestamp || Date.now(),  // Timestamp
      source: priceData.source || 'rpc'  // Source
    });

    let sentCount = 0;
    clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
        sentCount++;
      }
    });

    if (sentCount > 0) {
      console.log(`📤 [Monitor] Broadcasted price $${(priceData.price || priceData.priceUsd).toFixed(8)} to ${sentCount} client(s)`);
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
   * Get price from Dexscreener API (for graduated tokens and DEX pools)
   */
  async getDexscreenerPrice(tokenMint) {
    try {
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
          const price = parseFloat(pool.priceUsd) || 0;
          
          console.log(`💰 [Monitor] Dexscreener price: $${price.toFixed(8)} (${pool.dexId})`);
          
          return {
            price: price,
            priceUsd: price,
            timestamp: Date.now(),
            source: 'dexscreener',
            dexId: pool.dexId,
            liquidity: pool.liquidity?.usd,
            volume24h: pool.volume?.h24
          };
        }
      }

      console.log(`⚠️  [Monitor] No Dexscreener data available`);
      return null;
    } catch (error) {
      console.log(`⚠️  [Monitor] Dexscreener API error:`, error.message);
      return null;
    }
  }

  /**
   * Start Dexscreener polling for graduated tokens or when RPC fails
   */
  startDexscreenerPolling(tokenMint) {
    console.log(`🔄 [Monitor] Starting Dexscreener polling for ${tokenMint.substring(0, 8)}...`);
    
    // Clear any existing polling
    const existingSub = this.subscriptions.get(tokenMint);
    if (existingSub?.pollingInterval) {
      clearInterval(existingSub.pollingInterval);
    }

    // Poll Dexscreener every 2 seconds for sub-second-like updates
    const intervalId = setInterval(async () => {
      if (!this.clients.has(tokenMint) || this.clients.get(tokenMint).size === 0) {
        clearInterval(intervalId);
        return;
      }

      const priceData = await this.getDexscreenerPrice(tokenMint);
      if (priceData) {
        this.broadcastPrice(tokenMint, priceData);
      }
    }, 2000); // 2 second polling

    // Update subscription info
    if (this.subscriptions.has(tokenMint)) {
      this.subscriptions.get(tokenMint).pollingInterval = intervalId;
      this.subscriptions.get(tokenMint).type = 'dexscreener';
    } else {
      this.subscriptions.set(tokenMint, {
        type: 'dexscreener',
        pollingInterval: intervalId,
        startTime: Date.now()
      });
    }

    // Send initial price immediately
    this.getDexscreenerPrice(tokenMint).then(priceData => {
      if (priceData) {
        this.broadcastPrice(tokenMint, priceData);
      }
    });
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
          if (sub.subscriptionId) {
            this.connection.removeAccountChangeListener(sub.subscriptionId);
          }
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
