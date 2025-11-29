/**
 * Wallet notification handler for Jupiter Wallet Kit
 * Provides callback functions for various wallet events
 */
export const WalletNotification = {
  onConnect: (publicKey) => {
    console.log('✅ Wallet Connected:', publicKey?.toString());
  },
  
  onConnecting: (walletName) => {
    console.log('🔄 Connecting to wallet:', walletName);
  },
  
  onDisconnect: () => {
    console.log('� Wallet Disconnected');
  },
  
  onNotInstalled: (walletName) => {
    console.log('⚠️ Wallet not installed:', walletName);
  },
  
  onError: (error) => {
    console.error('❌ Wallet Error:', error);
  },
  
  onChangeAccount: (publicKey) => {
    console.log('� Account Changed:', publicKey?.toString());
  },
};
