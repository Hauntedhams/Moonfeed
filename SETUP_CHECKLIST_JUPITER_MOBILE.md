# ✅ Jupiter Mobile Setup Checklist

## 📋 Complete These Steps

### ✅ Step 1: Get Reown Project ID
- [ ] Go to https://dashboard.reown.com/
- [ ] Sign up / Log in with GitHub
- [ ] Click "Create Project"
- [ ] Enter project details:
  - Name: `Moonfeed`
  - Description: `Meme coin discovery app`
  - URL: Your domain or `http://localhost:5173`
- [ ] Copy the Project ID (in top navigation)

### ✅ Step 2: Add Project ID to Code
- [ ] Open `/frontend/src/main.jsx`
- [ ] Find line ~27: `projectId: 'YOUR_REOWN_PROJECT_ID',`
- [ ] Replace with your actual Project ID
- [ ] Save the file

### ✅ Step 3: Test the Integration
- [ ] Run `cd frontend && npm run dev`
- [ ] Open app in browser
- [ ] Look for wallet connection
- [ ] Verify QR code appears

### ✅ Step 4: Add Wallet Button to UI (Choose One or More)

#### Option A: Add to Main Feed (Recommended)
- [ ] Open `/frontend/src/components/ModernTokenScroller.jsx`
- [ ] Import: `import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';`
- [ ] Add button to `banner-overlay-buttons` div (see EXAMPLE_WALLET_BUTTON_INTEGRATION.jsx)
- [ ] Style with CSS

#### Option B: Use Existing Wallet Context
- [ ] Your existing `useWallet()` calls now use Jupiter automatically
- [ ] No code changes needed!

#### Option C: Add to Trade Modal
- [ ] Open `/frontend/src/components/TradeModal.jsx`
- [ ] Import UnifiedWalletButton
- [ ] Replace existing connect button

#### Option D: Add to Profile
- [ ] Open `/frontend/src/components/ProfileView.jsx`
- [ ] Replace existing wallet connect button with UnifiedWalletButton

### ✅ Step 5: Test on Mobile
- [ ] Install Jupiter Mobile:
  - iOS: https://apps.apple.com/us/app/jupiter-mobile/id6484069059
  - Android: https://play.google.com/store/apps/details?id=ag.jup.jupiter.android
- [ ] Open your app on phone
- [ ] Click "Connect Wallet"
- [ ] Should open Jupiter Mobile app
- [ ] Approve connection
- [ ] Verify connection works

### ✅ Step 6: Deploy
- [ ] Build for production: `npm run build`
- [ ] Deploy to your hosting
- [ ] Update Reown project URL to production domain
- [ ] Test on live site

---

## 🎉 You're Done!

Once all boxes are checked, your app fully supports Jupiter Mobile!

Users can now:
- 📱 Connect via QR code or deep link
- 💰 Trade directly from mobile wallet
- 🔐 Keep keys secure on their device
- ⚡ Execute lightning-fast trades

---

## 📚 Reference Files

If you need help with any step, check these files:

- **Quick Start**: `QUICK_START_JUPITER_MOBILE.md`
- **Full Guide**: `JUPITER_MOBILE_INTEGRATION_COMPLETE.md`
- **What Changed**: `CHANGES_SUMMARY_JUPITER_MOBILE.md`
- **Code Examples**: `EXAMPLE_WALLET_BUTTON_INTEGRATION.jsx`

---

## 🆘 Troubleshooting

### ❌ QR Code not showing
→ Did you set the Project ID in main.jsx?

### ❌ Build errors
→ Run: `rm -rf node_modules && npm install`

### ❌ Can't connect on mobile
→ Is Jupiter Mobile installed and updated?

### ❌ Connection fails
→ Check browser console for errors
→ Verify Project ID is correct
→ Try a different browser

---

## 📞 Get Help

- **Jupiter Discord**: https://discord.gg/jup
- **Jupiter Docs**: https://dev.jup.ag/tool-kits/wallet-kit
- **Reown Docs**: https://docs.reown.com/

---

**Happy Trading! 🚀**
