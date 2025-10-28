# 💰 Fee Split Breakdown - Where to See Everything

## How the Fee Split Works

When a user makes a trade through a referral link, here's the exact fee breakdown:

```
Total Fee Earned (from Jupiter swap)
├── 20% → Jupiter (automatic)
└── 80% → Net Fee (distributed by our system)
    ├── X% → Affiliate Share (configurable per affiliate)
    └── Y% → Platform Share (Ultra wallet)
```

### Example: $1.00 Fee on a Trade via "cryptoking" (50% share)

```
$1.00 Total Fee
├── $0.20 → Jupiter (20%)
└── $0.80 → Net Fee (80%)
    ├── $0.40 → Affiliate "cryptoking" (50% of net)
    └── $0.40 → Platform (Ultra wallet) (remaining 50%)
```

---

## 📍 Where to See the Fee Splits

### 1. **Individual Trade Data** (API & Dashboard)

Every trade record contains **all split amounts**:

```json
{
  "tradeId": "trade_1234567890_abc123",
  "referralCode": "cryptoking",
  "tradeVolume": 1000,
  
  "feeEarned": 1.0,           // ← Total fee from Jupiter
  "jupiterCut": 0.20,         // ← Jupiter's 20%
  "netFee": 0.80,             // ← Distributable amount (80%)
  
  "influencerShare": 0.40,    // ← Amount for affiliate
  "platformShare": 0.40,      // ← Amount for Ultra wallet
  
  "payoutStatus": "pending",   // pending | paid | processing
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Where to see this:**
- **API:** `GET /api/affiliates/:code/trades` - Shows all trades for an affiliate
- **API:** `GET /api/affiliates/trades/all` - Shows all trades across all affiliates
- **Dashboard:** "All Trades" tab - Shows table with split columns
- **Dashboard:** Individual affiliate details page - Shows their specific trades

---

### 2. **Affiliate Dashboard UI - Trades Table**

The dashboard displays a table with these columns:

| Date | Volume | Fee Earned | **Influencer Share** | Status |
|------|--------|-----------|---------------------|--------|
| Jan 15 | $1,000 | $1.0000 | **$0.4000** | pending |
| Jan 14 | $500 | $0.5000 | **$0.2000** | paid |

**Location:** `AffiliateAdminDashboard.jsx` - Lines 350-369

```jsx
<td>${trade.feeEarned.toFixed(4)}</td>        // Total fee
<td>${trade.influencerShare.toFixed(4)}</td>  // Affiliate's cut
```

**Note:** Platform share isn't shown in this table (but it's in the data!)

---

### 3. **API Endpoints for Fee Split Data**

#### Get Individual Affiliate Trades
```bash
GET http://localhost:5000/api/affiliates/cryptoking/trades
```

Response shows all splits for each trade:
```json
{
  "success": true,
  "trades": [
    {
      "feeEarned": 1.0,
      "influencerShare": 0.40,
      "platformShare": 0.40,
      "jupiterCut": 0.20
    }
  ]
}
```

#### Get All Trades (Admin View)
```bash
GET http://localhost:5000/api/affiliates/trades/all
```

Shows every trade with complete split details.

#### Get Affiliate Stats (Summary)
```bash
GET http://localhost:5000/api/affiliates/cryptoking/stats
```

Response:
```json
{
  "affiliate": {
    "totalEarned": 2.50,      // Sum of all influencerShare amounts
    "sharePercentage": 50
  },
  "stats": {
    "totalEarnings": 2.50,    // Total for affiliate
    "pendingEarnings": 1.20,  // Unpaid to affiliate
    "paidEarnings": 1.30      // Already paid to affiliate
  }
}
```

---

### 4. **Platform's Total Share (Ultra Wallet)**

To calculate how much the platform (Ultra wallet) has earned:

```javascript
// Sum all platformShare values from all trades
const platformTotal = trades.reduce((sum, trade) => sum + trade.platformShare, 0);
```

**Currently, there's NO dedicated endpoint for this!** 

I'll add one below! ⬇️

---

## 🆕 New Features to Add

### 1. Platform Earnings Endpoint

Let's add an endpoint to see the platform's total earnings:

```javascript
// GET /api/affiliates/platform/earnings
router.get('/platform/earnings', async (req, res) => {
  const trades = await affiliateStorage.getAllTrades();
  
  const total = trades.reduce((sum, t) => sum + t.platformShare, 0);
  const pending = trades
    .filter(t => t.payoutStatus === 'pending')
    .reduce((sum, t) => sum + t.platformShare, 0);
  
  res.json({
    success: true,
    platformEarnings: {
      total,
      pending,
      byAffiliate: {} // breakdown per affiliate
    }
  });
});
```

### 2. Enhanced Dashboard View

Add a "Platform Earnings" section showing:
- Total platform share across all trades
- Pending platform earnings (from unpaid trades)
- Platform share per affiliate

---

## 📊 Quick Test: See the Splits in Action

### Test Script:
```bash
# 1. Create an affiliate with 60% share
curl -X POST http://localhost:5000/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "testinfluencer",
    "name": "Test Influencer",
    "walletAddress": "ABC123...",
    "sharePercentage": 60
  }'

# 2. Record a trade with $10 fee
curl -X POST http://localhost:5000/api/affiliates/track-trade \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "testinfluencer",
    "userWallet": "USER123",
    "tradeVolume": 5000,
    "feeEarned": 10.0
  }'

# 3. Check the split
curl http://localhost:5000/api/affiliates/testinfluencer/trades | jq '.'
```

### Expected Result:
```json
{
  "feeEarned": 10.0,
  "jupiterCut": 2.0,        // 20% to Jupiter
  "netFee": 8.0,            // 80% distributable
  "influencerShare": 4.8,   // 60% of net = $4.80
  "platformShare": 3.2      // 40% of net = $3.20
}
```

---

## 🎯 Summary: Where to Find Each Split

| What You Want | Where to Look |
|---------------|---------------|
| **Individual trade splits** | API: `/api/affiliates/:code/trades` → Each trade has `influencerShare` and `platformShare` |
| **Affiliate's total earnings** | API: `/api/affiliates/:code/stats` → `totalEarnings` field |
| **Affiliate's pending/paid** | API: `/api/affiliates/:code/stats` → `pendingEarnings` and `paidEarnings` |
| **Platform's total share** | Calculate: Sum all `trade.platformShare` from all trades (or use new endpoint below) |
| **Visual dashboard** | UI: `AffiliateAdminDashboard` → "All Trades" tab shows influencer share in table |

---

## ⚡ Next Steps

1. **Add platform earnings endpoint** (see above)
2. **Update dashboard** to show platform share column in trades table
3. **Add platform earnings summary card** to dashboard header
4. **Export CSV** of all trades with splits for accounting

Want me to implement any of these? 🚀
