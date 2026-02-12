# Unified Wallet Connection System

## Overview

The app now uses a **single, unified wallet connection system** powered by Jupiter's Wallet Kit (`@jup-ag/wallet-adapter`). This ensures wallet state is consistent across all tabs, components, AND the Jupiter Terminal swap interface.

## How It Works

When you connect your wallet **anywhere** in the app:
- ✅ Connect via "Connect Wallet" buttons → Works everywhere including Jupiter Terminal
- ✅ Connect via Jupiter Terminal's connect button → Works everywhere in the app
- ✅ Disconnect anywhere → Disconnects everywhere

This is achieved through:
1. **UnifiedWalletProvider** - Wraps the entire app and manages wallet state
2. **Wallet Passthrough** - Jupiter Terminal is configured to share the same wallet context

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         main.jsx                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              UnifiedWalletProvider (Jupiter)              │  │
│  │    - Handles actual wallet connections                    │  │
│  │    - Supports: Phantom, Solflare, Coinbase, Coin98, etc. │  │
│  │    - Jupiter Mobile wallet via QR code                    │  │
│  │    ┌──────────────────────────────────────────────────┐  │  │
│  │    │                   App.jsx                        │  │  │
│  │    │  ┌────────────────────────────────────────────┐ │  │  │
│  │    │  │         WalletProvider (Context)           │ │  │  │
│  │    │  │   - Re-exports Jupiter wallet state        │ │  │  │
│  │    │  │   - Adds convenience methods               │ │  │  │
│  │    │  │   - signTransaction, signAndSendTx         │ │  │  │
│  │    │  │     ┌─────────────────────────────────┐   │ │  │  │
│  │    │  │     │      All App Components         │   │ │  │  │
│  │    │  │     │  - Home (ModernTokenScroller)   │   │ │  │  │
│  │    │  │     │  - Favorites (FavoritesGrid)    │   │ │  │  │
│  │    │  │     │  - Orders (OrdersView)          │   │ │  │  │
│  │    │  │     │  - Profile (ProfileView)        │   │ │  │  │
│  │    │  │     │  - Trade (JupiterTradeModal)    │   │ │  │  │
│  │    │  │     │  - Comments (CommentsSection)   │   │ │  │  │
│  │    │  │     └─────────────────────────────────┘   │ │  │  │
│  │    │  └────────────────────────────────────────────┘ │  │  │
│  │    └──────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## How to Use the Wallet

### Option 1: UnifiedWalletButton (Recommended for Connect Buttons)

```jsx
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';

// This renders a styled button that opens Jupiter's wallet modal
// Automatically handles connected/disconnected states
<UnifiedWalletButton />
```

### Option 2: useWallet Hook from Context (For Wallet State)

```jsx
import { useWallet } from '../contexts/WalletContext';

const MyComponent = () => {
  const { 
    walletAddress,    // string | null - the connected wallet address
    connected,        // boolean - is wallet connected
    connecting,       // boolean - is connection in progress
    disconnect,       // () => Promise<void> - disconnect wallet
    signTransaction,  // (tx) => Promise<signedTx> - sign a transaction
    walletType,       // string - 'Phantom', 'Solflare', etc.
  } = useWallet();

  if (!connected) {
    return <UnifiedWalletButton />;
  }

  return <div>Connected: {walletAddress}</div>;
};
```

### Option 3: useWallet Hook from Jupiter (Direct Access)

```jsx
import { useWallet as useJupiterWallet } from '@jup-ag/wallet-adapter';

const MyComponent = () => {
  const jupiterWallet = useJupiterWallet();
  const publicKey = jupiterWallet.publicKey;
  const connected = jupiterWallet.connected;
  // ... full Jupiter wallet adapter interface
};
```

## Components Updated

