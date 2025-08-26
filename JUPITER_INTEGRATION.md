# Jupiter Trading Integration

This document describes the Jupiter trading integration for the meme coin discovery app.

## Features

### 1. Trade Button in Coin Cards
- Each meme coin card now has a "Trade" button next to the favorite button
- Clicking the trade button opens the Jupiter trading interface with that specific coin pre-selected

### 2. Global Trade Button in Navigation
- The navigation bar has a prominent "Trade" button that opens Jupiter trading
- When clicked from navigation, it uses the first coin currently visible in the feed

### 3. Jupiter Trading Interface
- Custom UI built on top of Jupiter's API
- Supports trading SOL and USDC for any meme coin
- Real-time quotes from Jupiter's aggregator
- Configurable slippage tolerance
- Transaction execution through connected Solana wallet

### 4. Wallet Integration
- Phantom, Solflare, and other Solana wallets supported
- Wallet connection required for trading
- Secure transaction signing

## Technical Implementation

### Frontend Components
- `JupiterTrading.jsx` - Main trading interface
- `WalletProvider.jsx` - Solana wallet connection wrapper
- Updated `App.jsx` to handle trading state
- Updated `TokenScroller.jsx` to add trade buttons
- Updated `BottomNavBar.jsx` for navigation

### Dependencies Added
- `@solana/web3.js` - Solana blockchain interaction
- `@solana/wallet-adapter-*` - Wallet connection and UI
- `@jup-ag/api` - Jupiter aggregator API
- `bn.js` - Big number handling

### API Integration
- Uses Jupiter's v6 Quote API for price discovery
- Uses Jupiter's Swap API for transaction creation
- Real-time quote updates as user types

## Usage Flow

1. User browses meme coins in the TikTok-style interface
2. User clicks either:
   - Trade button on a specific coin card, OR
   - Trade button in the navigation bar
3. Jupiter trading interface opens with the selected coin
4. User connects their Solana wallet
5. User enters amount to trade and adjusts slippage if needed
6. User reviews quote and executes swap
7. Transaction is submitted to Solana blockchain

## Configuration

The integration uses:
- **Solana Network**: Mainnet
- **RPC Endpoint**: Public Solana RPC
- **Jupiter API**: Public v6 endpoints
- **Default Slippage**: 1%

## Notes

- All trading happens on-chain through Jupiter's smart routing
- Best prices are automatically found across multiple DEXes
- No additional fees beyond standard Solana transaction costs
- Wallet security handled by user's chosen wallet extension
