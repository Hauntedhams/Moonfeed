import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Connection, Transaction, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { useWallet as useJupiterWallet } from '@jup-ag/wallet-adapter';

/**
 * Wallet Context for managing wallet connection via Jupiter Wallet Kit
 * Supports Jupiter Mobile, Phantom, Solflare, and other Solana wallets
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
  // Use Jupiter Wallet Kit's wallet hook
  const jupiterWallet = useJupiterWallet();
  
  const [error, setError] = useState(null);

  // Solana connection
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  // Derive wallet state from Jupiter wallet
  const walletAddress = jupiterWallet.publicKey?.toString() || null;
  const connected = jupiterWallet.connected || false;
  const connecting = jupiterWallet.connecting || false;
  const walletType = jupiterWallet.wallet?.adapter?.name || null;

  // Log wallet state changes
  useEffect(() => {
    if (connected && walletAddress) {
      console.log(`✅ Wallet connected (${walletType}):`, walletAddress);
    } else if (!connected && walletAddress === null) {
      console.log('🔌 Wallet disconnected');
    }
  }, [connected, walletAddress, walletType]);

  // Connect wallet (opens Jupiter wallet modal)
  const connect = useCallback(async () => {
    try {
      setError(null);
      if (jupiterWallet.connect) {
        await jupiterWallet.connect();
        return true;
      }
      return false;
    } catch (err) {
      console.error('❌ Wallet connection error:', err);
      setError('Failed to connect wallet');
      return false;
    }
  }, [jupiterWallet]);

  // Legacy functions for backwards compatibility
  const connectPhantom = connect;
  const connectSolflare = connect;

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      if (jupiterWallet.disconnect) {
        await jupiterWallet.disconnect();
        console.log('✅ Wallet disconnected');
      }
    } catch (err) {
      console.error('❌ Disconnect error:', err);
    }
  }, [jupiterWallet]);

  // Sign a transaction
  const signTransaction = useCallback(async (unsignedTransaction) => {
    if (!connected || !jupiterWallet.signTransaction) {
      throw new Error('Wallet not connected or does not support signing');
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

      // Sign with Jupiter wallet adapter
      const signedTx = await jupiterWallet.signTransaction(transaction);

      // Serialize to base64 (browser-compatible)
      const serialized = signedTx.serialize();
      const signedBase64 = btoa(String.fromCharCode.apply(null, serialized));
      console.log('✅ Transaction signed');
      
      return signedBase64;
    } catch (err) {
      console.error('❌ Signing error:', err);
      throw new Error(`Failed to sign transaction: ${err.message}`);
    }
  }, [connected, jupiterWallet]);

  // Sign and send a transaction
  const signAndSendTransaction = useCallback(async (unsignedTransaction) => {
    if (!connected || !jupiterWallet.sendTransaction) {
      throw new Error('Wallet not connected or does not support sending transactions');
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

      // Send transaction with Jupiter wallet adapter
      const signature = await jupiterWallet.sendTransaction(transaction, connection);
      console.log('✅ Transaction sent:', signature);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('✅ Transaction confirmed');
      
      return signature;
    } catch (err) {
      console.error('❌ Transaction error:', err);
      throw new Error(`Failed to send transaction: ${err.message}`);
    }
  }, [connected, jupiterWallet, connection]);

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

  // Force re-check wallet connection status (just returns current state for Jupiter wallet)
  const recheckConnection = useCallback(async () => {
    console.log('🔄 Rechecking wallet connection...');
    console.log('   Current state:', { 
      walletAddress: walletAddress || 'null', 
      connected,
      walletType: walletType || 'null'
    });
    return connected;
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
    
    // Jupiter wallet adapter for advanced use
    wallet: jupiterWallet,
    
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
