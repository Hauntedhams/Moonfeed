import React from 'react';

/**
 * Wallet notification handler for Jupiter Wallet Kit
 * Displays user-friendly notifications for wallet events
 */
export const WalletNotification = (notification) => {
  // You can customize this to use your preferred notification library
  // For now, we'll use simple console logging and browser notifications
  
  const { type, message } = notification;
  
  console.log(`🔔 Wallet ${type}:`, message);
  
  // Display browser notification if available
  if (message && typeof message === 'string') {
    // For development, we'll just log. In production, you might want a toast library
    console.log(`📱 ${type.toUpperCase()}: ${message}`);
  }
  
  return null;
};
