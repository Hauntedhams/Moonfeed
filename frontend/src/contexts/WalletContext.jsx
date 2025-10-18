import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * Wallet Context for managing Phantom/Solflare wallet connection
 * Provides wallet address, connection status, and transaction signing
 */

const WalletContext = createContext({});

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [walletType, setWalletType] = useState(null); // 'phantom' or 'solflare'

  // Solana connection
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  // Check if wallet is available
  const isPhantomAvailable = () => typeof window !== 'undefined' && window.solana?.isPhantom;
  const isSolflareAvailable = () => typeof window !== 'undefined' && window.solflare?.isSolflare;

  // Auto-connect if previously connected
  useEffect(() => {
    const checkConnection = async () => {
      if (isPhantomAvailable()) {
        try {
          // First check if already connected
          if (window.solana.isConnected && window.solana.publicKey) {
            const address = window.solana.publicKey.toString();
            setWalletAddress(address);
            setConnected(true);
            setWalletType('phantom');
            console.log('✅ Phantom already connected:', address);
            return;
          }
          
          // Try auto-connect
          const resp = await window.solana.connect({ onlyIfTrusted: true });
          setWalletAddress(resp.publicKey.toString());
          setConnected(true);
          setWalletType('phantom');
          console.log('✅ Auto-connected to Phantom:', resp.publicKey.toString());
        } catch (err) {
          // User not previously connected
          console.log('ℹ️ Phantom not auto-connected');
        }
      } else if (isSolflareAvailable()) {
        try {
          // First check if already connected
          if (window.solflare.isConnected && window.solflare.publicKey) {
            const address = window.solflare.publicKey.toString();
            setWalletAddress(address);
            setConnected(true);
            setWalletType('solflare');
            console.log('✅ Solflare already connected:', address);
            return;
          }
          
          // Try auto-connect
          const resp = await window.solflare.connect({ onlyIfTrusted: true });
          setWalletAddress(resp.solflare.publicKey.toString());
          setConnected(true);
          setWalletType('solflare');
          console.log('✅ Auto-connected to Solflare:', resp.publicKey.toString());
        } catch (err) {
          // User not previously connected
          console.log('ℹ️ Solflare not auto-connected');
        }
      }
    };

    checkConnection();
    
    // Add event listeners for wallet connection/disconnection
    if (isPhantomAvailable()) {
      const handleConnect = (publicKey) => {
        const address = publicKey.toString();
        console.log('🔗 Phantom connected event:', address);
        setWalletAddress(address);
        setConnected(true);
        setWalletType('phantom');
      };
      
      const handleDisconnect = () => {
        console.log('🔌 Phantom disconnected event');
        setWalletAddress(null);
        setConnected(false);
        setWalletType(null);
      };
      
      const handleAccountChanged = (publicKey) => {
        if (publicKey) {
          const address = publicKey.toString();
          console.log('👤 Phantom account changed:', address);
          setWalletAddress(address);
          setConnected(true);
          setWalletType('phantom');
        } else {
          console.log('👤 Phantom account disconnected');
          setWalletAddress(null);
          setConnected(false);
          setWalletType(null);
        }
      };
      
      window.solana.on('connect', handleConnect);
      window.solana.on('disconnect', handleDisconnect);
      window.solana.on('accountChanged', handleAccountChanged);
      
      return () => {
        window.solana.removeListener('connect', handleConnect);
        window.solana.removeListener('disconnect', handleDisconnect);
        window.solana.removeListener('accountChanged', handleAccountChanged);
      };
    }
  }, []);

  // Connect to Phantom
  const connectPhantom = useCallback(async () => {
    if (!isPhantomAvailable()) {
      setError('Phantom wallet not found. Please install it from phantom.app');
      return false;
    }

    setConnecting(true);
    setError(null);

    try {
      const resp = await window.solana.connect();
      setWalletAddress(resp.publicKey.toString());
      setConnected(true);
      setWalletType('phantom');
      console.log('✅ Connected to Phantom:', resp.publicKey.toString());
      return true;
    } catch (err) {
      console.error('❌ Phantom connection error:', err);
      setError('Failed to connect to Phantom wallet');
      return false;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Connect to Solflare
  const connectSolflare = useCallback(async () => {
    if (!isSolflareAvailable()) {
      setError('Solflare wallet not found. Please install it from solflare.com');
      return false;
    }

    setConnecting(true);
    setError(null);

    try {
      const resp = await window.solflare.connect();
      setWalletAddress(resp.publicKey.toString());
      setConnected(true);
      setWalletType('solflare');
      console.log('✅ Connected to Solflare:', resp.publicKey.toString());
      return true;
    } catch (err) {
      console.error('❌ Solflare connection error:', err);
      setError('Failed to connect to Solflare wallet');
      return false;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Generic connect (tries Phantom first, then Solflare)
  const connect = useCallback(async () => {
    if (isPhantomAvailable()) {
      return await connectPhantom();
    } else if (isSolflareAvailable()) {
      return await connectSolflare();
    } else {
      setError('No Solana wallet found. Please install Phantom or Solflare.');
      return false;
    }
  }, [connectPhantom, connectSolflare]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      if (walletType === 'phantom' && window.solana) {
        await window.solana.disconnect();
      } else if (walletType === 'solflare' && window.solflare) {
        await window.solflare.disconnect();
      }
      
      setWalletAddress(null);
      setConnected(false);
      setWalletType(null);
      console.log('✅ Wallet disconnected');
    } catch (err) {
      console.error('❌ Disconnect error:', err);
    }
  }, [walletType]);

  // Sign a transaction
  const signTransaction = useCallback(async (unsignedTransaction) => {
    if (!connected) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('📝 Signing transaction...');

      // Parse base64 transaction (browser-compatible)
      const binaryString = atob(unsignedTransaction);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Try to parse as versioned transaction first (Jupiter uses v0)
      let transaction;
      try {
        transaction = VersionedTransaction.deserialize(bytes);
        console.log('🔄 Detected versioned transaction (v0)');
      } catch (e) {
        // Fallback to legacy transaction
        transaction = Transaction.from(bytes);
        console.log('🔄 Detected legacy transaction');
      }

      // Sign with appropriate wallet
      let signedTx;
      if (walletType === 'phantom' && window.solana) {
        signedTx = await window.solana.signTransaction(transaction);
      } else if (walletType === 'solflare' && window.solflare) {
        signedTx = await window.solflare.signTransaction(transaction);
      } else {
        throw new Error('No wallet available for signing');
      }

      // Serialize to base64 (browser-compatible)
      const serialized = signedTx.serialize();
      const signedBase64 = btoa(String.fromCharCode.apply(null, serialized));
      console.log('✅ Transaction signed');
      
      return signedBase64;
    } catch (err) {
      console.error('❌ Signing error:', err);
      throw new Error(`Failed to sign transaction: ${err.message}`);
    }
  }, [connected, walletType]);

  // Sign and send a transaction
  const signAndSendTransaction = useCallback(async (unsignedTransaction) => {
    if (!connected) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('📝 Signing and sending transaction...');

      // Parse base64 transaction (browser-compatible)
      const binaryString = atob(unsignedTransaction);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Try to parse as versioned transaction first (Jupiter uses v0)
      let transaction;
      try {
        transaction = VersionedTransaction.deserialize(bytes);
        console.log('🔄 Detected versioned transaction (v0)');
      } catch (e) {
        // Fallback to legacy transaction
        transaction = Transaction.from(bytes);
        console.log('🔄 Detected legacy transaction');
      }

      // Sign and send with appropriate wallet
      let signature;
      if (walletType === 'phantom' && window.solana) {
        const { signature: sig } = await window.solana.signAndSendTransaction(transaction);
        signature = sig;
      } else if (walletType === 'solflare' && window.solflare) {
        signature = await window.solflare.signAndSendTransaction(transaction);
      } else {
        throw new Error('No wallet available for signing');
      }

      console.log('✅ Transaction sent:', signature);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('✅ Transaction confirmed');
      
      return signature;
    } catch (err) {
      console.error('❌ Transaction error:', err);
      throw new Error(`Failed to send transaction: ${err.message}`);
    }
  }, [connected, walletType, connection]);

  // Get wallet balance
  const getBalance = useCallback(async () => {
    if (!walletAddress) return null;

    try {
      const publicKey = new window.solanaWeb3.PublicKey(walletAddress);
      const balance = await connection.getBalance(publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (err) {
      console.error('Error fetching balance:', err);
      return null;
    }
  }, [walletAddress, connection]);

  // Force re-check wallet connection status
  const recheckConnection = useCallback(async () => {
    console.log('🔄 Rechecking wallet connection...');
    console.log('   Current state before recheck:', { 
      walletAddress: walletAddress || 'null', 
      connected,
      walletType: walletType || 'null'
    });
    
    if (isPhantomAvailable()) {
      console.log('   Checking Phantom...');
      console.log('   window.solana.isConnected:', window.solana.isConnected);
      console.log('   window.solana.publicKey:', window.solana.publicKey?.toString() || 'null');
      
      if (window.solana.isConnected && window.solana.publicKey) {
        const address = window.solana.publicKey.toString();
        console.log('✅ Phantom IS connected! Setting state...');
        console.log('   Setting walletAddress to:', address);
        setWalletAddress(address);
        setConnected(true);
        setWalletType('phantom');
        console.log('   State update triggered');
        return true;
      } else {
        console.log('❌ Phantom not connected (isConnected or publicKey is falsy)');
      }
    } else {
      console.log('   ❌ Phantom not available');
    }
    
    if (isSolflareAvailable()) {
      console.log('   Checking Solflare...');
      if (window.solflare.isConnected && window.solflare.publicKey) {
        const address = window.solflare.publicKey.toString();
        console.log('✅ Solflare IS connected! Setting state...');
        setWalletAddress(address);
        setConnected(true);
        setWalletType('solflare');
        return true;
      } else {
        console.log('❌ Solflare not connected');
      }
    } else {
      console.log('   ❌ Solflare not available');
    }
    
    console.log('❌ No wallet connected');
    return false;
  }, [walletAddress, connected, walletType]);

  const value = {
    // State
    walletAddress,
    connected,
    connecting,
    error,
    walletType,
    
    // Connection methods
    connect,
    connectPhantom,
    connectSolflare,
    disconnect,
    recheckConnection,
    
    // Transaction methods
    signTransaction,
    signAndSendTransaction,
    
    // Utility
    getBalance,
    isPhantomAvailable: isPhantomAvailable(),
    isSolflareAvailable: isSolflareAvailable(),
    
    // Connection instance (for advanced use)
    connection
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletContext;
