# 🚀 Quick Start: Create Your First Affiliate Link

## 📝 Step-by-Step Guide

### **Step 1: Create an Affiliate**

Open a new terminal and run:

```bash
curl -X POST http://localhost:3001/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "cryptokid123",
    "name": "CryptoKid",
    "walletAddress": "YOUR_SOLANA_WALLET_ADDRESS_HERE",
    "sharePercentage": 50,
    "email": "cryptokid@example.com",
    "telegram": "@cryptokid"
  }'
```

**Response:**
```json
{
  "success": true,
  "affiliate": {
    "code": "cryptokid123",
    "name": "CryptoKid",
    "walletAddress": "YOUR_WALLET...",
    "sharePercentage": 50,
    "totalEarned": 0,
    "totalVolume": 0,
    "totalTrades": 0,
    "status": "active"
  }
}
```

✅ **Affiliate Created!**

---

### **Step 2: Get Your Referral Link**

Your referral link is automatically generated:

```
http://localhost:5173?ref=cryptokid123
```

Or for production:
```
https://moonfeed.app?ref=cryptokid123
```

📋 **Copy and share this with your influencer!**

---

### **Step 3: Test the Referral Link**

1. **Open your browser** (or incognito window)
2. **Visit:** `http://localhost:5173?ref=cryptokid123`
3. **Open DevTools** (F12 or Cmd+Option+I)
4. **Go to Console tab**
5. **Type:** `localStorage.getItem('moonfeed_referral_code')`
6. **Should show:** `"cryptokid123"` ✅

**What happened:**
- The `?ref=cryptokid123` parameter was detected
- Code was saved in browser (lasts 30 days)
- URL was cleaned (no more `?ref=` visible)
- User is now tracked to this affiliate

---

### **Step 4: View Affiliate Stats**

```bash
curl http://localhost:3001/api/affiliates/cryptokid123/stats
```

**Response:**
```json
{
  "success": true,
  "affiliate": {
    "code": "cryptokid123",
    "name": "CryptoKid",
    "totalEarned": 0,
    "totalVolume": 0,
    "totalTrades": 0
  },
  "stats": {
    "totalTrades": 0,
    "totalVolume": 0,
    "totalEarnings": 0,
    "pendingEarnings": 0,
    "paidEarnings": 0
  }
}
```

---

### **Step 5: Simulate a Test Trade**

Pretend a user with the referral code just made a trade:

```bash
curl -X POST http://localhost:3001/api/affiliates/track-trade \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "cryptokid123",
    "userWallet": "UserWallet123xyz",
    "tradeVolume": 5000,
    "feeEarned": 50,
    "tokenIn": "SOL",
    "tokenOut": "BONK",
    "transactionSignature": "TestTx123456789"
  }'
```

**What this simulates:**
- User traded $5,000 worth of SOL → BONK
- Your app charged 1% fee = $50
- Jupiter takes 20% = $10
- Net fee to your wallet = $40
- Influencer gets 50% = $20
- You keep 50% = $20

**Response:**
```json
{
  "success": true,
  "trade": {
    "tradeId": "trade_1698765432_abc123",
    "referralCode": "cryptokid123",
    "userWallet": "UserWallet123xyz",
    "tradeVolume": 5000,
    "feeEarned": 50,
    "jupiterCut": 10,
    "netFee": 40,
    "influencerShare": 20,
    "platformShare": 20,
    "payoutStatus": "pending"
  }
}
```

✅ **Trade tracked!** CryptoKid just earned $20!

---

### **Step 6: Check Updated Stats**

```bash
curl http://localhost:3001/api/affiliates/cryptokid123/stats
```

**Response:**
```json
{
  "success": true,
  "affiliate": {
    "totalEarned": 20,
    "totalVolume": 5000,
    "totalTrades": 1
  },
  "stats": {
    "pendingEarnings": 20,
    "paidEarnings": 0,
    "pendingTradeCount": 1
  }
}
```

---

### **Step 7: View All Affiliates**

```bash
curl http://localhost:3001/api/affiliates/list
```

**Response:**
```json
{
  "success": true,
  "affiliates": [
    {
      "code": "cryptokid123",
      "name": "CryptoKid",
      "totalEarned": 20,
      "totalVolume": 5000,
      "totalTrades": 1,
      "status": "active"
    }
  ],
  "count": 1
}
```

