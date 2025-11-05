# 🎯 Quick Guide: Creating Affiliate Links & Tracking Payments

## 📝 Step 1: Create an Affiliate Link for an Influencer

### Using API (Terminal)

```bash
curl -X POST http://localhost:3001/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "cryptoking",
    "name": "Crypto King",
    "walletAddress": "THEIR_SOLANA_WALLET_ADDRESS",
    "sharePercentage": 50,
    "email": "cryptoking@email.com",
    "telegram": "@cryptoking"
  }'
```

**Response:**
```json
{
  "success": true,
  "affiliate": {
    "code": "cryptoking",
    "name": "Crypto King",
    "walletAddress": "THEIR_WALLET...",
    "sharePercentage": 50,
    "totalEarned": 0
  }
}
```

✅ **Done! Give them this link:**
```
https://moonfeed.app?ref=cryptoking
```

---

## 💰 Step 2: How to See How Much to Pay Them

### Option A: Check Pending Earnings (Quickest Way)

```bash
curl http://localhost:3001/api/affiliates/cryptoking/pending-earnings
```

**Response:**
```json
{
  "success": true,
  "referralCode": "cryptoking",
  "pendingEarnings": 45.67,        // ← Amount you owe them
  "pendingTrades": 25,
  "tradeIds": ["trade_123", "trade_124", ...]
}
```

**This tells you:**
- ✅ **Total amount to send:** `$45.67`
- ✅ **Number of unpaid trades:** `25`
- ✅ **Which trades to mark as paid**

---

### Option B: View Full Stats

```bash
curl http://localhost:3001/api/affiliates/cryptoking/stats
```

**Response:**
```json
{
  "success": true,
  "affiliate": {
    "code": "cryptoking",
    "name": "Crypto King",
    "totalEarned": 145.67,         // Lifetime earnings
    "totalVolume": 50000,          // Total trade volume
    "totalTrades": 75              // Total trades
  },
  "stats": {
    "totalEarnings": 145.67,       // All-time
    "pendingEarnings": 45.67,      // ← What you owe now
    "paidEarnings": 100.00,        // Already paid
    "totalTrades": 75,
    "pendingTrades": 25,
    "paidTrades": 50
  }
}
```

---

### Option C: View Individual Trades (See Exact Splits)

```bash
curl "http://localhost:3001/api/affiliates/cryptoking/trades?payoutStatus=pending"
```

**Response:**
```json
{
  "success": true,
  "trades": [
    {
      "tradeId": "trade_1234567890_abc123",
      "userWallet": "User123...",
      "tradeVolume": 1000,
      "timestamp": "2024-01-15T10:30:00Z",
      
      "feeEarned": 10.00,          // Total fee from Jupiter
      "jupiterCut": 2.00,          // Jupiter's 20%
      "netFee": 8.00,              // After Jupiter's cut
      
      "influencerShare": 4.00,     // ← Their earnings (50% of netFee)
      "platformShare": 4.00,       // ← Your earnings (50% of netFee)
      
      "payoutStatus": "pending"
    },
    {
      "tradeId": "trade_1234567891_xyz456",
      "feeEarned": 5.00,
      "influencerShare": 2.00,     // ← Another $2.00
      "payoutStatus": "pending"
    }
    // ... more trades
  ],
  "count": 25
}
```

---

## 💸 Step 3: Pay the Influencer & Mark as Paid

### 3a. Send SOL/USDC from Ultra Wallet

1. **Get their wallet address:**
   ```bash
   curl http://localhost:3001/api/affiliates/cryptoking
   ```
   Response shows: `"walletAddress": "ABC123...XYZ789"`

2. **Send them the pending amount** (e.g., $45.67 in USDC or SOL)
   - From your **Ultra wallet** (where fees accumulate)
   - To their wallet address
   - Save the transaction signature!

### 3b. Record the Payout in System

```bash
curl -X POST http://localhost:3001/api/affiliates/payouts/create \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "cryptoking",
    "amount": 45.67,
    "tradeIds": ["trade_123", "trade_124", ...],
    "transactionSignature": "4x9Z...abc123",
    "notes": "Payment for Jan 2024"
  }'
```

**Response:**
```json
{
  "success": true,
  "payout": {
    "payoutId": "payout_1234567890",
    "referralCode": "cryptoking",
    "amount": 45.67,
    "tradeIds": [25],              // Number of trades paid
    "transactionSignature": "4x9Z...abc123",
    "timestamp": "2024-01-20T15:00:00Z"
  }
}
```