| Component | Old Import | New Import | Notes |
|-----------|------------|------------|-------|
| `OrdersView` | `@solana/wallet-adapter-react` | `@jup-ag/wallet-adapter` | Was using wrong adapter |
| `FavoritesGrid` | Custom button | `UnifiedWalletButton` | Consistent UI |
| `WalletButton` | Custom logic | `UnifiedWalletButton` | Simplified, consistent |
| `CommentsSection` | Custom `connect()` | `UnifiedWalletButton` | Opens wallet modal properly |
| `ProfileView` | `@jup-ag/wallet-adapter` | (unchanged) | Already correct |
| `TriggerOrderModal` | `WalletContext` | (unchanged) | Already correct |
| `JupiterTradeModal` | `WalletContext` | (unchanged) | Already correct |

## Wallet Flow

1. **User clicks any "Connect Wallet" button** (in any tab)
2. **Jupiter's wallet modal opens** - shows all supported wallets
3. **User selects wallet** (Phantom, Solflare, Jupiter Mobile QR, etc.)
4. **Wallet approves connection**
5. **All components update simultaneously** - wallet state is shared via React context

## Supported Wallets

- ✅ Phantom
- ✅ Solflare
- ✅ Coinbase Wallet
- ✅ Coin98
- ✅ Trust Wallet
- ✅ Jupiter Mobile (via QR code)
- ✅ Any Solana wallet that supports standard wallet-adapter

## Jupiter Terminal Integration

The Jupiter Terminal (swap interface) now requires users to connect their wallet through the app's unified wallet system first. This ensures:

- **One connection point**: Users always connect via the same `UnifiedWalletButton`
- **Consistent experience**: Same wallet modal everywhere in the app
- **No confusion**: No separate Jupiter wallet connect that doesn't sync

### How It Works:

1. User opens the Trade modal
2. If not connected → Shows custom "Connect Wallet" prompt with `UnifiedWalletButton`
3. User connects → Jupiter Terminal initializes with the wallet already connected
4. Wallet state is shared via `passthroughWalletContextState`

```jsx
// In JupiterTradeModal.jsx

// Show connect prompt if wallet not connected
{!jupiterWallet.connected && (
  <div className="jupiter-connect-prompt">
    <h3>Connect Your Wallet</h3>
    <UnifiedWalletButton />
  </div>
)}

// Only show Jupiter Terminal when connected
<div 
  id="jupiter-container"
  style={{ display: !jupiterWallet.connected ? 'none' : 'block' }}
/>

// Jupiter config with wallet passthrough
const jupiterConfig = {
  enableWalletPassthrough: true,
  passthroughWalletContextState: jupiterWallet,
  // ... other config
};
```

### Why Not Use Jupiter's Internal Connect?

Jupiter Terminal has its own internal wallet connection UI, but it uses a separate state that doesn't sync with the `UnifiedWalletProvider`. By hiding Jupiter's connect and showing our own, we ensure:

- ✅ Connect once, works everywhere
- ✅ Disconnect once, disconnects everywhere  
- ✅ No "connected in one place but not another" issues

## Testing

1. **Test 1: Connect via app button first**
   - Go to Profile or Orders tab
   - Click "Connect Wallet" button
   - Open Jupiter Trade modal → Should show same connected wallet

2. **Test 2: Connect via Jupiter first**
   - Open Jupiter Trade modal (click Trade on any coin)
   - Connect wallet through Jupiter's interface
   - Close modal, go to Profile/Orders → Should show connected

3. **Test 3: Disconnect**
   - Connect wallet anywhere
   - Disconnect from Profile or Jupiter Terminal
   - Check all tabs → All should show disconnected

## Troubleshooting

**Wallet shows disconnected in some tabs?**
- Make sure the component uses `useWallet` from `../contexts/WalletContext` or `@jup-ag/wallet-adapter`
- Do NOT use `@solana/wallet-adapter-react` (no provider is set up for it)

**Connect button doesn't open modal?**
- Use `<UnifiedWalletButton />` from `@jup-ag/wallet-adapter`
- The custom `connect()` method may not trigger the modal properly

**Transaction signing fails?**
- Use `signTransaction` from `useWallet()` context
- Make sure wallet is connected before calling sign methods