---

## 🎨 Using the Admin Dashboard (Frontend)

### **Step 1: Add Dashboard to Your App**

In your `App.jsx` or create a new route:

```jsx
import AffiliateAdminDashboard from './components/AffiliateAdminDashboard';

// Add to your routing or conditional render
{showAdminDashboard && <AffiliateAdminDashboard />}
```

### **Step 2: Access Dashboard**

- View all affiliates
- Create new affiliates via form
- See pending earnings
- Copy referral links
- View trade history

---

## 💰 Processing a Payout

When you're ready to pay an influencer:

### **Step 1: Check Pending Earnings**

```bash
curl http://localhost:3001/api/affiliates/cryptokid123/pending-earnings
```

### **Step 2: Send Payment from Your Wallet**

- Open Phantom/Solflare
- Send $20 USDC/SOL to influencer's wallet
- Copy the transaction signature

### **Step 3: Record the Payout**

```bash
curl -X POST http://localhost:3001/api/affiliates/payouts/create \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "cryptokid123",
    "amount": 20,
    "tradeIds": ["trade_1698765432_abc123"],
    "transactionSignature": "5eDqY7K8z...",
    "notes": "Weekly payout - Oct 27"
  }'
```

✅ **Payout recorded!** Trades are now marked as "paid"

---

## 🧪 Browser Testing (Frontend)

### **Test 1: Set Referral Code Manually**

Open browser console on your app:

```javascript
// Set a test referral code
ReferralTracker.setReferralCode('cryptokid123')

// Check if it saved
localStorage.getItem('moonfeed_referral_code')
// Should show: "cryptokid123"
```

### **Test 2: Validate Referral Code**

```javascript
// Import ReferralTracker (already done in App.jsx)
await ReferralTracker.validateReferralCode('cryptokid123')
// Should return: { valid: true, affiliate: {...} }
```

### **Test 3: Get Current Referral Info**

```javascript
await ReferralTracker.getCurrentReferralInfo()
// Returns info about active referral code
```

### **Test 4: Simulate Trade Tracking**

```javascript
await ReferralTracker.trackTrade({
  userWallet: 'YourWallet123',
  tradeVolume: 1000,
  feeEarned: 10,
  tokenIn: 'SOL',
  tokenOut: 'BONK',
  transactionSignature: 'BrowserTestTx'
})
// Should track the trade if referral code exists
```

---

## 📊 Real-World Usage

### **For Influencers:**

1. You give them: `https://moonfeed.app?ref=cryptokid123`
2. They share it on Twitter/YouTube/Telegram
3. Users click and start trading
4. Trades are automatically tracked
5. You pay them weekly/monthly

### **For You:**

1. All fees go to your Ultra wallet first ✅
2. Backend tracks earnings per affiliate
3. You see pending earnings in dashboard
4. Send payments when ready
5. Mark as paid in system

---

## 🔍 Quick Commands Reference

```bash
# Create affiliate
curl -X POST http://localhost:3001/api/affiliates/create -H "Content-Type: application/json" -d '{"code":"test","name":"Test","walletAddress":"Wallet123","sharePercentage":50}'

# List all affiliates
curl http://localhost:3001/api/affiliates/list

# Get specific affiliate
curl http://localhost:3001/api/affiliates/cryptokid123

# Get affiliate stats
curl http://localhost:3001/api/affiliates/cryptokid123/stats

# Track a trade
curl -X POST http://localhost:3001/api/affiliates/track-trade -H "Content-Type: application/json" -d '{"referralCode":"cryptokid123","userWallet":"User123","tradeVolume":1000,"feeEarned":10,"tokenIn":"SOL","tokenOut":"BONK"}'

# Check pending earnings
curl http://localhost:3001/api/affiliates/cryptokid123/pending-earnings

# Validate referral code
curl http://localhost:3001/api/affiliates/validate/cryptokid123
```

---

## 🎉 You're Done!

Your affiliate system is ready to use. Share referral links and start tracking revenue splits!

**Need help?** Check `AFFILIATE_SYSTEM_README.md` for full documentation.
