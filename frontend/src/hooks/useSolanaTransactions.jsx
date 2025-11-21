import { useState, useEffect, useRef, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';

// Use backend proxy for Solana RPC to avoid CORS and connection issues
const BACKEND_API = import.meta.env.PROD 
  ? 'https://api.moonfeed.app'
  : 'http://localhost:3001';

// We'll use Helius for the WebSocket but parse transactions with our enhanced logic
const HELIUS_API_KEY = '26240c3d-8cce-414e-95f7-5c0c75c1a2cb';
const HELIUS_WS_URL = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

/**
 * Custom hook to monitor Solana transactions for a specific token address
 * Uses native Solana RPC instead of Helius for richer transaction data
 * 
 * @param {string} mintAddress - The token mint address to monitor
 * @param {boolean} isActive - Whether to actively monitor transactions
 * @returns {Object} - { transactions, isConnected, error, clearTransactions }
 */
export const useSolanaTransactions = (mintAddress, isActive) => {
  const [transactions, setTransactions] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const subscriptionIdRef = useRef(null);
  const connectionRef = useRef(null);

  /**
   * Parse transaction to extract wallet addresses and transaction details
   */
  const parseTransaction = useCallback(async (signature, connection) => {
    try {
      // Fetch transaction details
      const tx = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      });

      if (!tx || !tx.transaction) {
        return null;
      }

      const { transaction, meta } = tx;
      const accountKeys = transaction.message.getAccountKeys();
      
      // Extract fee payer (first signer)
      const feePayer = accountKeys.get(0)?.toBase58() || 'Unknown';
      
      // Extract program IDs to determine transaction type
      const programIds = transaction.message.compiledInstructions
        .map(ix => accountKeys.get(ix.programIdIndex)?.toBase58())
        .filter(Boolean);
      
      // Determine transaction type based on program IDs
      let txType = 'UNKNOWN';
      let programName = 'Unknown';
      
      // Common Solana DEX program IDs
      const RAYDIUM_V4 = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
      const RAYDIUM_V3 = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';
      const ORCA = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
      const ORCA_V2 = '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP';
      const JUPITER_V6 = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
      const JUPITER_V4 = 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB';
      const METEORA = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';
      const PUMP_FUN = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
      
      if (programIds.includes(RAYDIUM_V4) || programIds.includes(RAYDIUM_V3)) {
        txType = 'SWAP';
        programName = 'Raydium';
      } else if (programIds.includes(ORCA) || programIds.includes(ORCA_V2)) {
        txType = 'SWAP';
        programName = 'Orca';
      } else if (programIds.includes(JUPITER_V6) || programIds.includes(JUPITER_V4)) {
        txType = 'SWAP';
        programName = 'Jupiter';
      } else if (programIds.includes(METEORA)) {
        txType = 'SWAP';
        programName = 'Meteora';
      } else if (programIds.includes(PUMP_FUN)) {
        txType = 'SWAP';
        programName = 'Pump.fun';
      } else if (programIds.some(id => id.includes('Token'))) {
        txType = 'TRANSFER';
        programName = 'Token Program';
      }
      
      // Extract token balance changes for amount calculation
      let amountChange = null;
      if (meta?.postTokenBalances && meta?.preTokenBalances) {
        // Find the token balance change for this mint
        const postBalance = meta.postTokenBalances.find(
          b => b.mint === mintAddress
        );
        const preBalance = meta.preTokenBalances.find(
          b => b.mint === mintAddress
        );
        
        if (postBalance && preBalance) {
          const post = parseFloat(postBalance.uiTokenAmount.uiAmountString || '0');
          const pre = parseFloat(preBalance.uiTokenAmount.uiAmountString || '0');
          amountChange = Math.abs(post - pre);
        }
      }
      
      // Extract all unique wallet addresses involved
      const walletAddresses = new Set();
      accountKeys.staticAccountKeys.forEach(key => {
        const address = key.toBase58();
        // Filter out program IDs and system accounts
        if (!programIds.includes(address) && !address.startsWith('11111111')) {
          walletAddresses.add(address);
        }
      });
      
      return {
        signature,
        timestamp: tx.blockTime 
          ? new Date(tx.blockTime * 1000).toISOString() 
          : new Date().toISOString(),
        type: txType,
        program: programName,
        feePayer,
        walletAddresses: Array.from(walletAddresses).slice(0, 5), // First 5 wallets
        amount: amountChange,
        err: meta?.err || null,
        slot: tx.slot,
        fee: meta?.fee || 0,
      };
    } catch (err) {
      console.error('Error parsing transaction:', err);
      return null;
    }
  }, [mintAddress]);

  const addTransaction = useCallback((tx) => {
    setTransactions(prev => {
      // Keep only the last 50 transactions to prevent memory issues
      const newTxs = [tx, ...prev].slice(0, 50);
      return newTxs;
    });
  }, []);

  /**
   * Fetch recent historical transactions for the token
   */
  const fetchHistoricalTransactions = useCallback(async (mintAddress, connection) => {
    try {
      console.log('📜 Fetching recent historical transactions for:', mintAddress);
      
      const mintPubkey = new PublicKey(mintAddress);
      
      // Get recent signatures for this token (last 10 transactions)
      const signatures = await connection.getSignaturesForAddress(mintPubkey, {
        limit: 10
      });
      
      console.log(`📜 Found ${signatures.length} recent transactions`);
      
      // Parse each transaction
      const parsedTransactions = [];
      for (const sig of signatures) {
        const parsedTx = await parseTransaction(sig.signature, connection);
        if (parsedTx) {
          parsedTransactions.push(parsedTx);
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`✅ Parsed ${parsedTransactions.length} historical transactions`);
      
      // Add all historical transactions at once
      setTransactions(parsedTransactions.slice(0, 50));
      
    } catch (err) {
      console.error('❌ Error fetching historical transactions:', err);
      // Don't throw - historical transactions are optional
    }
  }, [parseTransaction]);

  const connect = useCallback(async () => {
    if (!mintAddress || !isActive) return;

    // 🔥 MOBILE SAFETY: Don't create WebSocket on mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      console.log('📱 WebSocket disabled on mobile for memory safety');
      return;
    }

    console.log('🔌 Connecting to Helius WebSocket for enhanced transaction monitoring:', mintAddress);
    
    try {
      // Close existing connection if any
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {
          console.error('Error closing existing WebSocket:', e);
        }
        wsRef.current = null;
      }

      // Create connection for fetching transaction details (using Helius for reliability)
      const connection = new Connection(HELIUS_RPC_URL, {
        commitment: 'confirmed'
      });
      connectionRef.current = connection;

      // Validate mint address
      let mintPubkey;
      try {
        mintPubkey = new PublicKey(mintAddress);
      } catch (err) {
        console.error('❌ Invalid mint address:', mintAddress);
        setError('Invalid mint address');
        return;
      }

      // Create WebSocket connection to Helius (more reliable than public RPC)
      const ws = new WebSocket(HELIUS_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Helius WebSocket connected for enhanced transaction monitoring');
        setIsConnected(true);
        setError(null);

        // Subscribe to logs mentioning this token
        const subscribeRequest = {
          jsonrpc: "2.0",
          id: Date.now(),
          method: "logsSubscribe",
          params: [
            {
              mentions: [mintAddress]
            },
            {
              commitment: "confirmed"
            }
          ]
        };

        ws.send(JSON.stringify(subscribeRequest));
        console.log('📡 Subscribed to enhanced transaction monitoring for:', mintAddress);

        // Fetch recent historical transactions
        fetchHistoricalTransactions(mintAddress, connection);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle subscription confirmation
          if (data.result && typeof data.result === 'number') {
            subscriptionIdRef.current = data.result;
            console.log('✅ Subscription confirmed, ID:', data.result);
            return;
          }

          // Handle log notifications (actual transactions)
          if (data.params?.result?.value) {
            const logData = data.params.result.value;
            const signature = logData.signature;
            
            // Parse the full transaction details with enhanced data extraction
            if (connectionRef.current) {
              console.log('🔍 Parsing transaction:', signature);
              const parsedTx = await parseTransaction(signature, connectionRef.current);
              
              if (parsedTx) {
                console.log('✅ Transaction parsed successfully:', {
                  type: parsedTx.type,
                  program: parsedTx.program,
                  feePayer: parsedTx.feePayer?.substring(0, 8) + '...',
                  amount: parsedTx.amount
                });
                addTransaction(parsedTx);
              } else {
                console.warn('⚠️ Transaction parsing returned null for:', signature);
              }
            }
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setError('Connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;
        subscriptionIdRef.current = null;
      };

    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError(err.message);
    }
  }, [mintAddress, isActive, addTransaction, parseTransaction, fetchHistoricalTransactions]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting enhanced transaction monitoring WebSocket');
    
    if (wsRef.current) {
      // Unsubscribe if we have a subscription ID
      if (subscriptionIdRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "logsUnsubscribe",
            params: [subscriptionIdRef.current]
          }));
        } catch (err) {
          console.error('Error unsubscribing:', err);
        }
      }
      
      // Force close with cleanup
      try {
        wsRef.current.close();
      } catch (err) {
        console.error('Error closing WebSocket:', err);
      }
      
      wsRef.current = null;
      subscriptionIdRef.current = null;
    }
    
    connectionRef.current = null;
    setIsConnected(false);
    setTransactions([]);
  }, []);

  // Effect to manage connection
  useEffect(() => {
    if (isActive && mintAddress) {
      connect();
    } else {
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [isActive, mintAddress, connect, disconnect]);

  const clearTransactions = useCallback(() => {
    setTransactions([]);
  }, []);

  return {
    transactions,
    isConnected,
    error,
    clearTransactions
  };
};
