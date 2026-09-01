import React, { useState, useEffect } from 'react';
import { useWallet as useJupiterWallet } from '@jup-ag/wallet-adapter';
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import WalletConnectOnboarding from './WalletConnectOnboarding';
import { getFullApiUrl } from '../config/api';
import { getTransactions, deleteTransaction, storeTransaction, clearTransactions } from '../utils/transactionStorage';
import { useDemoMode } from '../contexts/DemoModeContext';
import { computeFillStats, getSolUsdPrice } from '../utils/orderFillTracking';
import OrderDetailView from './OrderDetailView';
import './OrdersView.css';

const OrdersView = ({ onCoinClick, onTradeClick }) => {
  // Use Jupiter Wallet Kit adapter for universal wallet connection
  const jupiterWallet = useJupiterWallet();
  const { isDemoMode, demoPublicKey, disableDemoMode } = useDemoMode();

  // Override wallet state when demo mode is active
  const publicKey = isDemoMode ? demoPublicKey : jupiterWallet.publicKey;
  const connected = isDemoMode ? true : (jupiterWallet.connected || false);
  const signTransaction = jupiterWallet.signTransaction;
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'history' | 'holdings'
  const [holdings, setHoldings] = useState([]);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [holdingsError, setHoldingsError] = useState(null);
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [showLimitOrderInfo, setShowLimitOrderInfo] = useState(false);
  const [activeSection, setActiveSection] = useState('orders'); // 'orders' or 'transactions'
  const [selectedOrder, setSelectedOrder] = useState(null); // history order clicked for action popup
  const [orderDetailOrder, setOrderDetailOrder] = useState(null); // active order clicked -> full chart+cancel page
  // Map of tokenMint -> banner URL fetched directly from Dexscreener
  const [coinBanners, setCoinBanners] = useState(new Map());
  // Map of tokenMint -> { symbol, name } for client-side enrichment of address-like symbols
  const [enrichedTokenMeta, setEnrichedTokenMeta] = useState(new Map());
  const [solUsdPrice, setSolUsdPrice] = useState(150);

  // Keep a live-ish SOL/USD price around for converting filled-order values to USD
  useEffect(() => {
    getSolUsdPrice().then(setSolUsdPrice);
  }, []);

  // Horizontal swipe switches between the Active and History tabs.
  const tabSwipeRef = React.useRef(null);

  const handleTabSwipeStart = (e) => {
    const touch = e.touches?.[0];
    tabSwipeRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTabSwipeEnd = (e) => {
    const start = tabSwipeRef.current;
    const touch = e.changedTouches?.[0];
    tabSwipeRef.current = null;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
    setStatusFilter(deltaX < 0 ? 'history' : 'active');
  };


  // Fetch orders or holdings when wallet connects or filter changes
  useEffect(() => {
    const setupOrders = async () => {
      if (connected && publicKey) {
        if (statusFilter === 'holdings') {
          fetchHoldings();
        } else {
          fetchOrders();
          fetchTransactions();
        }
      } else {
        setOrders([]);
        setTransactions([]);
        setHoldings([]);
        
        // Clear order caches on disconnect
        const { clearAllOrderCaches } = await import('../utils/orderCache.js');
        clearAllOrderCaches();
      }
    };
    
    setupOrders();
  }, [connected, publicKey, statusFilter]);

  // Fetch transactions from localStorage AND blockchain (Helius API)
  const fetchTransactions = async () => {
    if (!publicKey) return;
    
    setLoadingTransactions(true);
    try {
      const walletAddress = publicKey.toString();
      
      // Get locally stored transactions first (instant)
      const storedTransactions = getTransactions(walletAddress);
      
      // Show local storage transactions immediately while we fetch from API
      if (storedTransactions.length > 0) {
        setTransactions(storedTransactions);
      }
      
      // Fetch blockchain transactions from backend
      try {
        const response = await fetch(getFullApiUrl(`/api/wallet/${walletAddress}/swaps?limit=50`));
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.transactions && result.transactions.length > 0) {
            console.log(`📡 Fetched ${result.transactions.length} swap transactions from blockchain`);
            
            // Merge blockchain transactions with local storage
            // Update existing ones if they have "Unknown" data, add new ones
            for (const tx of result.transactions) {
              const existing = storedTransactions.find(st => st.signature === tx.signature);
              
              if (!existing) {
                // New transaction - add it
                storeTransaction({
                  walletAddress,
                  signature: tx.signature,
                  type: tx.type,
                  tokenMint: tx.tokenMint,
                  tokenSymbol: tx.tokenSymbol,
                  tokenName: tx.tokenName,
                  tokenImage: tx.tokenImage,
                  inputAmount: tx.inputAmount,
                  outputAmount: tx.outputAmount,
                  inputMint: tx.inputMint,
                  outputMint: tx.outputMint,
                  pricePerToken: tx.pricePerToken,
                  timestamp: tx.timestamp,
                });
              } else {
                // On-chain data is authoritative for side AND amounts — older app versions
                // mis-recorded sells as buys and stored wrong units. Keep richer local metadata.
                const amountsDiffer = (a, b) => {
                  const x = Number(a) || 0;
                  const y = Number(b) || 0;
                  if (y <= 0) return false;
                  return Math.abs(x - y) / y > 0.02;
                };
                const needsRepair =
                  existing.type !== tx.type ||
                  amountsDiffer(existing.inputAmount, tx.inputAmount) ||
                  amountsDiffer(existing.outputAmount, tx.outputAmount) ||
                  (existing.tokenSymbol === 'Unknown' && tx.tokenSymbol !== 'Unknown');
                if (needsRepair) {
                  deleteTransaction(walletAddress, tx.signature);
                  storeTransaction({
                    walletAddress,
                    signature: tx.signature,
                    type: tx.type,
                    tokenMint: tx.tokenMint,
                    tokenSymbol: (tx.tokenSymbol && tx.tokenSymbol !== 'Unknown') ? tx.tokenSymbol : existing.tokenSymbol,
                    tokenName: (tx.tokenName && tx.tokenName !== 'Unknown') ? tx.tokenName : existing.tokenName,
                    tokenImage: tx.tokenImage || existing.tokenImage,
                    inputAmount: tx.inputAmount,
                    outputAmount: tx.outputAmount,
                    inputMint: tx.inputMint,
                    outputMint: tx.outputMint,
                    pricePerToken: tx.pricePerToken || existing.pricePerToken,
                    pricePerTokenUsd: existing.pricePerTokenUsd,
                    timestamp: tx.timestamp || existing.timestamp,
                  });
                }
              }
            }
            
            // Refresh from localStorage (now includes blockchain txs)
            const updatedTransactions = getTransactions(walletAddress);
            setTransactions(updatedTransactions);
          } else if (storedTransactions.length === 0) {
            // No blockchain transactions and no local storage
            setTransactions([]);
          }
        } else {
          // API failed, use local storage only
          console.warn('Failed to fetch blockchain transactions, using local storage only');
          if (storedTransactions.length === 0) {
            setTransactions([]);
          }
        }
      } catch (apiError) {
        console.error('Error fetching blockchain transactions:', apiError);
        // Fallback to local storage (already set above)
        if (storedTransactions.length === 0) {
          setTransactions([]);
        }
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Handle clearing cache and re-fetching fresh data
  const handleClearAndRefresh = async () => {
    if (!publicKey) return;
    
    const walletAddress = publicKey.toString();
    clearTransactions(walletAddress);
    setTransactions([]);
    
    // Fetch fresh from blockchain
    await fetchTransactions();
  };

  // Handle delete transaction
  const handleDeleteTransaction = (signature) => {
    if (!publicKey) return;
    
    const walletAddress = publicKey.toString();
    const deleted = deleteTransaction(walletAddress, signature);
    
    if (deleted) {
      // Refresh transactions list
      fetchTransactions();
    }
  };

  // Fetch token holdings (on-chain balances) for connected wallet
  const fetchHoldings = async () => {
    if (!publicKey) return;
    setLoadingHoldings(true);
    setHoldingsError(null);
    try {
      const walletAddress = publicKey.toString();
      const storedTxs = getTransactions(walletAddress);
      const mintsMap = new Map(); // mint -> { mint, amount, decimals, symbol, name, image }

      // 1. Try to fetch on-chain balances across fallback RPC endpoints
      const RPC_ENDPOINTS = [
        'https://mainnet.helius-rpc.com/?api-key=05a97104-cba1-4284-aed6-e0ad21af8b33',
        'https://rpc.ankr.com/solana',
        'https://api.mainnet-beta.solana.com'
      ];

      for (const rpcUrl of RPC_ENDPOINTS) {
        try {
          const { Connection, PublicKey } = await import('@solana/web3.js');
          const conn = new Connection(rpcUrl, 'confirmed');
          const ownerPk = new PublicKey(walletAddress);

          const [splRes, token2022Res] = await Promise.allSettled([
            conn.getParsedTokenAccountsByOwner(ownerPk, { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }),
            conn.getParsedTokenAccountsByOwner(ownerPk, { programId: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') })
          ]);

          const allAccounts = [];
          if (splRes.status === 'fulfilled' && splRes.value?.value) {
            allAccounts.push(...splRes.value.value);
          }
          if (token2022Res.status === 'fulfilled' && token2022Res.value?.value) {
            allAccounts.push(...token2022Res.value.value);
          }

          if (splRes.status === 'fulfilled' || token2022Res.status === 'fulfilled') {
            for (const item of allAccounts) {
              const info = item.account?.data?.parsed?.info;
              const amount = Number(info?.tokenAmount?.uiAmount) || 0;
              const mint = info?.mint;
              if (amount > 0 && mint) {
                mintsMap.set(mint, {
                  mint,
                  amount,
                  decimals: info?.tokenAmount?.decimals || 6
                });
              }
            }
            break; // RPC call succeeded
          }
        } catch (rpcErr) {
          console.warn(`RPC ${rpcUrl} holdings error:`, rpcErr.message);
        }
      }

      // 2. Incorporate stored transactions to fill any tokens bought in-app
      if (storedTxs && storedTxs.length > 0) {
        const txByMint = {};
        for (const tx of storedTxs) {
          if (!tx.tokenMint) continue;
          if (!txByMint[tx.tokenMint]) txByMint[tx.tokenMint] = { bought: 0, sold: 0, sampleTx: tx };
          const qty = Number(tx.outputAmount) || 0;
          if (!tx.type || tx.type === 'buy') {
            txByMint[tx.tokenMint].bought += qty;
          } else if (tx.type === 'sell') {
            txByMint[tx.tokenMint].sold += Number(tx.inputAmount) || qty;
          }
        }

        for (const [mint, stats] of Object.entries(txByMint)) {
          if (!mintsMap.has(mint)) {
            const netAmount = Math.max(0, stats.bought - stats.sold);
            if (netAmount > 0) {
              mintsMap.set(mint, {
                mint,
                amount: netAmount,
                decimals: 6,
                symbol: stats.sampleTx.tokenSymbol,
                name: stats.sampleTx.tokenName,
                image: stats.sampleTx.tokenImage
              });
            }
          }
        }
      }

      const mintsToFetch = Array.from(mintsMap.values());

      if (mintsToFetch.length === 0) {
        setHoldings([]);
        setLoadingHoldings(false);
        return;
      }

      // 3. Fetch Dexscreener market data for current USD prices & token names/images
      const mintAddrs = mintsToFetch.map(m => m.mint).slice(0, 30).join(',');
      let dexPairs = [];
      try {
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddrs}`);
        if (dexRes.ok) {
          const dexData = await dexRes.json();
          dexPairs = dexData.pairs || [];
        }
      } catch (e) {
        console.warn('Dexscreener holdings fetch warning:', e);
      }

      const list = mintsToFetch.map(item => {
        const pair = dexPairs.find(p => p.baseToken?.address === item.mint);
        const buys = storedTxs.filter(tx => tx.tokenMint === item.mint && (!tx.type || tx.type === 'buy'));
        const latestTx = buys[buys.length - 1] || storedTxs.find(tx => tx.tokenMint === item.mint);

        const symbol = pair?.baseToken?.symbol || item.symbol || latestTx?.tokenSymbol || item.mint.slice(0, 6);
        const name = pair?.baseToken?.name || item.name || latestTx?.tokenName || symbol;
        const image = pair?.info?.imageUrl || pair?.baseToken?.image || item.image || latestTx?.tokenImage || null;
        const priceUsd = parseFloat(pair?.priceUsd || latestTx?.pricePerTokenUsd || 0);

        // Find cost basis from local transaction history
        let costBasisUsd = 0;
        let totalCostUsd = 0;
        let totalCostSol = 0;
        if (buys.length > 0) {
          let totalQty = 0;
          buys.forEach(b => {
            const qty = Number(b.outputAmount) || 0;
            const price = Number(b.pricePerTokenUsd) || (Number(b.pricePerToken) * solUsdPrice) || 0;
            if (qty > 0 && price > 0) {
              totalCostUsd += qty * price;
              totalQty += qty;
            }
            if (Number(b.inputAmount) > 0) {
              totalCostSol += Number(b.inputAmount);
            }
          });
          if (totalQty > 0) costBasisUsd = totalCostUsd / totalQty;
        }

        const effectiveTotalBoughtUsd = totalCostUsd > 0 ? totalCostUsd : (costBasisUsd > 0 ? item.amount * costBasisUsd : 0);
        const currentValueUsd = item.amount * priceUsd;
        const pnlUsd = effectiveTotalBoughtUsd > 0 ? currentValueUsd - effectiveTotalBoughtUsd : null;
        const pnlPct = effectiveTotalBoughtUsd > 0 ? ((currentValueUsd - effectiveTotalBoughtUsd) / effectiveTotalBoughtUsd) * 100 : null;

        return {
          mint: item.mint,
          amount: item.amount,
          symbol,
          name,
          image,
          priceUsd,
          costBasisUsd,
          totalBoughtUsd: effectiveTotalBoughtUsd,
          totalCostSol,
          currentValueUsd,
          pnlUsd,
          pnlPct,
        };
      });

      // Sort by current USD value descending
      list.sort((a, b) => (b.currentValueUsd || 0) - (a.currentValueUsd || 0));
      setHoldings(list);
    } catch (err) {
      console.error('Error fetching holdings:', err);
      // Fallback: If stored transactions exist, present them rather than displaying error
      try {
        const walletAddress = publicKey?.toString?.();
        const storedTxs = walletAddress ? getTransactions(walletAddress) : [];
        if (storedTxs.length > 0) {
          const buys = storedTxs.filter(t => !t.type || t.type === 'buy');
          const fallbackList = [];
          const seen = new Set();
          for (const b of buys) {
            if (!b.tokenMint || seen.has(b.tokenMint)) continue;
            seen.add(b.tokenMint);
            const price = Number(b.pricePerTokenUsd) || (Number(b.pricePerToken) * solUsdPrice) || 0;
            const qty = Number(b.outputAmount) || 0;
            fallbackList.push({
              mint: b.tokenMint,
              amount: qty,
              symbol: b.tokenSymbol || b.tokenMint.slice(0, 6),
              name: b.tokenName || b.tokenSymbol || 'Token',
              image: b.tokenImage || null,
              priceUsd: price,
              costBasisUsd: price,
              totalBoughtUsd: qty * price,
              currentValueUsd: qty * price,
              pnlUsd: 0,
              pnlPct: 0,
            });
          }
          if (fallbackList.length > 0) {
            setHoldings(fallbackList);
            return;
          }
        }
      } catch (_) {}
      setHoldingsError('Could not load on-chain holdings');
    } finally {
      setLoadingHoldings(false);
    }
  };
  const isOrderExpired = (order) => {
    if (!order.expiresAt) return false;
    
    try {
      const expiresAtDate = new Date(order.expiresAt);
      if (isNaN(expiresAtDate.getTime())) return false;
      
      const now = new Date();
      return now > expiresAtDate;
    } catch (err) {
      console.error('Error checking order expiration:', err);
      return false;
    }
  };

  // Fetch banners directly from Dexscreener for each unique token in orders
  const fetchCoinBanners = async (orderList) => {
    const uniqueMints = [...new Set(orderList.map(o => o.tokenMint).filter(Boolean))];
    if (!uniqueMints.length) return;
    const updates = new Map();
    await Promise.all(uniqueMints.map(async (mint) => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        const data = await res.json();
        const pair = data?.pairs?.[0];
        if (pair) {
          const banner = pair.info?.header || pair.info?.imageUrl || null;
          const pairAddress = pair.pairAddress || null;
          const symbol = pair.baseToken?.symbol || null;
          const name = pair.baseToken?.name || null;
          const image = pair.info?.imageUrl || null;
          updates.set(mint, { banner, pairAddress, symbol, name, image });
        }
      } catch (_) { /* silent */ }
    }));
    if (updates.size) setCoinBanners(prev => new Map([...prev, ...updates]));

    // Client-side enrichment: for tokens whose symbol still looks like a truncated address,
    // try Pump.fun to get the real name
    const addressLikeMints = orderList
      .filter(o => o.tokenMint && /^[A-Za-z0-9]{3,6}\.\.\./.test(o.tokenSymbol || ''))
      .map(o => o.tokenMint);
    const uniqueAddressLike = [...new Set(addressLikeMints)];
    if (!uniqueAddressLike.length) return;

    const metaUpdates = new Map();
    await Promise.all(uniqueAddressLike.map(async (mint) => {
      // Try Pump.fun first
      try {
        const res = await fetch(`https://frontend-api.pump.fun/coins/${mint}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.symbol) {
            metaUpdates.set(mint, { symbol: data.symbol, name: data.name || data.symbol });
            return;
          }
        }
      } catch (_) { /* silent */ }
      // Fallback: Jupiter token list
      try {
        const res = await fetch(`https://tokens.jup.ag/token/${mint}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.symbol) {
            metaUpdates.set(mint, { symbol: data.symbol, name: data.name || data.symbol });
          }
        }
      } catch (_) { /* silent */ }
    }));
    if (metaUpdates.size) setEnrichedTokenMeta(prev => new Map([...prev, ...metaUpdates]));
  };

  // Fetch active orders
  const fetchOrders = async () => {
    if (!publicKey) return;
    
    const walletAddress = publicKey.toString();
    
    // Check cache first
    const { getCachedOrders, setCachedOrders } = await import('../utils/orderCache.js');
    const cachedOrders = getCachedOrders(walletAddress, statusFilter);
    
    if (cachedOrders) {
      // Use cached data
      if (statusFilter === 'active') {
        const activeOrders = [];
        const expiredOrders = [];
        
        cachedOrders.forEach(order => {
          if (isOrderExpired(order)) {
            expiredOrders.push(order);
          } else {
            activeOrders.push(order);
          }
        });
        
        if (expiredOrders.length > 0) {
          console.warn(`[Orders] Found ${expiredOrders.length} expired order(s) in cached active orders`);
        }
        
        setOrders(activeOrders);
      } else {
        const enrichedCached = cachedOrders.map(order => ({
          ...order,
          isExpired: isOrderExpired(order)
        }));
        setOrders(enrichedCached);
      }
      
      setLoadingOrders(false);
      setOrdersError(null);
      return; // Exit early, using cache
    }
    
    // No cache, fetch from backend
    setLoadingOrders(true);
    setOrdersError(null);

    try {
      const url = getFullApiUrl(`/api/trigger/orders?wallet=${walletAddress}&status=${statusFilter}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const result = await response.json();
      
      if (result.success) {
        let fetchedOrders = result.orders || [];
        
        // ENRICH ORDERS WITH STORED SIGNATURES FROM LOCALSTORAGE
        const { enrichOrderWithStoredSignatures } = await import('../utils/orderStorage.js');
        fetchedOrders = fetchedOrders.map(order => enrichOrderWithStoredSignatures(order));
        
        // Cache the fetched orders
        setCachedOrders(walletAddress, statusFilter, fetchedOrders);
        
        // CLIENT-SIDE EXPIRATION FILTERING:
        // If viewing "active" orders, filter out expired ones
        if (statusFilter === 'active') {
          const activeOrders = [];
          const expiredOrders = [];
          
          fetchedOrders.forEach(order => {
            if (isOrderExpired(order)) {
              expiredOrders.push(order);
            } else {
              activeOrders.push(order);
            }
          });
          
          // Log expired orders for debugging
          if (expiredOrders.length > 0) {
            console.warn(`[Orders] Found ${expiredOrders.length} expired order(s) in active orders:`, 
              expiredOrders.map(o => ({ orderId: o.orderId, expiresAt: o.expiresAt })));
          }
          
          // Only show non-expired orders in active tab
          setOrders(activeOrders);
          fetchCoinBanners(activeOrders);
        } else {
          // For history tab, mark expired orders with a flag
          fetchedOrders = fetchedOrders.map(order => ({
            ...order,
            isExpired: isOrderExpired(order)
          }));
          
          setOrders(fetchedOrders);
          fetchCoinBanners(fetchedOrders);
        }
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setOrdersError(err.message);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Handle cancel order
  const handleCancelOrder = async (orderId) => {
    if (!publicKey || !signTransaction) {
      alert('Please connect your wallet first');
      return;
    }

    setCancellingOrder(orderId);

    try {
      const walletAddress = publicKey.toString();
      
      // Step 1: Get cancel transaction from backend
      console.log('[Cancel Order] Step 1: Requesting cancel transaction from backend...');
      const response = await fetch(getFullApiUrl('/api/trigger/cancel-order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maker: walletAddress,
          orderId
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create cancel transaction');
      }

      if (!result.transaction) {
        throw new Error('No transaction returned from backend');
      }

      console.log('[Cancel Order] Step 2: Transaction received, requesting wallet signature...');

      // Step 2: Import required Solana libraries and decode transaction
      const { Transaction, VersionedTransaction } = await import('@solana/web3.js');
      
      // Decode the transaction - try both formats
      let transaction;
      let isVersioned = false;
      
      // Browser-safe base64 decode (no Buffer polyfill needed)
      const _b64 = result.transaction;
      const _bin = atob(_b64);
      const transactionBytes = new Uint8Array(_bin.length);
      for (let _i = 0; _i < _bin.length; _i++) transactionBytes[_i] = _bin.charCodeAt(_i);

      try {
        // First, try to decode as versioned transaction (v0)
        console.log('[Cancel Order] Attempting versioned transaction decode...');
        transaction = VersionedTransaction.deserialize(transactionBytes);
        isVersioned = true;
        console.log('[Cancel Order] ✅ Decoded as versioned transaction');
      } catch (versionedError) {
        console.log('[Cancel Order] ❌ Versioned decode failed:', versionedError.message);
        console.log('[Cancel Order] Attempting legacy transaction decode...');
        
        // Fallback to legacy transaction
        try {
          transaction = Transaction.from(transactionBytes);
          console.log('[Cancel Order] ✅ Decoded as legacy transaction');
        } catch (legacyError) {
          console.error('[Cancel Order] ❌ Both decode methods failed:', {
            versionedError: versionedError.message,
            legacyError: legacyError.message
          });
          
          // Provide detailed error with Jupiter link
          const jupiterUrl = `https://jup.ag/limit/${publicKey.toString()}`;
          throw new Error(
            `Failed to decode transaction. This may be a Jupiter API issue.\n\n` +
            `You can cancel this order directly on Jupiter:\n${jupiterUrl}\n\n` +
            `Error details:\n- Versioned: ${versionedError.message}\n- Legacy: ${legacyError.message}`
          );
        }
      }

      // Step 3: Send transaction for signing
      console.log('[Cancel Order] Step 3: Sending transaction to wallet for signing...');
      
      const signedTransaction = await signTransaction(transaction);
      
      // Serialize the signed transaction (browser-safe base64 encode)
      const _serialized = signedTransaction.serialize();
      let _binaryStr = '';
      for (let _i = 0; _i < _serialized.length; _i++) _binaryStr += String.fromCharCode(_serialized[_i]);
      const signedTransactionBase64 = btoa(_binaryStr);

      console.log('[Cancel Order] Step 4: Executing signed transaction...');

      // Step 4: Execute the signed transaction
      const executeResponse = await fetch(getFullApiUrl('/api/trigger/execute'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTransaction: signedTransactionBase64,
          requestId: result.requestId
        })
      });

      const executeResult = await executeResponse.json();

      if (!executeResult.success) {
        throw new Error(executeResult.error || 'Failed to execute cancel transaction');
      }

      console.log('[Cancel Order] ✅ Order cancelled successfully!', executeResult.signature);
      
      // Store cancel signature in localStorage
      if (executeResult.signature && orderId) {
        const { storeOrderSignature } = await import('../utils/orderStorage.js');
        storeOrderSignature({
          orderId,
          signature: executeResult.signature,
          maker: publicKey.toString(),
          orderType: 'cancel'
        });
      }
      
      // Invalidate order cache since we cancelled an order
      const { invalidateOrderCache } = await import('../utils/orderCache.js');
      invalidateOrderCache(publicKey.toString());
      
      // Show success message with transaction link
      const signature = executeResult.signature;
      if (confirm(`Order cancelled successfully!\n\nTransaction: ${signature}\n\nClick OK to view on Solscan`)) {
        window.open(`https://solscan.io/tx/${signature}`, '_blank');
      }

      // Refresh orders
      await fetchOrders();
    } catch (err) {
      console.error('[Cancel Order] ❌ Error:', err);
      
      // Generate Jupiter link for manual cancellation
      const jupiterUrl = `https://jup.ag/limit/${publicKey.toString()}`;
      
      // More detailed error message
      let errorMessage = 'Failed to cancel order: ' + err.message;
      let showJupiterOption = true;
      
      if (err.message.includes('User rejected')) {
        errorMessage = 'Order cancellation was rejected. Please approve the transaction in your wallet to cancel the order.';
        showJupiterOption = false;
      } else if (err.message.includes('Wallet does not support')) {
        errorMessage = 'Your wallet does not support transaction signing. Please use a compatible wallet or cancel on Jupiter.';
      } else if (err.message.includes('decode')) {
        errorMessage = 'Failed to decode the cancellation transaction. This may be a temporary Jupiter API issue.\n\n' +
                      'You can cancel this order directly on Jupiter instead.';
      }
      
      // Show error with option to open Jupiter
      if (showJupiterOption) {
        const openJupiter = confirm(
          errorMessage + '\n\n' +
          'Would you like to open Jupiter to cancel this order manually?\n\n' +
          'Click OK to open Jupiter, or Cancel to try again later.'
        );
        
        if (openJupiter) {
          window.open(jupiterUrl, '_blank');
        }
      } else {
        alert(errorMessage);
      }
    } finally {
      setCancellingOrder(null);
    }
  };

  const formatPrice = (price) => {
    if (!price) return '0';
    const num = parseFloat(price);
    if (num < 0.01) return num.toFixed(6);
    if (num < 1) return num.toFixed(4);
    return num.toFixed(2);
  };

  // Meme-coin USD prices get vanishingly small — keep enough precision to be meaningful.
  const formatUsdPrice = (usd) => {
    const num = Number(usd) || 0;
    if (num === 0) return '$0';
    if (num < 0.000001) return `$${num.toExponential(2)}`;
    if (num < 0.01) return `$${num.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')}`;
    if (num < 1) return `$${num.toFixed(4)}`;
    return `$${num.toFixed(2)}`;
  };

  // Token balances span huge ranges — keep them readable without losing small holdings.
  const formatTokenAmount = (value) => {
    const num = Number(value) || 0;
    if (num >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (num >= 1) return num.toFixed(2);
    return num.toPrecision(3);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';    
    try {
      const date = new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid timestamp:', timestamp);
        return 'Invalid date';
      }
      
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      console.error('Error formatting date:', err, timestamp);
      return 'Invalid date';
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      return 'Unknown';
    }
  };

  if (!connected) {
    return (
      <div className="orders-view">
        <div className="orders-container">
          {/* Wallet Connection Section */}
          <div className="wallet-connection-section">
            <div className="connection-card">
              <h3>Connect Wallet</h3>
              <p>Connect your Solana wallet to view limit orders and your recent meme coin purchases.</p>
              <div className="wallet-button-container">
                <WalletConnectOnboarding>
                  <UnifiedWalletButton />
                </WalletConnectOnboarding>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="orders-view"
      onTouchStart={handleTabSwipeStart}
      onTouchEnd={handleTabSwipeEnd}
    >
      <div className="orders-container">
        {/* Demo Mode banner */}
        {isDemoMode && (
          <div style={{
            background: 'rgba(255,215,0,0.15)',
            border: '1px solid rgba(255,215,0,0.5)',
            borderRadius: '8px',
            padding: '8px 14px',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            color: '#FFD700',
          }}>
            <span>Demo Mode — App Review Access</span>
            <button
              onClick={disableDemoMode}
              style={{ background: 'none', border: 'none', color: '#FFD700', cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>
        )}
        {/* Limit Orders Section */}
        <div className="orders-section">
          <div className="orders-filter">
            <button
              className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active
            </button>
            <button
              className={`filter-btn ${statusFilter === 'history' ? 'active' : ''}`}
              onClick={() => setStatusFilter('history')}
            >
              History
            </button>
            <button
              className={`filter-btn ${statusFilter === 'holdings' ? 'active' : ''}`}
              onClick={() => setStatusFilter('holdings')}
            >
              Holdings
            </button>
          </div>

          {statusFilter === 'holdings' ? (
            loadingHoldings ? (
              <div className="orders-loading">
                <div className="loading-spinner"></div>
                <p>Loading holdings...</p>
              </div>
            ) : holdingsError ? (
              <div className="orders-error">
                <p>⚠️ {holdingsError}</p>
                <button onClick={fetchHoldings} className="retry-btn">Retry</button>
              </div>
            ) : holdings.length === 0 ? (
              <div className="orders-empty">
                <p>No token holdings found</p>
                <span className="empty-hint">Buy meme coins on Moonfeed to track your portfolio holdings here</span>
              </div>
            ) : (
              <div className="holdings-list">
                {holdings.map((item) => {
                  const formatNumber = (num) => {
                    if (!num) return '0';
                    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
                    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
                    return num < 1 ? num.toFixed(4) : num.toFixed(2);
                  };

                  const formatUsd = (num) => {
                    if (num === null || num === undefined) return '—';
                    const v = Number(num);
                    if (!isFinite(v)) return '—';
                    if (v === 0) return '$0.00';
                    if (Math.abs(v) < 0.000001) return `$${v.toExponential(2)}`;
                    if (Math.abs(v) < 0.0001) return `$${v.toFixed(7)}`;
                    if (Math.abs(v) < 0.01) return `$${v.toFixed(6)}`;
                    if (Math.abs(v) < 1) return `$${v.toFixed(4)}`;
                    return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  };

                  return (
                    <div
                      key={item.mint}
                      className="holding-card"
                      onClick={() => onCoinClick?.({
                        mintAddress: item.mint,
                        symbol: item.symbol,
                        name: item.name,
                        image: item.image,
                      })}
                    >
                      <div className="holding-card-left">
                        {item.image ? (
                          <img src={item.image} alt={item.symbol} className="holding-token-img" onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <div className="holding-token-img-ph">{(item.symbol || '?').slice(0, 2).toUpperCase()}</div>
                        )}
                        <div className="holding-token-info">
                          <div className="holding-token-symbol">${item.symbol}</div>
                          <div className="holding-token-name">{item.name}</div>
                          <div className="holding-token-prices">
                            <span className="holding-current-price-tag">
                              Price: <strong>{formatUsd(item.priceUsd)}</strong>
                            </span>
                            <span className="holding-amount-tag">{formatNumber(item.amount)} tokens</span>
                          </div>
                        </div>
                      </div>

                      <div className="holding-card-right">
                        <div className="holding-value-usd">{formatUsd(item.currentValueUsd)}</div>
                        {item.totalBoughtUsd > 0 ? (
                          <div className="holding-bought-highlight">
                            <span className="holding-bought-label">Bought:</span>
                            <span className="holding-bought-val">{formatUsd(item.totalBoughtUsd)}</span>
                          </div>
                        ) : item.costBasisUsd > 0 ? (
                          <div className="holding-bought-highlight">
                            <span className="holding-bought-label">Bought at:</span>
                            <span className="holding-bought-val">{formatUsd(item.costBasisUsd)}</span>
                          </div>
                        ) : null}
                        {item.pnlPct !== null && (
                          <div className={`holding-pnl ${item.pnlPct >= 0 ? 'pos' : 'neg'}`}>
                            {item.pnlPct >= 0 ? '+' : ''}{item.pnlPct.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : loadingOrders ? (
            <div className="orders-loading">
              <div className="loading-spinner"></div>
              <p>Loading orders...</p>
            </div>
          ) : ordersError ? (
            <div className="orders-error">
              <p>⚠️ {ordersError}</p>
              <button onClick={fetchOrders} className="retry-btn">Retry</button>
            </div>
          ) : orders.length === 0 ? (
            <div className="orders-empty">
              <p>No {statusFilter} orders</p>
              <span className="empty-hint">
                {statusFilter === 'active' 
                  ? 'Create limit orders from any coin card' 
                  : 'Your order history will appear here'}
              </span>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => {
                // Safely extract order data with defaults and validation
                // Use client-side enriched metadata if backend returned an address-like symbol
                const enriched = enrichedTokenMeta.get(order.tokenMint);
                const dexMeta = coinBanners.get(order.tokenMint);
                const tokenSymbol = enriched?.symbol || dexMeta?.symbol || order.tokenSymbol || order.symbol || 'TOKEN';
                const tokenName = enriched?.name || dexMeta?.name || order.tokenName || order.name || tokenSymbol;
                const resolvedImage = order.tokenImage || dexMeta?.image || null;
                const orderType = order.type || 'buy';
                const status = order.status || 'active';
                const triggerPrice = order.triggerPrice || 0;
                const currentPrice = order.currentPrice || triggerPrice;
                const amount = order.amount || 0;
                
                // Safe timestamp handling
                let createdAt = order.createdAt;
                let expiresAt = order.expiresAt;
                let expiresAtRaw = order.expiresAt;
                
                // Validate createdAt
                try {
                  if (!createdAt) {
                    createdAt = new Date().toISOString();
                  } else {
                    const testDate = new Date(createdAt);
                    if (isNaN(testDate.getTime())) {
                      createdAt = new Date().toISOString();
                    } else {
                      createdAt = testDate.toISOString();
                    }
                  }
                } catch (err) {
                  createdAt = new Date().toISOString();
                }
                
                // Validate expiresAt
                if (expiresAt) {
                  try {
                    let parsedDate;
                    parsedDate = new Date(expiresAt);
                    
                    if (isNaN(parsedDate.getTime()) && typeof expiresAt === 'number') {
                      parsedDate = new Date(expiresAt * 1000);
                    }
                    
                    if (isNaN(parsedDate.getTime()) && typeof expiresAt === 'number') {
                      parsedDate = new Date(expiresAt);
                    }
                    
                    if (isNaN(parsedDate.getTime())) {
                      expiresAt = expiresAtRaw;
                    } else {
                      expiresAt = parsedDate.toISOString();
                    }
                  } catch (err) {
                    expiresAt = expiresAtRaw;
                  }
                }
                
                const orderId = order.orderId || order.id || 'unknown';
                const estimatedValue = order.estimatedValue || 0;
                
                // How far the price still has to move from where it is now to hit the target
                const priceDiffPercent = currentPrice > 0
                  ? ((currentPrice - triggerPrice) / currentPrice * 100).toFixed(2)
                  : 0;
                const isPriceAboveTrigger = currentPrice > triggerPrice;
                
                // Calculate time since order creation
                const createdDate = new Date(createdAt);
                const now = new Date();
                const timeDiff = now - createdDate;
                const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                const timeAgo = hours > 0 ? `${hours}h ${minutes}m ago` : `${minutes}m ago`;
                
                // Calculate expiration time
                let expiresAtDate = null;
                let expiryParseError = false;
                
                if (expiresAt) {
                  try {
                    expiresAtDate = new Date(expiresAt);
                    
                    if (isNaN(expiresAtDate.getTime())) {
                      expiryParseError = true;
                      expiresAtDate = null;
                    } else {
                      const yearsDiff = Math.abs(expiresAtDate.getFullYear() - now.getFullYear());
                      if (yearsDiff > 10) {
                        expiryParseError = true;
                        expiresAtDate = null;
                      }
                    }
                  } catch (err) {
                    expiryParseError = true;
                    expiresAtDate = null;
                  }
                }
                
                const isExpired = order.isExpired || isOrderExpired(order);
                const timeUntilExpiry = expiresAtDate && expiresAtDate > now && !isExpired ? expiresAtDate - now : null;
                const hoursUntilExpiry = timeUntilExpiry ? Math.floor(timeUntilExpiry / (1000 * 60 * 60)) : null;
                const minutesUntilExpiry = timeUntilExpiry ? Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60)) : null;
                const daysUntilExpiry = timeUntilExpiry ? Math.floor(timeUntilExpiry / (1000 * 60 * 60 * 24)) : null;
                
                let expiryText = 'No expiry';
                let expiryWarning = false;
                
                if (expiryParseError && expiresAtRaw) {
                  expiryText = '⚠️ Invalid format';
                  expiryWarning = true;
                } else if (isExpired) {
                  expiryText = '⚠️ EXPIRED';
                  expiryWarning = true;
                } else if (daysUntilExpiry !== null && daysUntilExpiry > 0) {
                  const remainingHours = hoursUntilExpiry % 24;
                  expiryText = remainingHours > 0 
                    ? `${daysUntilExpiry}d ${remainingHours}h` 
                    : `${daysUntilExpiry}d`;
                  expiryWarning = daysUntilExpiry === 0;
                } else if (hoursUntilExpiry !== null) {
                  expiryText = hoursUntilExpiry > 0 
                    ? `${hoursUntilExpiry}h ${minutesUntilExpiry}m` 
                    : `${minutesUntilExpiry}m`;
                  expiryWarning = hoursUntilExpiry === 0 && minutesUntilExpiry < 60;
                } else if (expiresAt && !expiresAtDate) {
                  expiryText = '⚠️ Parse error';
                  expiryWarning = true;
                }

                // ── New visual card for active orders ──────────────────────
                if (status === 'active') {
                  const progressPct = triggerPrice > 0
                    ? Math.min(100, Math.max(0, (currentPrice / triggerPrice) * 100))
                    : 0;
                  const isCancelling = cancellingOrder === orderId;
                  // What a cashout returns: the locked SOL for a buy, the tokens' current value for a sell.
                  const cashoutSol = orderType === 'sell' ? amount * currentPrice : estimatedValue;
                  const cashoutUsd = cashoutSol * solUsdPrice;
                  const dexBanner = coinBanners.get(order.tokenMint);
                  const bannerSrc = dexBanner?.banner || order.tokenBannerImage || order.tokenImage || null;
                  const resolvedPairAddress = dexBanner?.pairAddress || order.tokenPairAddress || null;

                  // Wallet's buy history for this coin — cost basis + performance since entry.
                  const buys = transactions.filter((t) =>
                    t.tokenMint === order.tokenMint && t.type === 'buy' &&
                    Number(t.inputAmount) > 0 && Number(t.outputAmount) > 0);
                  const buySol = buys.reduce((s, t) => s + Number(t.inputAmount), 0);
                  const buyTokens = buys.reduce((s, t) => s + Number(t.outputAmount), 0);
                  const avgBuyPriceSol = buyTokens > 0 ? buySol / buyTokens : 0;
                  const sinceBuyPct = avgBuyPriceSol > 0 && currentPrice > 0
                    ? ((currentPrice - avgBuyPriceSol) / avgBuyPriceSol) * 100
                    : null;
                  // The order's intent, relative to the live price (e.g. "sells if it drops 10%").
                  const triggerPct = currentPrice > 0 && triggerPrice > 0
                    ? ((triggerPrice - currentPrice) / currentPrice) * 100
                    : null;

                  return (
                    <div
                      key={orderId}
                      className={`order-card-visual${isExpired ? ' order-card-expired' : ''}`}
                      onClick={() => setOrderDetailOrder({
                        orderId,
                        tokenSymbol,
                        tokenName,
                        tokenImage: order.tokenImage,
                        tokenMint: order.tokenMint,
                        orderType,
                        triggerPrice,
                        currentPrice,
                        amount,
                        expiresAt,
                        isExpired,
                        bannerSrc,
                        resolvedPairAddress,
                        dexBanner,
                        rawOrder: order,
                      })}
                    >
                      {/* Blurred banner background — prefer wide Dexscreener banner */}
                      {bannerSrc && (
                        <img
                          src={bannerSrc}
                          alt=""
                          className="order-card-bg"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <div className="order-card-bg-overlay" />

                      {/* Top row: profile pic + name + badge + cancel */}
                      <div className="order-card-top-row">
                        <div className="order-card-left">
                          <img
                            src={resolvedImage || ''}
                            alt={tokenSymbol}
                            className="order-card-coin-avatar"
                            style={{ display: resolvedImage ? 'block' : 'none' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextElementSibling.style.display = 'flex';
                            }}
                          />
                          <div
                            className="order-card-coin-avatar order-card-coin-avatar-placeholder"
                            style={{ display: resolvedImage ? 'none' : 'flex' }}
                          >
                            {tokenSymbol.slice(0, 2)}
                          </div>
                          <div className="order-card-token-info">
                            <span className="order-card-symbol">{tokenSymbol}</span>
                            <span className="order-card-name">{tokenName}</span>
                          </div>
                        </div>
                        <div className="order-card-right">
                          <span className={`order-card-type-badge order-card-type-${orderType}`}>
                            {orderType === 'sell' ? '↑ SELL' : '↓ BUY'}
                          </span>
                          <button
                            className="order-card-cancel-x"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelOrder(orderId);
                            }}
                            disabled={isCancelling}
                            title="Cancel order"
                          >
                            {isCancelling ? '…' : '×'}
                          </button>
                        </div>
                      </div>

                      {/* Progress section */}
                      <div className="order-card-progress-section">
                        <div className="order-card-price-row">
                          <span className="order-card-price-label">Now</span>
                          <span className="order-card-price-val">{formatUsdPrice(currentPrice * solUsdPrice)}</span>
                          <span className="order-card-price-arrow">›</span>
                          <span className="order-card-price-val order-card-price-target">{formatUsdPrice(triggerPrice * solUsdPrice)}</span>
                          <span className="order-card-price-label">Target</span>
                        </div>

                        <div className="order-card-progress-track">
                          <div
                            className={`order-card-progress-fill${progressPct >= 100 ? ' complete' : ''}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>

                        <div className="order-card-progress-footer">
                          <span className={`order-card-diff${(isPriceAboveTrigger || parseFloat(priceDiffPercent) === 0) ? ' above' : ''}`}>
                            {(isPriceAboveTrigger || parseFloat(priceDiffPercent) === 0) ? '✓ Target reached' : `${Math.abs(priceDiffPercent)}% to go`}
                          </span>
                          <span className={`order-card-expiry-pill${expiryWarning ? ' warn' : ''}`}>
                            ⏱ {expiryText}
                          </span>
                        </div>
                      </div>

                      {/* Order intent + position stats */}
                      <div className="order-card-stats">
                        {Number.isFinite(triggerPct) && (
                          <div className="order-card-stats-row">
                            <span className="order-card-stats-label">
                              {orderType === 'sell'
                                ? (triggerPct < 0 ? 'SELLS IF PRICE DROPS' : 'SELLS IF PRICE RISES')
                                : (triggerPct < 0 ? 'BUYS IF PRICE DROPS' : 'BUYS IF PRICE RISES')}
                            </span>
                            <span className="order-card-stats-val">
                              {Math.abs(triggerPct).toFixed(1)}%
                              <span className="order-card-stats-sub"> ({formatUsdPrice(triggerPrice * solUsdPrice)})</span>
                            </span>
                          </div>
                        )}
                        {buySol > 0 && (
                          <div className="order-card-stats-row">
                            <span className="order-card-stats-label">BOUGHT FOR</span>
                            <span className="order-card-stats-val">
                              ${(buySol * solUsdPrice).toFixed(2)}
                              <span className="order-card-stats-sub"> ({buySol.toFixed(4)} SOL)</span>
                            </span>
                          </div>
                        )}
                        {Number.isFinite(sinceBuyPct) && (
                          <div className="order-card-stats-row">
                            <span className="order-card-stats-label">SINCE BUY</span>
                            <span className={`order-card-stats-val ${sinceBuyPct >= 0 ? 'order-card-stats-up' : 'order-card-stats-down'}`}>
                              {sinceBuyPct >= 0 ? '+' : ''}{sinceBuyPct.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>

                      {(isPriceAboveTrigger || parseFloat(priceDiffPercent) === 0) && (
                        <div className="order-card-executing-banner">
                          <span className="order-card-executing-dot" />
                          Target reached — pending fill
                          <span className="order-card-executing-sub">Will appear in History once sold</span>
                        </div>
                      )}

                      {/* Cashout — cancels the limit order and returns funds to the wallet */}
                      <button
                        className="order-card-cashout-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelOrder(orderId);
                        }}
                        disabled={isCancelling}
                      >
                        {isCancelling ? 'Cashing out…' : (
                          <>
                            Cashout
                            {cashoutUsd > 0 && (
                              <span className="order-card-cashout-amount">${cashoutUsd.toFixed(2)}</span>
                            )}
                          </>
                        )}
                      </button>
                    </div>
                  );
                }
                // ── End visual card ─────────────────────────────────────────

                // ── History visual card ────────────────────────────────────
                const histDexBanner = coinBanners.get(order.tokenMint);
                const histBannerSrc = histDexBanner?.banner || order.tokenBannerImage || order.tokenImage || null;
                const histTxLink = order.cancelTxSignature || order.createTxSignature || null;

                return (
                  <div
                    key={orderId}
                    className={`order-card-visual order-hist-card order-hist-${
                      status === 'completed' ? 'executed' : status
                    }`}
                    onClick={() => setSelectedOrder({
                      isHistory: true,
                      orderId,
                      tokenSymbol: order.tokenSymbol,
                      tokenName: order.tokenName,
                      tokenImage: order.tokenImage,
                      tokenMint: order.tokenMint,
                      orderType,
                      triggerPrice,
                      currentPrice,
                      banner: histDexBanner?.banner || order.tokenBannerImage || null,
                      pairAddress: histDexBanner?.pairAddress || order.tokenPairAddress || null,
                      rawOrder: order,
                    })}
                  >
                    {histBannerSrc && (
                      <img
                        src={histBannerSrc}
                        alt=""
                        className="order-card-bg"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div className="order-card-bg-overlay" />

                    <div className="order-card-top-row">
                      <div className="order-card-left">
                        <img
                          src={order.tokenImage || ''}
                          alt={tokenSymbol}
                          className="order-card-coin-avatar"
                          style={{ display: order.tokenImage ? 'block' : 'none' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                          }}
                        />
                        <div
                          className="order-card-coin-avatar order-card-coin-avatar-placeholder"
                          style={{ display: order.tokenImage ? 'none' : 'flex' }}
                        >
                          {tokenSymbol.slice(0, 2)}
                        </div>
                        <div className="order-card-token-info">
                          <span className="order-card-symbol">{tokenSymbol}</span>
                          <span className="order-card-name">{tokenName}</span>
                        </div>
                      </div>
                      <div className="order-card-right">
                        <span className={`order-card-type-badge order-card-type-${orderType}`}>
                          {orderType === 'sell' ? '↑ SELL' : '↓ BUY'}
                        </span>
                        <span className={`order-hist-status-pill order-hist-status-${
                          status === 'executed' || status === 'completed' ? 'executed' :
                          status === 'cancelled' ? 'cancelled' :
                          status === 'expired' ? 'expired' : 'executed'
                        }`}>
                          {status === 'executed' || status === 'completed' ? '✓ FILLED' :
                           status === 'cancelled' ? 'CANCELLED' :
                           status === 'expired' ? 'EXPIRED' :
                           status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {(() => {
                      const isExecuted = status === 'executed' || status === 'completed';
                      const { percent, usdAmount, costUsd, proceedsSol, costSol } = computeFillStats(order, transactions, solUsdPrice);
                      // Only show when there's a real round trip to report.
                      if (!Number.isFinite(percent)) return null;
                      return (
                        <div className="order-hist-fulfilled-banner">
                          <div className="order-hist-fulfilled-row">
                            <span className="order-hist-fulfilled-title">{isExecuted ? 'Fulfilled' : 'Your trades'}</span>
                            <span className={`order-hist-fulfilled-pct${percent >= 0 ? ' positive' : ' negative'}`}>
                              {percent >= 0 ? '+' : ''}{percent.toFixed(1)}%
                            </span>
                          </div>
                          <div className="order-hist-fulfilled-flow">
                            <span>Bought ${costUsd.toFixed(2)} ({costSol.toFixed(4)} SOL)</span>
                            <span className="order-hist-fulfilled-arrow">→</span>
                            <span className="order-hist-fulfilled-usd">Sold ${usdAmount.toFixed(2)} ({proceedsSol.toFixed(4)} SOL)</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* (dead code — active orders return early above) */}
                    {status === 'active' && (
                      <>
                        {/* EXPIRED ORDER WARNING */}
                        {isExpired && (
                          <div className="expired-order-warning">
                            <div className="warning-header">
                              <span className="warning-icon">⚠️</span>
                              <strong>ORDER EXPIRED - FUNDS LOCKED IN ESCROW</strong>
                            </div>
                            <p className="warning-text">
                              This order expired on <strong>{formatDate(expiresAt)}</strong>. Your <strong>{estimatedValue > 0 ? `${estimatedValue.toFixed(4)} SOL` : 'funds'}</strong> are currently held in Jupiter's escrow program and will NOT be returned automatically.
                            </p>
                            <div className="escrow-info">
                              <div>
                                <strong>🔒 Escrow Program:</strong>
                                <br />
                                <a 
                                  href="https://solscan.io/account/jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="escrow-link"
                                >
                                  jupoNjAx...Nrnu ↗
                                </a>
                              </div>
                              {orderId && orderId !== 'unknown' && (
                                <div>
                                  <strong>📦 Order Account:</strong>
                                  <br />
                                  <a 
                                    href={`https://solscan.io/account/${orderId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="escrow-link"
                                  >
                                    {orderId.slice(0, 8)}...{orderId.slice(-6)} ↗
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="recovery-instructions">
                              <div className="instructions-title">
                                🔧 TO RECOVER YOUR FUNDS:
                              </div>
                              <div className="instruction-item">
                                <strong>Option 1:</strong> Click the "Cancel Order" button below
                              </div>
                              <div className="instruction-item">
                                <strong>Option 2:</strong> Visit Jupiter's interface
                                <div className="jupiter-link-container">
                                  <a 
                                    href="https://jup.ag/limit"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="jupiter-link"
                                  >
                                    🔗 Open Jupiter Limit Orders ↗
                                  </a>
                                </div>
                              </div>
                            </div>
                            <p className="warning-footer">
                              ⚡ Your {estimatedValue > 0 ? `${estimatedValue.toFixed(4)} SOL` : 'funds'} won't be returned automatically - you must cancel manually!
                            </p>
                          </div>
                        )}

                        {/* ESCROW INFO BADGE - Show for all active orders */}
                        {!isExpired && (
                          <div className="escrow-info-badge">
                            <div className="escrow-badge-icon">🔒</div>
                            <div className="escrow-badge-content">
                              <div className="escrow-badge-title">
                                Funds Held in Jupiter Escrow
                              </div>
                              <div className="escrow-badge-text">
                                Your <strong>{estimatedValue > 0 ? `${estimatedValue.toFixed(4)} SOL` : 'funds'}</strong> are securely held in a Program Derived Address (PDA) until the order executes or you cancel it.
                              </div>
                              <div className="escrow-badge-links">
                                <a 
                                  href="https://solscan.io/account/jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="badge-link"
                                >
                                  📋 View Escrow Program ↗
                                </a>
                                {orderId && orderId !== 'unknown' && (
                                  <a 
                                    href={`https://solscan.io/account/${orderId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="badge-link"
                                  >
                                    📦 View Order Account ↗
                                  </a>
                                )}
                              </div>
                              <div className="escrow-badge-note">
                                <div>
                                  <strong>ℹ️ Important:</strong> If this order expires, your funds will remain in escrow. You must manually cancel the order to retrieve them.
                                </div>
                                <div className="cancel-options">
                                  <span>Cancel below or via</span>
                                  <a 
                                    href="https://jup.ag/limit"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="jupiter-inline-link"
                                  >
                                    🔗 Jupiter Interface ↗
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Price Progress Section */}
                        <div className="order-price-progress">
                          <div className="price-comparison">
                            <div className="price-box current-price">
                              <div className="price-label">Current Price</div>
                              <div className="price-amount" title={`Price in SOL per token${order.currentPriceSource ? `\nSource: ${order.currentPriceSource}` : ''}`}>
                                {formatPrice(currentPrice)} SOL
                              </div>
                              {order.currentPriceSource && order.currentPriceSource !== 'fallback-trigger' && (
                                <div className="price-source-badge live">
                                  ✓ Live Price
                                </div>
                              )}
                              {order.currentPriceSource === 'fallback-trigger' && (
                                <div className="price-source-badge fallback" title="Price API unavailable - showing trigger price">
                                  ⚠️ Using Trigger
                                </div>
                              )}
                            </div>
                            <div className="price-arrow">
                              {orderType === 'buy' ? (
                                isPriceAboveTrigger ? '↓' : '↑'
                              ) : (
                                isPriceAboveTrigger ? '↑' : '↓'
                              )}
                            </div>
                            <div className="price-box trigger-price">
                              <div className="price-label">Trigger Price</div>
                              <div className="price-amount" title="Price in SOL per token at which order will execute">
                                {formatPrice(triggerPrice)} SOL
                              </div>
                            </div>
                          </div>
                          
                          {/* Percentage Difference Badge */}
                          <div className={`price-diff-badge ${
                            orderType === 'buy' 
                              ? (isPriceAboveTrigger ? 'away' : 'close') 
                              : (isPriceAboveTrigger ? 'close' : 'away')
                          }`}>
                            {Math.abs(priceDiffPercent)}% {
                              orderType === 'buy'
                                ? (isPriceAboveTrigger ? 'above target' : 'below target')
                                : (isPriceAboveTrigger ? 'above target' : 'below target')
                            }
                          </div>
                        </div>

                        {/* Order Details Grid */}
                        <div className="order-details-grid">
                          <div className="detail-card">
                            <div className="detail-icon">💰</div>
                            <div className="detail-content">
                              <div className="detail-label">Amount</div>
                              <div className="detail-value-large">
                                {amount > 0 ? amount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 6
                                }) : '0.00'} {tokenSymbol}
                              </div>
                            </div>
                          </div>
                          
                          <div className="detail-card">
                            <div className="detail-icon">⏱️</div>
                            <div className="detail-content">
                              <div className="detail-label">Created</div>
                              <div className="detail-value-large">{timeAgo}</div>
                            </div>
                          </div>
                          
                          <div className="detail-card">
                            <div className="detail-icon">⏰</div>
                            <div className="detail-content">
                              <div className="detail-label">Expires In</div>
                              <div className={`detail-value-large ${expiryWarning ? 'expiry-warning' : ''}`}>
                                {expiryText}
                              </div>
                            </div>
                          </div>
                          
                          <div className="detail-card">
                            <div className="detail-icon">💵</div>
                            <div className="detail-content">
                              <div className="detail-label">Est. Value</div>
                              <div className="detail-value-large">
                                {estimatedValue > 0 ? `${estimatedValue.toFixed(4)} SOL` : '0 SOL'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Additional Info */}
                        <div className="order-additional-info">
                          <div className="info-row">
                            <span className="info-icon">📅</span>
                            <span className="info-text">Created on {formatDate(createdAt)}</span>
                          </div>
                          {orderId && orderId !== 'unknown' && (
                            <div className="info-row">
                              <span className="info-icon">🔑</span>
                              <span className="info-text">Order ID: {orderId.slice(0, 8)}...{orderId.slice(-6)}</span>
                            </div>
                          )}
                          {/* Transaction Signatures with Solscan Links */}
                          {order.createTxSignature && (
                            <div className="info-row">
                              <span className="info-icon">📝</span>
                              <span className="info-text">
                                Create TX:{' '}
                                <a 
                                  href={`https://solscan.io/tx/${order.createTxSignature}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tx-link"
                                >
                                  {order.createTxSignature.slice(0, 8)}...{order.createTxSignature.slice(-6)} ↗
                                </a>
                              </span>
                            </div>
                          )}
                          {order.updateTxSignature && (
                            <div className="info-row">
                              <span className="info-icon">🔄</span>
                              <span className="info-text">
                                Update TX:{' '}
                                <a 
                                  href={`https://solscan.io/tx/${order.updateTxSignature}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tx-link"
                                >
                                  {order.updateTxSignature.slice(0, 8)}...{order.updateTxSignature.slice(-6)} ↗
                                </a>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Cancel Button */}
                        <div className="order-actions">
                          <button
                            className={`cancel-order-btn ${isExpired ? 'expired-urgent' : ''}`}
                            onClick={() => handleCancelOrder(orderId)}
                            disabled={cancellingOrder === orderId}
                          >
                            {cancellingOrder === orderId 
                              ? '⏳ Cancelling...' 
                              : isExpired 
                                ? '⚡ CANCEL & RETRIEVE FUNDS' 
                                : '🗑️ Cancel Order'}
                          </button>
                          
                          {/* Always show Jupiter link as backup option */}
                          <p className="cancel-note">
                            {isExpired ? (
                              <>
                                Click to return your funds from escrow<br/>
                                or{' '}
                              </>
                            ) : (
                              <>Having issues? Try{' '}</>
                            )}
                            <a
                              href={`https://jup.ag/limit/${publicKey?.toString() || ''}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="jupiter-cancel-link"
                            >
                              {isExpired ? 'manage on Jupiter ↗' : 'canceling on Jupiter ↗'}
                            </a>
                          </p>
                        </div>
                      </>
                    )}

                    {/* Price history */}
                    <div className="order-hist-price-section">
                      <div className="order-hist-divider" />
                      <div className="order-hist-row">
                        <span className="order-hist-label">{orderType === 'sell' ? 'SELL PRICE' : 'BUY PRICE'}</span>
                        <span className="order-hist-val order-hist-price">${formatPrice(triggerPrice * solUsdPrice)}</span>
                      </div>
                      {amount > 0 && (
                        <div className="order-hist-row">
                          <span className="order-hist-label">AMOUNT</span>
                          <span className="order-hist-val">{formatTokenAmount(amount)} {tokenSymbol}</span>
                        </div>
                      )}
                      {estimatedValue > 0 && (
                        <div className="order-hist-row">
                          <span className="order-hist-label">
                            {status === 'executed' || status === 'completed'
                              ? (orderType === 'sell' ? 'RECEIVED' : 'SPENT')
                              : (orderType === 'sell' ? 'TARGET PROCEEDS' : 'ORDER SIZE')}
                          </span>
                          <span className="order-hist-val">
                            {estimatedValue.toFixed(4)} SOL
                            <span className="order-hist-usd"> (${(estimatedValue * solUsdPrice).toFixed(2)})</span>
                          </span>
                        </div>
                      )}
                      <div className="order-hist-row">
                        <span className="order-hist-label">CREATED</span>
                        <span className="order-hist-val order-hist-date">{formatDate(createdAt)}</span>
                      </div>
                      {status === 'executed' && order.executedAt && (
                        <div className="order-hist-row">
                          <span className="order-hist-label">EXECUTED</span>
                          <span className="order-hist-val order-hist-date">{formatDate(order.executedAt)}</span>
                        </div>
                      )}
                      {histTxLink && (
                        <div className="order-hist-row">
                          <span className="order-hist-label">TX</span>
                          <a
                            href={`https://solscan.io/tx/${histTxLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="order-hist-tx-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {histTxLink.slice(0, 6)}...{histTxLink.slice(-4)} ↗
                          </a>
                        </div>
                      )}
                    </div>

                    {isExpired && status !== 'cancelled' && status !== 'executed' && (
                      <div className="order-hist-recover" onClick={(e) => e.stopPropagation()}>
                        <span>Funds in escrow</span>
                        <button
                          className="order-hist-recover-btn"
                          onClick={() => handleCancelOrder(orderId)}
                          disabled={cancellingOrder === orderId}
                        >
                          {cancellingOrder === orderId ? 'Cancelling…' : 'Retrieve funds'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Limit Order Info Modal */}
      {showLimitOrderInfo && (
        <div className="limit-order-info-modal" onClick={() => setShowLimitOrderInfo(false)}>
          <div className="limit-order-info-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="close-modal-btn"
              onClick={() => setShowLimitOrderInfo(false)}
            >
              ✕
            </button>
            
            <h2>What are Limit Orders?</h2>
            
            <div className="info-section">
              <h3>The Basics</h3>
              <p>
                A <strong>limit order</strong> lets you buy or sell a token at a specific price you set, 
                rather than the current market price. Your order sits on the blockchain and automatically 
                executes when the market reaches your target price.
              </p>
            </div>

            <div className="info-section">
              <h3>How It Works</h3>
              <ul>
                <li><strong>Set Your Price:</strong> Choose the exact price you want to buy or sell at</li>
                <li><strong>Wait for Match:</strong> Your order waits on-chain until the market hits your price</li>
                <li><strong>Auto Execute:</strong> When conditions are met, the trade happens automatically</li>
                <li><strong>Full Control:</strong> Cancel anytime before execution</li>
              </ul>
            </div>

            <div className="info-section">
              <h3>Benefits</h3>
              <ul>
                <li><strong>Price Control:</strong> You decide the exact price, no surprises</li>
                <li><strong>No Watching:</strong> Set it and forget it - trades happen automatically</li>
                <li><strong>Reduced Slippage:</strong> No more getting rekt by market orders</li>
                <li><strong>Smart Trading:</strong> Buy dips or sell peaks without being glued to charts</li>
              </ul>
            </div>

            <div className="info-section">
              <h3>Things to Know</h3>
              <ul>
                <li>Orders may not fill if the market doesn't reach your price</li>
                <li>You can set expiration times to auto-cancel orders</li>
                <li>Small fees apply for creating and canceling orders</li>
                <li>Orders are stored on-chain via Jupiter's DCA/Limit Order program</li>
              </ul>
            </div>

            <div className="info-section powered-by">
              <p>
                <strong>Powered by Jupiter Exchange</strong> - The leading DEX aggregator on Solana
              </p>
            </div>

            <button 
              className="got-it-btn"
              onClick={() => setShowLimitOrderInfo(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Order Action Popup */}
      {selectedOrder && (
        <div className="order-action-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="order-action-popup" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="order-action-header">
              <div className="order-action-token-row">
                {selectedOrder.tokenImage ? (
                  <img src={selectedOrder.tokenImage} alt={selectedOrder.tokenSymbol} className="order-action-avatar" />
                ) : (
                  <div className="order-action-avatar order-action-avatar-placeholder">
                    {selectedOrder.tokenSymbol?.slice(0, 2)}
                  </div>
                )}
                <div>
                  <div className="order-action-symbol">{selectedOrder.tokenSymbol}</div>
                  <div className="order-action-name">{selectedOrder.tokenName}</div>
                </div>
                <span className={`order-action-type-badge order-card-type-${selectedOrder.orderType}`}>
                  {selectedOrder.orderType === 'sell' ? '↑ SELL' : '↓ BUY'}
                </span>
              </div>
              <div className="order-action-prices">
                <span className="order-action-price-item">
                  <span className="order-action-price-label">Now</span>
                  <span className="order-action-price-val">{formatPrice(selectedOrder.currentPrice)} SOL</span>
                </span>
                <span className="order-action-arrow">›</span>
                <span className="order-action-price-item">
                  <span className="order-action-price-label">Target</span>
                  <span className="order-action-price-val order-card-price-target">{formatPrice(selectedOrder.triggerPrice)} SOL</span>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="order-action-buttons">
              {selectedOrder.isHistory ? (
                <>
                  {/* History order actions: Chart, Buy */}
                  <button
                    className="order-action-btn order-action-btn-chart"
                    onClick={() => {
                      setSelectedOrder(null);
                      onCoinClick?.({
                        mintAddress: selectedOrder.tokenMint,
                        address: selectedOrder.tokenMint,
                        symbol: selectedOrder.tokenSymbol,
                        name: selectedOrder.tokenName,
                        image: selectedOrder.tokenImage,
                        banner: selectedOrder.banner,
                        pairAddress: selectedOrder.pairAddress,
                      });
                    }}
                  >
                    <span>Chart</span>
                  </button>

                  <button
                    className="order-action-btn order-action-btn-buy"
                    onClick={() => {
                      setSelectedOrder(null);
                      onTradeClick?.({
                        mintAddress: selectedOrder.tokenMint,
                        address: selectedOrder.tokenMint,
                        symbol: selectedOrder.tokenSymbol,
                        name: selectedOrder.tokenName,
                        image: selectedOrder.tokenImage,
                        banner: selectedOrder.banner,
                        pairAddress: selectedOrder.pairAddress,
                      });
                    }}
                  >
                    <span>Buy</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Active order actions: View Chart, View on Jupiter, Cancel */}
                  <button
                    className="order-action-btn order-action-btn-chart"
                    onClick={() => {
                      setSelectedOrder(null);
                      onCoinClick?.({
                        mintAddress: selectedOrder.tokenMint,
                        address: selectedOrder.tokenMint,
                        symbol: selectedOrder.rawOrder?.tokenSymbol,
                        name: selectedOrder.rawOrder?.tokenName,
                        image: selectedOrder.tokenImage,
                        banner: selectedOrder.dexBanner?.banner || selectedOrder.rawOrder?.tokenBannerImage || null,
                        pairAddress: selectedOrder.resolvedPairAddress,
                      });
                    }}
                  >
                    <span>View Chart</span>
                  </button>

                  <a
                    className="order-action-btn order-action-btn-jupiter"
                    href={`https://jup.ag/limit/${publicKey?.toString() || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSelectedOrder(null)}
                  >
                    <span>View on Jupiter</span>
                  </a>

                  <button
                    className="order-action-btn order-action-btn-cancel"
                    disabled={cancellingOrder === selectedOrder.orderId}
                    onClick={() => {
                      const id = selectedOrder.orderId;
                      setSelectedOrder(null);
                      handleCancelOrder(id);
                    }}
                  >
                    <span>{cancellingOrder === selectedOrder.orderId ? 'Cancelling…' : 'Cancel Order'}</span>
                  </button>
                </>
              )}
            </div>

            <button className="order-action-dismiss" onClick={() => setSelectedOrder(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Active order detail: chart with buy/sell markers + primary cancel-and-cashout button */}
      {orderDetailOrder && (
        <OrderDetailView
          order={orderDetailOrder}
          walletAddress={publicKey?.toString()}
          solUsdPrice={solUsdPrice}
          cancelling={cancellingOrder === orderDetailOrder.orderId}
          onCancel={(id) => {
            setOrderDetailOrder(null);
            handleCancelOrder(id);
          }}
          onBack={() => setOrderDetailOrder(null)}
          onCoinClick={(coinData) => {
            setOrderDetailOrder(null);
            onCoinClick?.(coinData);
          }}
          jupiterLink={`https://jup.ag/limit/${publicKey?.toString() || ''}`}
        />
      )}
    </div>
  );
};

export default OrdersView;
