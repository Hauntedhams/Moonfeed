/**
 * Wallet notification handler for Jupiter Wallet Kit
 * Provides callback functions for various wallet events
 * These callbacks MUST exist for Jupiter to work properly
 */
export const WalletNotification = {
  onConnect: (publicKey) => {
    if (typeof console !== 'undefined') {
      console.log('Wallet Connected:', publicKey?.toString());
    }
    return true;
  },
  
  onConnecting: (walletName) => {
    if (typeof console !== 'undefined') {
      console.log('Connecting to wallet:', walletName);
    }
    return true;
  },
  
  onDisconnect: () => {
    if (typeof console !== 'undefined') {
      console.log('Wallet Disconnected');
    }
    return true;
  },
  
  onNotInstalled: (walletName) => {
    if (typeof console !== 'undefined') {
      console.log('Wallet not installed:', walletName);
    }
    return true;
  },
  
  onError: (error) => {
    if (typeof console !== 'undefined' && console.error) {
      console.error('Wallet Error:', error);
    }
    return true;
  },
  
  onChangeAccount: (publicKey) => {
    if (typeof console !== 'undefined') {
      console.log('Account Changed:', publicKey?.toString());
    }
    return true;
  },
};
