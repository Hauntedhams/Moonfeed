# 🎯 YOUR AFFILIATE LINKS ARE READY!

## ✅ What You Have Now

### **2 Test Affiliates Created:**

1. **testaffiliate123**
   - Name: Test Influencer
   - Earnings: $4.00
   - Trades: 1
   - Link: `http://localhost:5173?ref=testaffiliate123`

2. **moonfeedtest**
   - Name: Moonfeed Test Affiliate
   - Earnings: $0.00
   - Trades: 0
   - Link: `http://localhost:5173?ref=moonfeedtest`

---

## 🚀 3 Ways to Test

### **Option 1: Open Test Page (Easiest!)**

```bash
open affiliate-test-page.html
```

This interactive page lets you:
- ✅ Copy referral links
- ✅ Set referral codes
- ✅ Simulate trades
- ✅ View stats
- ✅ All in a beautiful UI!

---

### **Option 2: Test in Your App**

1. **Visit with referral code:**
   ```
   http://localhost:5173?ref=moonfeedtest
   ```

2. **Check it saved:**
   - Open DevTools (F12)
   - Console tab
   - Type: `localStorage.getItem('moonfeed_referral_code')`
   - Should show: `"moonfeedtest"` ✅

3. **Make a trade** (when you integrate tracking)

---

### **Option 3: Use curl Commands**

**Create new affiliate:**
```bash
curl -X POST http://localhost:3001/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "yourcode123",
    "name": "Your Influencer Name",
    "walletAddress": "YOUR_SOLANA_WALLET",
    "sharePercentage": 50
  }'
```

**View all affiliates:**
```bash
curl http://localhost:3001/api/affiliates/list | python3 -m json.tool
```

**Simulate a trade:**
```bash
curl -X POST http://localhost:3001/api/affiliates/track-trade \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "moonfeedtest",
    "userWallet": "TestUser123",
    "tradeVolume": 1000,
    "feeEarned": 10,
    "tokenIn": "SOL",
    "tokenOut": "BONK"
  }' | python3 -m json.tool
```

**Check stats:**
```bash
curl http://localhost:3001/api/affiliates/moonfeedtest/stats | python3 -m json.tool
```

---

## 📊 How the Fee Split Works

### Example: User trades $5,000 SOL → BONK

```
Trade Volume: $5,000
Your Fee (1%): $50
├─ Jupiter Cut (20%): $10
└─ Net to Your Wallet: $40
   ├─ Influencer (50%): $20 💰
   └─ Platform (You): $20 💰
```

### The Flow:
1. ✅ All $40 goes to your Ultra wallet
2. ✅ Backend tracks $20 owed to influencer
3. ✅ You send $20 to influencer manually
4. ✅ Mark as paid in system

---

## 🎨 Next Steps

### **1. Integrate with Jupiter Trades**

In your trade success handler, add:

```javascript
import ReferralTracker from './utils/ReferralTracker';

// After successful trade
await ReferralTracker.trackTrade({
  userWallet: connectedWallet,
  tradeVolume: volumeInUSD,
  feeEarned: feeInUSD,
  tokenIn: inputToken,
  tokenOut: outputToken,
  transactionSignature: txSignature
});
```

### **2. Create Real Affiliates**

Replace test wallets with real Solana addresses:

```bash
curl -X POST http://localhost:3001/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "cryptokid123",
    "name": "CryptoKid",
    "walletAddress": "REAL_SOLANA_WALLET_ADDRESS",
    "sharePercentage": 50,
    "email": "cryptokid@example.com"
  }'
```

### **3. Share Links**

```
Production: https://moonfeed.app?ref=cryptokid123
Development: http://localhost:5173?ref=cryptokid123
```

### **4. Monitor Earnings**

```bash
# Check pending earnings
curl http://localhost:3001/api/affiliates/cryptokid123/pending-earnings

# View full stats
curl http://localhost:3001/api/affiliates/cryptokid123/stats
```

### **5. Process Payouts**

1. Send SOL/USDC from your Ultra wallet
2. Copy transaction signature
3. Record payout:

```bash
curl -X POST http://localhost:3001/api/affiliates/payouts/create \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "cryptokid123",
    "amount": 245.50,
    "tradeIds": ["trade_123", "trade_124"],
    "transactionSignature": "YOUR_TX_SIGNATURE"
  }'
```

---

## 📖 Documentation

- **Quick Start:** `HOW_TO_CREATE_AFFILIATE_LINK.md` ⭐
- **Full Guide:** `AFFILIATE_SYSTEM_README.md`
- **Summary:** `AFFILIATE_SYSTEM_COMPLETE.md`

---

## 🧪 Test Commands Quick Reference

```bash
# List all affiliates
curl http://localhost:3001/api/affiliates/list

# Get specific affiliate
curl http://localhost:3001/api/affiliates/moonfeedtest

# Get stats
curl http://localhost:3001/api/affiliates/moonfeedtest/stats

# Simulate trade
curl -X POST http://localhost:3001/api/affiliates/track-trade \
  -H "Content-Type: application/json" \
  -d '{"referralCode":"moonfeedtest","userWallet":"User123","tradeVolume":1000,"feeEarned":10,"tokenIn":"SOL","tokenOut":"BONK"}'

# Check pending earnings
curl http://localhost:3001/api/affiliates/moonfeedtest/pending-earnings
```

---

## ✅ Your Affiliate System is READY!

🎉 You can now:
- Create unlimited affiliates
- Track trades automatically
- Split fees with influencers
- Scale your app with referral marketing

**Start by opening the test page:**
```bash
open affiliate-test-page.html
```

Happy scaling! 🚀
