# ✅ Affiliate System - Already Working!

## 🎉 Current Status: FULLY OPERATIONAL

Your affiliate system is **already set up and working** in your backend!

---

## 📊 What's Already Working

### Existing Affiliates (2)

#### 1. **testaffiliate123**
- Name: Test Influencer
- Wallet: `TestWallet123456789abcdefghijklmnop`
- Total Earned: **$4.00** (all paid ✅)
- Share: 50%
- Link: `http://localhost:5173?ref=testaffiliate123`

#### 2. **moonfeedtest**
- Name: Moonfeed Test Affiliate
- Wallet: `TestWallet123456789abcdefghijklmnopqrstuvwxyz`
- Total Earned: **$1.00** 
- **Pending Payment: $1.00** ⚠️
- Share: 50%
- Link: `http://localhost:5173?ref=moonfeedtest`

---

## 🔗 Working API Endpoints

### ✅ List All Affiliates
```bash
# Open this in browser OR use curl:
curl http://localhost:3001/api/affiliates/list
```

**Browser-friendly URL:** 
👉 http://localhost:3001/api/affiliates/list

---

### ✅ Get Affiliate Details
```bash
curl http://localhost:3001/api/affiliates/moonfeedtest
```

**Browser-friendly URL:** 
👉 http://localhost:3001/api/affiliates/moonfeedtest

---

### ✅ Check Pending Earnings
```bash
curl http://localhost:3001/api/affiliates/moonfeedtest/pending-earnings
```

**Browser-friendly URL:** 
👉 http://localhost:3001/api/affiliates/moonfeedtest/pending-earnings

**Current Response:**
```json
{
  "success": true,
  "referralCode": "moonfeedtest",
  "totalPending": 1,        // ← $1 to pay
  "tradeCount": 1,
  "trades": [...]
}
```

---

### ✅ View Stats
```bash
curl http://localhost:3001/api/affiliates/moonfeedtest/stats
```

**Browser-friendly URL:** 
👉 http://localhost:3001/api/affiliates/moonfeedtest/stats

---

### ❌ Create New Affiliate (POST only - can't click in browser)
```bash
# Use this command instead:
curl -X POST http://localhost:3001/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "newinfluencer",
    "name": "New Influencer",
    "walletAddress": "THEIR_SOLANA_WALLET_ADDRESS",
    "sharePercentage": 50,
    "email": "influencer@email.com"
  }'
```

**Why clicking didn't work:** 
- Clicking a link = GET request
- Creating affiliates = POST request (needs data)
- You got the error: `{"success":false,"error":"Affiliate \"create\" not found"}`
  - Because it tried to GET `/api/affiliates/create` 
  - Which looked for an affiliate named "create"

---

## 🚀 How to Use the System

### Option 1: Use the Visual Dashboard (Easiest)
Open: **affiliate-payment-dashboard.html** in your browser

Or click here:
👉 file:///Users/victor/Desktop/Desktop/moonfeed alpha copy 3/affiliate-payment-dashboard.html

This dashboard lets you:
- ✅ View all affiliates (no curl needed!)
- ✅ Check pending payments
- ✅ Create new affiliates (with a form)
- ✅ View all trades
- ✅ Record payouts

---

### Option 2: Use Browser for GET Requests

**These URLs work in your browser:**

📋 **List all affiliates:**
http://localhost:3001/api/affiliates/list

📊 **Check specific affiliate:**
http://localhost:3001/api/affiliates/moonfeedtest

💰 **Check pending earnings:**
http://localhost:3001/api/affiliates/moonfeedtest/pending-earnings

📈 **View stats:**
http://localhost:3001/api/affiliates/moonfeedtest/stats

📝 **View trades:**
http://localhost:3001/api/affiliates/moonfeedtest/trades

---

### Option 3: Use Terminal Commands

