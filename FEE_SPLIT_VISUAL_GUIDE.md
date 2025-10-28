# 💎 Complete Fee Split Guide - Visual Reference

## 🎯 Quick Answer: Where to See Fee Splits

### For Individual Trades:
```
✅ API Endpoint: GET /api/affiliates/:code/trades
✅ Dashboard: Affiliate Admin Dashboard → "All Trades" tab
✅ Each trade shows: Total Fee, Influencer Share, Platform Share
```

### For Platform (Ultra Wallet) Total:
```
✅ NEW API Endpoint: GET /api/affiliates/platform/earnings
✅ NEW Dashboard Section: Platform earnings card at top of dashboard
```

---

## 📊 Example Trade Breakdown

### Scenario: User trades via "cryptoking" referral link

**Trade Details:**
- Volume: $5,000
- Jupiter fee: $10.00 (0.2% of volume)
- Affiliate share: 60%
- Platform share: 40%

### The Split:
```
$10.00 Total Fee Collected by Jupiter
│
├─ $2.00 (20%) → Jupiter keeps this automatically
│
└─ $8.00 (80%) → Distributable via our system
   │
   ├─ $4.80 (60% of $8) → Affiliate "cryptoking"
   │
   └─ $3.20 (40% of $8) → Platform (Ultra wallet)
```

---

## 🔍 Where Splits Appear

### 1. Individual Trade Record (API)

**Endpoint:** `GET /api/affiliates/cryptoking/trades`

```json
{
  "trades": [
    {
      "tradeId": "trade_123",
      "referralCode": "cryptoking",
      "userWallet": "User123",
      
      "tradeVolume": 5000,
      "feeEarned": 10.0,      // ← Total fee from Jupiter
      
      "jupiterCut": 2.0,       // ← Jupiter's 20%
      "netFee": 8.0,           // ← Distributable (80%)
      
      "influencerShare": 4.8,  // ← To affiliate
      "platformShare": 3.2,    // ← To Ultra wallet
      
      "payoutStatus": "pending"
    }
  ]
}
```

### 2. Dashboard - All Trades Table

| Date | Volume | Total Fee | Influencer Share | Platform Share | Status |
|------|--------|-----------|------------------|----------------|--------|
| Jan 15 | $5,000 | $10.0000 | **$4.8000** 💙 | **$3.2000** 💚 | pending |
| Jan 14 | $2,000 | $4.0000 | **$1.9200** 💙 | **$1.2800** 💚 | paid |

**Colors:**
- 💙 Blue = Influencer share
- 💚 Green = Platform share

### 3. Platform Earnings Summary (NEW!)

**Endpoint:** `GET /api/affiliates/platform/earnings`

```json
{
  "platformEarnings": {
    "total": 125.50,         // Total ever earned
    "pending": 45.20,        // Not yet paid out
    "paid": 80.30,           // Already paid
    "tradeCount": 342
  },
  "byAffiliate": {
    "cryptoking": {
      "total": 45.60,
      "pending": 12.30,
      "paid": 33.30,
      "tradeCount": 78
    }
  }
}
```

**Dashboard Display:**

```
┌─────────────────────────────────────────────────────┐
│ 💰 Ultra Wallet Earnings (Platform Share)          │
├─────────────────────────────────────────────────────┤
│  Total Earned    Pending      Paid Out   Trades    │
│  $125.50         $45.20       $80.30     342       │
└─────────────────────────────────────────────────────┘
```

---

## 🧪 Test the Splits

### Quick Test Script:

```bash
chmod +x test-fee-splits.sh
./test-fee-splits.sh
```

This will:
1. Create test affiliate "demokid" with 60% share
2. Record a $10 fee trade
3. Show the exact splits: $4.80 affiliate, $3.20 platform
4. Display platform total earnings

### Manual API Test:

```bash
# 1. Create affiliate (70% share)
curl -X POST http://localhost:5000/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "testuser",
    "name": "Test User",
    "walletAddress": "TestWallet123",
    "sharePercentage": 70
  }'

# 2. Record trade with $20 fee
curl -X POST http://localhost:5000/api/affiliates/track-trade \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "testuser",
    "userWallet": "Buyer123",
    "tradeVolume": 10000,
    "feeEarned": 20.0
  }'

# 3. Check the splits
curl http://localhost:5000/api/affiliates/testuser/trades | jq '.trades[0]'

# Expected result:
# {
#   "feeEarned": 20.0,
#   "jupiterCut": 4.0,        (20%)
#   "netFee": 16.0,           (80%)
#   "influencerShare": 11.2,  (70% of net)
#   "platformShare": 4.8      (30% of net)
# }
```

---

## 📈 Calculation Formula

For any trade:

```javascript
// Given:
const feeEarned = 100.0;           // Total fee from Jupiter
const affiliateSharePercent = 60;  // Affiliate's percentage

// Calculate:
const jupiterCut = feeEarned * 0.20;                          // = 20.0
const netFee = feeEarned - jupiterCut;                        // = 80.0
const influencerShare = netFee * (affiliateSharePercent / 100); // = 48.0
const platformShare = netFee - influencerShare;                // = 32.0

// Store in trade record:
trade = {
  feeEarned: 100.0,
  jupiterCut: 20.0,
  netFee: 80.0,
  influencerShare: 48.0,   // ← Affiliate gets this
  platformShare: 32.0       // ← Ultra wallet gets this
}
```

**Code location:** `backend/models/affiliate-storage.js` line ~250

---

## 🎨 Visual Dashboard Guide

### Opening the Dashboard:

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Open: `http://localhost:5173`
4. Navigate to Affiliate Dashboard

### What You'll See:

```
┌────────────────────────────────────────────────────────┐
│ 🎯 Affiliate Dashboard                   [Affiliates]  │
│                                          [All Trades]   │
│                                          [Payouts]      │
├────────────────────────────────────────────────────────┤
│ 💰 Ultra Wallet Earnings (Platform Share)             │
│  ┌──────────┬──────────┬──────────┬──────────┐       │
│  │ Total    │ Pending  │ Paid Out │ Trades   │       │
│  │ $125.50  │ $45.20   │ $80.30   │ 342      │       │
│  └──────────┴──────────┴──────────┴──────────┘       │
├────────────────────────────────────────────────────────┤
│ All Trades (342)                                       │
│                                                        │
│ Date    Volume  Fee    Influencer  Platform  Status   │
│ Jan 15  $5,000  $10.00  $4.80      $3.20     pending │
│ Jan 14  $2,000  $4.00   $1.92      $1.28     paid    │
└────────────────────────────────────────────────────────┘
```

---

## 📝 Summary Checklist

- ✅ **Every trade record** includes both influencer and platform shares
- ✅ **API endpoint** shows all splits: `/api/affiliates/:code/trades`
- ✅ **New platform endpoint** shows Ultra wallet total: `/api/affiliates/platform/earnings`
- ✅ **Dashboard table** displays both shares in separate columns
- ✅ **Platform summary card** at top of dashboard shows totals
- ✅ **Test script** demonstrates the splits: `./test-fee-splits.sh`
- ✅ **Formula documented** in code and this guide

---

## 🚀 Next Steps

1. **Run the test:** `./test-fee-splits.sh`
2. **Open dashboard:** Visit the UI and see the splits
3. **Check platform earnings:** Call the new `/platform/earnings` endpoint
4. **Start tracking real trades:** Integrate with Jupiter swaps

**Questions?** Check `FEE_SPLIT_EXPLAINED.md` for more details!
