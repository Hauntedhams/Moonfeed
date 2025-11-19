# 🔄 Jupiter Mobile Adapter - Architecture & Flow

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Moonfeed App                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    React App                          │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │        UnifiedWalletProvider                    │  │  │
│  │  │  (Jupiter Wallet Kit)                           │  │  │
│  │  │  ┌────────────────────────────────────────┐    │  │  │
│  │  │  │    Jupiter Mobile Adapter              │    │  │  │
│  │  │  │    (useWrappedReownAdapter)            │    │  │  │
│  │  │  │  ┌──────────────────────────────────┐  │    │  │  │
│  │  │  │  │    Reown AppKit                  │  │    │  │  │
│  │  │  │  │    (WalletConnect v2)            │  │    │  │  │
│  │  │  │  └──────────────────────────────────┘  │    │  │  │
│  │  │  └────────────────────────────────────────┘    │  │  │
│  │  │                                                 │  │  │
│  │  │  Your Components:                              │  │  │
│  │  │  ├─ WalletContext (useWallet hook)             │  │  │
│  │  │  ├─ ModernTokenScroller                        │  │  │
│  │  │  ├─ TradeModal                                 │  │  │
│  │  │  └─ ProfileView                                │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ WalletConnect Protocol
                               │ (End-to-End Encrypted)
                               │
                               ▼
                   ┌───────────────────────┐
                   │  Reown Bridge Server  │
                   │  (WalletConnect Relay)│
                   └───────────────────────┘
                               │
                               │ Deep Link / QR Code
                               │
                               ▼
                   ┌───────────────────────┐
                   │   Jupiter Mobile App  │
                   │   (User's Device)     │
                   │  ┌──────────────────┐ │
                   │  │   User Wallet    │ │
                   │  │   (Private Keys) │ │
                   │  └──────────────────┘ │
                   └───────────────────────┘
```

---

## 🔄 Connection Flow

### Desktop (QR Code)
```
1. User clicks "Connect Wallet" in your app
       │
       ▼
2. UnifiedWalletButton shows modal with QR code
       │
       ▼
3. User scans QR with Jupiter Mobile app
       │
       ▼
4. Jupiter Mobile decodes WalletConnect URI
       │
       ▼
5. User approves connection in mobile app
       │
       ▼
6. Connection established via Reown bridge
       │
       ▼
7. Your app receives wallet public key
       │
       ▼
8. ✅ Connected! User can now sign transactions
```

### Mobile (Deep Link)
```
1. User clicks "Connect Wallet" in mobile browser
       │
       ▼
2. App generates WalletConnect deep link
       │
       ▼
3. Browser auto-opens Jupiter Mobile app
       │
       ▼
4. User approves connection in app
       │
       ▼
5. App redirects back to browser
       │
       ▼
6. Connection established
       │
       ▼
7. ✅ Connected! Seamless experience
```

---

## 💱 Transaction Flow

```
Your App              Jupiter Wallet Kit       Jupiter Mobile
    │                         │                        │
    │ 1. User clicks "Buy"    │                        │
    ├────────────────────────>│                        │
    │                         │                        │
    │ 2. Fetch quote          │                        │
    ├────────────────────────>│                        │
    │                         │                        │
    │ 3. Build transaction    │                        │
    │<────────────────────────┤                        │
    │                         │                        │
    │ 4. Request signature    │                        │
    ├────────────────────────>│                        │
    │                         │ 5. Send to wallet      │
    │                         ├───────────────────────>│
    │                         │                        │
    │                         │ 6. User approves       │
    │                         │<───────────────────────┤
    │                         │                        │
    │ 7. Signed transaction   │                        │
    │<────────────────────────┤                        │
    │                         │                        │
    │ 8. Send to Solana RPC   │                        │
    ├──────────────────────────────────────────────────>
    │                         │                        │
    │ 9. ✅ Transaction confirmed                      │
    │                         │                        │
```

---

## 🏗️ File Structure

```
frontend/
├── src/
│   ├── main.jsx                         ⭐ Jupiter Wallet Kit setup
│   ├── contexts/
│   │   └── WalletContext.jsx            ⭐ Your wallet logic (updated)
│   ├── components/
│   │   ├── WalletNotification.jsx       ✨ New: Notification handler
│   │   ├── JupiterWalletButton.jsx      ✨ New: Styled button
│   │   ├── JupiterWalletButton.css      ✨ New: Button styles
│   │   ├── ModernTokenScroller.jsx      ← Add wallet button here
│   │   ├── TradeModal.jsx               ← Already uses wallet context
│   │   └── ProfileView.jsx              ← Already has wallet UI
│   └── ...
├── package.json                         ⭐ Updated dependencies
└── ...

docs/ (root)
├── QUICK_START_JUPITER_MOBILE.md        📘 Start here!
├── INTEGRATION_STATUS_JUPITER_MOBILE.md 📊 Current status
├── SETUP_CHECKLIST_JUPITER_MOBILE.md    ✅ Step-by-step
└── EXAMPLE_WALLET_BUTTON_INTEGRATION.jsx 💻 Code examples
```

---

## 🔑 Key Components

### 1. UnifiedWalletProvider (main.jsx)
- **Purpose**: Top-level wallet context provider
- **What it does**: Manages all wallet connections
- **Configuration**: Needs Reown Project ID

### 2. useWrappedReownAdapter (main.jsx)
- **Purpose**: Creates Jupiter Mobile adapter
- **What it does**: Enables WalletConnect + mobile support
- **Configuration**: AppKit metadata + Reown Project ID

### 3. WalletContext (contexts/WalletContext.jsx)
- **Purpose**: Your app's wallet interface
- **What it does**: Wraps Jupiter wallet with familiar API
- **Usage**: `useWallet()` hook in components

### 4. UnifiedWalletButton (Components)
- **Purpose**: Pre-built connect button
- **What it does**: Shows modal, handles connection
- **Customization**: Fully themeable

---

## 🔐 Security Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Private Keys NEVER leave Jupiter Mobile app         │
│    ✅ Keys stay on user's device                       │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Connection via WalletConnect (E2E Encrypted)         │
│    ✅ End-to-end encryption                            │
│    ✅ No man-in-the-middle attacks                     │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Transactions must be approved by user                │
│    ✅ User sees transaction details                    │
│    ✅ User explicitly approves                         │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Your app only receives signed transactions           │
│    ✅ Never has access to private keys                 │
│    ✅ Can't sign without user approval                 │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow

### Connection State
```javascript
// In your components:
const { 
  connected,        // Boolean: Is wallet connected?
  walletAddress,    // String: User's public key
  connecting,       // Boolean: Connection in progress?
  walletType        // String: 'Jupiter Mobile', 'Phantom', etc.
} = useWallet();
```

### Available Methods
```javascript
const {
  connect,                 // Open wallet modal
  disconnect,              // Close connection
  signTransaction,         // Sign a transaction
  signAndSendTransaction,  // Sign + send to RPC
  getBalance               // Get SOL balance
} = useWallet();
```

---

## 🎯 Integration Points

```
ModernTokenScroller (Main Feed)
├── Banner Overlay
│   ├── Moonfeed Info Button (existing)
│   ├── 📱 Wallet Button (NEW - add here!)
│   └── Search Button (existing)
└── CoinCard
    └── Trade Button
        └── TradeModal
            └── Uses wallet context (existing)

ProfileView
└── Wallet Section
    └── 📱 Wallet Button (NEW - replace existing)

FavoritesGrid
└── Wallet Prompt
    └── 📱 Wallet Button (NEW - replace existing)
```

---

## 🚀 Quick Integration Example

```jsx
// In any component:
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import { useWallet } from './contexts/WalletContext';

function MyComponent() {
  const { connected, walletAddress } = useWallet();
  
  return (
    <div>
      {/* Jupiter's pre-built button */}
      <UnifiedWalletButton />
      
      {/* Show wallet state */}
      {connected && (
        <p>Connected: {walletAddress.slice(0,4)}...</p>
      )}
      
      {/* Your feature that needs wallet */}
      {connected && (
        <button onClick={handleTrade}>Trade Now</button>
      )}
    </div>
  );
}
```

---

## 📱 Mobile UX Flow

```
User opens Moonfeed in mobile browser
    │
    ├─ Sees "Connect Wallet" button
    │
    ▼
Clicks "Connect Wallet"
    │
    ├─ App generates WalletConnect deep link
    │  (e.g., jup://wc?uri=...)
    │
    ▼
Mobile browser opens Jupiter Mobile app
    │
    ├─ User sees connection request
    │  "Moonfeed wants to connect"
    │
    ▼
User approves in Jupiter Mobile
    │
    ├─ Connection established
    │  (keys stay in mobile app)
    │
    ▼
App redirects back to browser
    │
    ├─ ✅ Wallet connected!
    │
    ▼
User can now trade, sign transactions, etc.
    │
    ├─ Every transaction requires approval
    │  (Jupiter Mobile opens for each signature)
    │
    ▼
Seamless mobile trading experience! 🎉
```

---

## 🎨 UI/UX Best Practices

### Button Placement
- **Top Right**: Always visible, familiar location
- **Trade Modal**: Show when action requires wallet
- **Profile**: Settings and account management

### Visual Feedback
- Show "Connecting..." state
- Display connected wallet address (truncated)
- Use icons for wallet type (Jupiter, Phantom, etc.)

### Error Handling
- Clear error messages
- Retry button for failed connections
- Help links to troubleshooting

---

## 🔧 Debugging

### Check Console Logs
```javascript
// Your app logs these:
✅ Wallet connected (Jupiter Mobile): abc123...
📝 Signing transaction...
✅ Transaction signed
✅ Transaction sent: signature123...
```

### Common Issues
```
❌ "projectId is required"
   → Add Reown Project ID to main.jsx

❌ QR code not showing
   → Check Reown dashboard, verify HTTPS

❌ Mobile deep link fails
   → Ensure Jupiter Mobile is installed
   → Update to latest version
```

---

**Architecture designed for:**
- ✅ Security (keys never exposed)
- ✅ UX (seamless mobile experience)
- ✅ Compatibility (works with all wallets)
- ✅ Performance (lazy-loaded, optimized)

**You're ready to build! 🚀**