```bash
# List all affiliates
curl http://localhost:3001/api/affiliates/list

# Check what you owe an influencer
curl http://localhost:3001/api/affiliates/CODE_HERE/pending-earnings

# Create new affiliate (POST request)
curl -X POST http://localhost:3001/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "cryptoking",
    "name": "Crypto King",
    "walletAddress": "THEIR_WALLET",
    "sharePercentage": 50
  }'
```

---

## 💡 Quick Test: Create Your First Real Affiliate

### Step 1: Create an influencer
```bash
curl -X POST http://localhost:3001/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "influencer1",
    "name": "My First Influencer",
    "walletAddress": "PUT_REAL_SOLANA_WALLET_HERE",
    "sharePercentage": 50,
    "email": "influencer@example.com"
  }'
```

### Step 2: Get their referral link
Give them this URL:
```
http://localhost:5173?ref=influencer1
```

Or for production:
```
https://moonfeed.app?ref=influencer1
```

### Step 3: Test the link
1. Open: `http://localhost:5173?ref=influencer1`
2. Open browser console (F12)
3. Type: `localStorage.getItem('moonfeed_referral_code')`
4. Should show: `"influencer1"` ✅

### Step 4: Check their stats anytime
Browser: http://localhost:3001/api/affiliates/influencer1/pending-earnings

---

## 📁 Where Everything is Stored

All affiliate data is in JSON files:

```
backend/storage/affiliates/
├── affiliates.json    ← All influencers
├── trades.json        ← All trades with fee splits
└── payouts.json       ← Payment records
```

**Backup these files regularly!** They contain all payment records.

---

## 🎯 Current Action Items

### 1. Pay Pending Earnings ⚠️

**moonfeedtest** has **$1.00 pending**

1. Get their wallet:
   ```bash
   curl http://localhost:3001/api/affiliates/moonfeedtest
   ```
   Shows: `TestWallet123456789abcdefghijklmnopqrstuvwxyz`

2. Send $1 USDC/SOL from your Ultra wallet

3. Record the payout:
   ```bash
   curl -X POST http://localhost:3001/api/affiliates/payouts/create \
     -H "Content-Type: application/json" \
     -d '{
       "referralCode": "moonfeedtest",
       "amount": 1,
       "tradeIds": ["trade_1761627086043_3dmtbs8mn"],
       "transactionSignature": "YOUR_TX_SIGNATURE"
     }'
   ```

### 2. Create Real Influencer Accounts

Replace the test accounts with real influencer data:
- Real Solana wallet addresses
- Real contact info
- Custom share percentages

### 3. Integrate with Frontend

Make sure your frontend is tracking referrals. Check:
```javascript
// In frontend/src/App.jsx
// Should have code like:
const urlParams = new URLSearchParams(window.location.search);
const ref = urlParams.get('ref');
if (ref) {
  localStorage.setItem('moonfeed_referral_code', ref);
}
```

---

## 🔍 Troubleshooting

### "Cannot GET /api/affiliates/create"
- ❌ Wrong: Clicking link in browser (GET request)
- ✅ Right: Use curl with POST, or use the dashboard form

### "Affiliate not found"
- Make sure the affiliate code is correct (case-sensitive)
- List all affiliates to see available codes:
  http://localhost:3001/api/affiliates/list

### "Backend not responding"
- Make sure backend is running: `npm run dev` in `/backend`
- Check it's on port 3001

---

## 📚 Additional Resources

- **INFLUENCER_AFFILIATE_QUICK_GUIDE.md** - Detailed CLI guide
- **affiliate-payment-dashboard.html** - Visual interface
- **backend/routes/affiliates.js** - All API endpoints
- **backend/models/affiliate-storage.js** - Storage logic

---

## ✅ Summary

**Your affiliate system is READY TO USE!**

- ✅ Backend routes are working
- ✅ Storage is set up
- ✅ Test affiliates exist
- ✅ Trade tracking works
- ✅ Fee splits calculate correctly

**Next steps:**
1. Use the dashboard or curl to create real affiliates
2. Give influencers their referral links
3. Monitor pending earnings
4. Pay them regularly from your Ultra wallet
