# Jupiter Mobile Adapter Setup Guide

## 🎯 Overview

This app now supports **Jupiter Mobile Adapter**, allowing users to connect their Jupiter Mobile wallet by scanning a QR code! This provides a seamless mobile trading experience within your Moonfeed app.

## 📱 What Users Get

- **QR Code Login**: Scan with Jupiter Mobile app to connect
- **Mobile Trading**: Buy and sell tokens directly from their phone
- **Secure**: Uses WalletConnect protocol for secure connections
- **Cross-Platform**: Works on any device with Jupiter Mobile

## ⚙️ Setup Instructions

### Step 1: Get a Reown Project ID

The Jupiter Mobile Adapter uses Reown's (formerly WalletConnect) AppKit under the hood. You need a free project ID:

1. Visit [https://dashboard.reown.com/](https://dashboard.reown.com/)
2. Sign up or log in with your GitHub account
3. Click "Create Project"
4. Enter your app details:
   - **Name**: Moonfeed
   - **Description**: Meme coin discovery app
   - **URL**: Your app's URL (or localhost for development)
5. Copy the **Project ID** from the dashboard

### Step 2: Add Project ID to Your App

Open `/frontend/src/main.jsx` and replace `'YOUR_REOWN_PROJECT_ID'` with your actual project ID:

```javascript
projectId: 'abc123...', // Your Reown project ID here
```

### Step 3: Test the Integration

1. Start your app: `npm run dev`
2. Open the wallet connect button in your app
3. You should see a QR code displayed
4. Open Jupiter Mobile app and scan the QR code
5. Approve the connection request
6. You're connected! 🎉

## 📦 Download Jupiter Mobile

Users will need the Jupiter Mobile app to connect:

- **iOS**: [App Store](https://apps.apple.com/us/app/jupiter-mobile/id6484069059)
- **Android**: [Play Store](https://play.google.com/store/apps/details?id=ag.jup.jupiter.android)
- **Web**: [jup.ag/mobile](https://jup.ag/mobile)

## 🔧 Integration Points

The Jupiter Mobile Adapter is now integrated with:

1. **Wallet Context** (`/frontend/src/contexts/WalletContext.jsx`) - Uses Jupiter's UnifiedWallet
2. **Trade Modal** - Users can connect wallet and trade tokens
3. **Favorites** - Connect wallet to save favorites across devices

## 🚀 Next Steps

After setting up your Reown Project ID:

1. Add a visible "Connect Wallet" button to your UI
2. Test on both desktop (QR code) and mobile (deep link)
3. Implement wallet-gated features (favorites, portfolio tracking, etc.)
4. Consider adding other wallet adapters (Phantom, Solflare, etc.)

## 🐛 Troubleshooting

**QR Code doesn't appear:**
- Check that your Reown Project ID is correct
- Make sure you're running in HTTPS (or localhost)
- Check browser console for errors

**Jupiter Mobile can't connect:**
- Ensure you're on the same network (for localhost testing)
- Try restarting the Jupiter Mobile app
- Check that the app has the latest version

**Build errors:**
- Run `npm install` to ensure all packages are installed
- Clear node_modules and reinstall if needed
- Check that you're using Node.js 16+ and npm 7+

## 📚 Resources

- [Jupiter Wallet Kit Docs](https://dev.jup.ag/tool-kits/wallet-kit)
- [Reown Dashboard](https://dashboard.reown.com/)
- [Jupiter Discord](https://discord.gg/jup) - Get help from the community
