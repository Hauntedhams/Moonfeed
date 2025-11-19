# 🎯 Quick Start: Jupiter Mobile Adapter

## ⚡ 3 Steps to Enable Mobile Trading

### 1️⃣ Get Reown Project ID (2 minutes)

Visit: https://dashboard.reown.com/

1. Sign up with GitHub
2. Create new project named "Moonfeed"
3. Copy the Project ID (looks like: `abc123def456...`)

### 2️⃣ Add to Your App (30 seconds)

Open: `/frontend/src/main.jsx` (line ~27)

Replace:
```javascript
projectId: 'YOUR_REOWN_PROJECT_ID',
```

With:
```javascript
projectId: 'abc123...',  // Your actual project ID here
```

### 3️⃣ Test It! (1 minute)

```bash
cd frontend
npm run dev
```

Open your app → Look for wallet connect → Scan QR with Jupiter Mobile!

---

## 🎨 Add Wallet Button to Your UI

### Option A: Use Pre-built Component (Easiest)

```jsx
import JupiterWalletButton from './components/JupiterWalletButton';

<JupiterWalletButton />
```

### Option B: Use Jupiter's Built-in (Most Flexible)

```jsx
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';

<UnifiedWalletButton />
```

### Option C: Custom Button (Full Control)

```jsx
import { useWallet } from './contexts/WalletContext';

const { connect, disconnect, connected, walletAddress } = useWallet();

{!connected ? (
  <button onClick={connect}>Connect</button>
) : (
  <button onClick={disconnect}>{walletAddress.slice(0,4)}...</button>
)}
```

---

## 📍 Where to Add the Button?

Choose one (or all):

1. **Top Navigation Bar** - Always visible
2. **Trade Modal** - When user tries to trade
3. **Profile Page** - With user settings
4. **Favorites** - To save/sync favorites

---

## ✅ What Works Now

- ✅ QR code connection on desktop
- ✅ Deep link connection on mobile
- ✅ Transaction signing
- ✅ All existing wallet features
- ✅ Auto-reconnect on page load
- ✅ Multi-wallet support

---

## 📱 Test on Mobile

1. Install Jupiter Mobile:
   - iOS: https://apps.apple.com/us/app/jupiter-mobile/id6484069059
   - Android: https://play.google.com/store/apps/details?id=ag.jup.jupiter.android

2. Open your app on phone
3. Click "Connect Wallet"
4. Should auto-open Jupiter Mobile app
5. Approve connection
6. Done! 🎉

---

## 🐛 Issues?

### QR Code not showing?
→ Check that Project ID is set in main.jsx

### Build error?
→ Run: `npm install`

### Can't connect on mobile?
→ Make sure Jupiter Mobile is installed and updated

### Still stuck?
→ Check console for errors
→ See full docs: JUPITER_MOBILE_INTEGRATION_COMPLETE.md

---

## 🚀 You're Done!

Your app now supports Jupiter Mobile wallet connections! Users can trade directly from their phones with secure, mobile-first wallet integration.

**Next**: Add the wallet button to your UI and test with Jupiter Mobile app!

---

## 📚 Full Documentation

- Main Guide: `JUPITER_MOBILE_INTEGRATION_COMPLETE.md`
- Code Examples: `EXAMPLE_WALLET_BUTTON_INTEGRATION.jsx`
- Jupiter Docs: https://dev.jup.ag/tool-kits/wallet-kit
- Need Help?: https://discord.gg/jup
