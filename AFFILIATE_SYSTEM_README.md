# 🎯 Affiliate/Referral System for Moonfeed

## Overview
This affiliate system allows you to share fee revenue with influencers who drive users to your platform. Users who arrive via referral links are tracked, and their trading fees are split between you and the referring influencer.

---

## 🚀 How It Works

### 1. **Influencer Gets Referral Link**
```
https://moonfeed.app?ref=cryptokid123
```
- Each influencer has a unique code (e.g., `cryptokid123`)
- Their wallet address is stored in the system
- They get a custom share percentage (default 50%)

### 2. **User Clicks Link & Visits App**
- Referral code is saved in browser localStorage (expires after 30 days)
- Even if user leaves and returns later, they're still attributed to the influencer

### 3. **User Makes Trade via Jupiter**
- Your existing Jupiter integration charges 1% fee
- Jupiter takes 20% = $2 (on a $1000 trade with 1% fee = $10)
- **$8 goes to your Ultra wallet** ✅

### 4. **Backend Tracks the Trade**
- Referral code is sent with trade data
- System calculates:
  - Total fee earned: $10
  - Jupiter's cut (20%): $2
  - Net fee: $8
  - Influencer share (50%): $4
  - Platform share (50%): $4

### 5. **Payout Process**
- Admin views pending earnings in dashboard
- Sends payment from Ultra wallet to influencer wallet
- Marks trades as "paid" in system

---

## 📦 Installation

### Backend Setup
1. **Already integrated!** The affiliate routes are mounted in `server.js`
2. Storage directory will be created automatically at:
   ```
   /backend/storage/affiliates/
   ```

### Frontend Setup
1. **Already integrated!** Referral tracking initializes in `App.jsx`
2. No additional configuration needed

---

## 🛠️ Usage

### Creating an Affiliate

#### Option 1: Via Admin Dashboard (Recommended)
1. Access the dashboard at `/admin/affiliates` (you'll need to add a route)
2. Click "New Affiliate"
3. Fill in:
   - **Code**: `cryptokid123` (alphanumeric, no spaces)
   - **Name**: `CryptoKid`
   - **Wallet**: Solana wallet address
   - **Share %**: `50` (50% of net fees)
   - **Email/Telegram**: Optional contact info

#### Option 2: Via API
```bash
curl -X POST http://localhost:3001/api/affiliates/create \
  -H "Content-Type: application/json" \
  -d '{
    "code": "cryptokid123",
    "name": "CryptoKid",
    "walletAddress": "Abc123...xyz789",
    "sharePercentage": 50,
    "email": "crypto@example.com",
    "telegram": "@cryptokid"
  }'
```

### Generating Referral Links
```javascript
// In the admin dashboard or via script
const referralLink = `https://moonfeed.app?ref=${affiliate.code}`;
```

### Tracking Trades
**Automatically handled!** When a user with a referral code makes a trade, the system:
1. Detects referral code from localStorage
2. Sends trade data to backend
3. Calculates splits automatically
4. Updates affiliate stats

### Viewing Affiliate Stats
```bash
# Get specific affiliate stats
curl http://localhost:3001/api/affiliates/cryptokid123/stats

# Response:
{
  "success": true,
  "affiliate": {
    "code": "cryptokid123",
    "name": "CryptoKid",
    "totalEarned": 245.67,
    "totalVolume": 50000,
    "totalTrades": 123
  },
  "stats": {
    "pendingEarnings": 45.23,
    "paidEarnings": 200.44,
    "pendingTradeCount": 15,
    "paidTradeCount": 108
  }
}
```

### Processing Payouts
```bash
# Create a payout (after sending SOL/USDC from your wallet)
curl -X POST http://localhost:3001/api/affiliates/payouts/create \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "cryptokid123",
    "amount": 45.23,
    "tradeIds": ["trade_123", "trade_124", "trade_125"],
    "transactionSignature": "5eDqY...",
    "notes": "Weekly payout for Jan 1-7"
  }'