✅ **Done!** Those 25 trades are now marked as "paid" and won't show up in pending earnings anymore.

---

## 🔄 Quick Reference Commands

### Create Affiliate
```bash
curl -X POST http://localhost:3001/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{"code":"influencer123","name":"Influencer Name","walletAddress":"WALLET","sharePercentage":50}'
```

### Check What You Owe
```bash
curl http://localhost:3001/api/affiliates/influencer123/pending-earnings
```

### Get Their Wallet Address
```bash
curl http://localhost:3001/api/affiliates/influencer123
```

### Mark as Paid
```bash
curl -X POST http://localhost:3001/api/affiliates/payouts/create \
  -H "Content-Type: application/json" \
  -d '{"referralCode":"influencer123","amount":XX.XX,"tradeIds":["..."],"transactionSignature":"..."}'
```

### List All Affiliates
```bash
curl http://localhost:3001/api/affiliates/list
```

---

## 📊 Understanding the Fee Split

When someone trades via `?ref=cryptoking`:

```
$10 Total Fee (1% of $1000 trade)
├── $2.00 → Jupiter (20% - automatic)
└── $8.00 → Net Fee (80%)
    ├── $4.00 → Influencer "cryptoking" (50% share)
    └── $4.00 → Your Ultra Wallet (50%)
```

**Where the money goes:**
1. **Jupiter (20%)** - Automatically kept by Jupiter, never hits your wallet
2. **Influencer Share** - Accumulates as "pending earnings", you pay manually
3. **Platform Share** - Goes to your Ultra wallet immediately

**Your responsibilities:**
- Monitor pending earnings for each affiliate
- Send payments from Ultra wallet to their wallet
- Record the payout in the system

---

## 🎯 Pro Tips

### Weekly Payout Schedule
```bash
# Every Monday, check all affiliates
curl http://localhost:3001/api/affiliates/list | jq '.affiliates[] | {code: .code, pending: .stats.pendingEarnings}'

# For each one with pending earnings > $0
curl http://localhost:3001/api/affiliates/THEIR_CODE/pending-earnings
# → Send payment
# → Record payout
```

### Automated Script (Future Enhancement)
```javascript
// backend/scripts/process-payouts.js
// Could auto-generate payout list and transaction batches
// You'd just need to sign & send from Ultra wallet
```

### Dashboard Access
- Your affiliate system has a full admin dashboard
- Located at: `/admin/affiliates` (frontend route)
- Shows all affiliates, trades, and pending payments in a nice UI

---

## 🚨 Important Notes

1. **Storage Location:** All affiliate data is in `/backend/storage/affiliates/`
2. **Backup Regularly:** These JSON files contain all payment records
3. **Test First:** Use small amounts to test the flow before big payouts
4. **Keep Records:** Transaction signatures are crucial for disputes
5. **30-Day Cookie:** Referrals last 30 days in user's browser

---

## Need Help?

- **View all API endpoints:** `/backend/routes/affiliates.js`
- **Storage logic:** `/backend/models/affiliate-storage.js`
- **Frontend tracking:** `/frontend/src/App.jsx` (referral code detection)
- **Dashboard:** Search for `AffiliateAdminDashboard` in frontend

---

## Example Real Workflow

1. **Monday Morning:**
   ```bash
   curl http://localhost:3001/api/affiliates/cryptoking/pending-earnings
   # Shows: $234.56 pending
   ```

2. **Check Your Ultra Wallet:**
   - Verify you have enough USDC/SOL
   - (Fees accumulate there from all trades)

3. **Send Payment:**
   - Open Phantom/Solflare wallet
   - Send $234.56 USDC to cryptoking's wallet
   - Copy transaction signature: `4x9Z...abc123`

4. **Record It:**
   ```bash
   curl -X POST http://localhost:3001/api/affiliates/payouts/create \
     -H "Content-Type: application/json" \
     -d '{"referralCode":"cryptoking","amount":234.56,"tradeIds":["..."],"transactionSignature":"4x9Z...abc123"}'
   ```

5. **Verify:**
   ```bash
   curl http://localhost:3001/api/affiliates/cryptoking/pending-earnings
   # Shows: $0.00 pending ✅
   ```

Done! 🎉
