# 🚀 Jupiter Mobile - Quick Reference

## ⚡ 1-Minute Setup

### Get Project ID
1. https://dashboard.reown.com/ → Sign up
2. Create project → Copy Project ID
3. `/frontend/src/main.jsx` line 27 → Paste ID

### Test It
```bash
cd frontend && npm run dev
```

---

## 🎨 Add Wallet Button (Pick One)

### Easiest - Drop-in Component
```jsx
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
<UnifiedWalletButton />
```

### Styled - Custom Component
```jsx
import JupiterWalletButton from './components/JupiterWalletButton';
<JupiterWalletButton />
```

### Custom - Your Own UI
```jsx
import { useWallet } from './contexts/WalletContext';
const { connect, connected } = useWallet();
<button onClick={connect}>Connect</button>
```

---

## ✅ What Works

✅ Desktop QR codes
✅ Mobile deep links
✅ Transaction signing
✅ Auto-reconnect
✅ Multi-wallet support

---

## 📱 Test on Mobile

1. Install Jupiter Mobile:
   - iOS: https://apps.apple.com/us/app/jupiter-mobile/id6484069059
   - Android: https://play.google.com/store/apps/details?id=ag.jup.jupiter.android

2. Open app → Connect Wallet → Scan QR or tap deep link → Done! ✅

---

## 🐛 Issues?

**No QR code?** → Check Project ID in main.jsx
**Build errors?** → `npm install`
**Mobile won't connect?** → Update Jupiter Mobile app

---

## 📚 Full Docs

- Quick Start: `QUICK_START_JUPITER_MOBILE.md`
- Full Guide: `JUPITER_MOBILE_INTEGRATION_COMPLETE.md`
- Status: `INTEGRATION_STATUS_JUPITER_MOBILE.md`

---

**Ready! 🎉 Just add your Reown Project ID and you're live!**