```

---

## 📊 API Reference

### Affiliate Management
- `POST /api/affiliates/create` - Create new affiliate
- `GET /api/affiliates/list` - Get all affiliates
- `GET /api/affiliates/:code` - Get specific affiliate
- `PUT /api/affiliates/:code` - Update affiliate
- `DELETE /api/affiliates/:code` - Delete affiliate
- `GET /api/affiliates/:code/stats` - Get affiliate statistics

### Trade Tracking
- `POST /api/affiliates/track-trade` - Record a trade (auto-called by frontend)
- `GET /api/affiliates/:code/trades` - Get trades for affiliate
- `GET /api/affiliates/:code/pending-earnings` - Get pending earnings
- `GET /api/affiliates/trades/all` - Get all trades (admin)

### Payouts
- `POST /api/affiliates/payouts/create` - Create a payout
- `GET /api/affiliates/:code/payouts` - Get payouts for affiliate
- `GET /api/affiliates/payouts/all` - Get all payouts (admin)

### Validation
- `GET /api/affiliates/validate/:code` - Check if referral code exists

---

## 💰 Fee Calculation Example

**Scenario**: User swaps $5,000 SOL → BONK with 1% fee

1. **Total Fee**: $5,000 × 1% = **$50**
2. **Jupiter's Cut** (20%): $50 × 0.20 = **$10**
3. **Net Fee to Ultra Wallet**: $50 - $10 = **$40**
4. **Influencer Share** (50%): $40 × 0.50 = **$20**
5. **Platform Share** (50%): $40 × 0.50 = **$20**

**Result**:
- ✅ Jupiter gets: $10
- ✅ Influencer gets: $20
- ✅ You get: $20

---

## 🔐 Security Notes

1. **No authentication** - Add admin auth before deploying to production
2. **Manual payouts** - You control when funds are sent (trustless would require smart contracts)
3. **Storage** - Data stored in JSON files (consider database for scale)

---

## 🎨 Admin Dashboard

Access the admin dashboard component:
```jsx
import AffiliateAdminDashboard from './components/AffiliateAdminDashboard';

// In your App.jsx or admin route
<AffiliateAdminDashboard />
```

**Features**:
- ✅ View all affiliates & stats
- ✅ Create new affiliates
- ✅ View pending earnings
- ✅ Copy referral links
- ✅ Track trades & payouts

---

## 📝 TODO / Future Enhancements

- [ ] Add admin authentication
- [ ] Automated Solana payouts via web3.js
- [ ] Email notifications for payouts
- [ ] Affiliate portal (influencers can view their stats)
- [ ] CSV export for accounting
- [ ] Multi-tier referrals (refer other influencers)
- [ ] Smart contract escrow for trustless payouts

---

## 🐛 Troubleshooting

### Referral code not saving
- Check browser localStorage (Chrome DevTools → Application → Local Storage)
- Ensure `ReferralTracker.initialize()` is called in App.jsx

### Trades not tracking
- Check console for errors
- Verify referral code exists in system (`/api/affiliates/validate/:code`)
- Ensure `ReferralTracker.trackTrade()` is called after successful trade

### Storage directory errors
- Backend creates `/backend/storage/affiliates/` automatically
- Ensure write permissions in backend directory

---

## 📞 Support

Questions? Check the implementation files:
- Backend: `/backend/models/affiliate-storage.js`
- Routes: `/backend/routes/affiliates.js`
- Frontend: `/frontend/src/utils/ReferralTracker.js`
- Dashboard: `/frontend/src/components/AffiliateAdminDashboard.jsx`

---

## 🚀 Quick Start

1. **Create an affiliate**:
   ```bash
   curl -X POST http://localhost:3001/api/affiliates/create -H "Content-Type: application/json" -d '{"code":"test123","name":"Test User","walletAddress":"YOUR_WALLET","sharePercentage":50}'
   ```

2. **Test the referral link**:
   ```
   http://localhost:5173?ref=test123
   ```

3. **Check if it saved**:
   - Open browser console
   - Type: `localStorage.getItem('moonfeed_referral_code')`
   - Should show: `"test123"`

4. **View stats**:
   ```bash
   curl http://localhost:3001/api/affiliates/test123/stats
   ```

Done! 🎉
