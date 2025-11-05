# ✅ Influencer 1 - Affiliate Setup Complete!

## 🎉 Affiliate Link Created Successfully!

### 📱 Give This Link to Influencer 1:

**Production (Main Link):**
```
https://moonfeed.app?ref=influencer1
```

**Local (for testing only):**
```
http://localhost:5173?ref=influencer1
```

---

## 💰 How to Check What You Owe Them

### Option 1: Use the Dashboard (Easiest)
I just opened: **influencer1-dashboard.html**

This shows:
- ✅ Amount owed (pending earnings)
- ✅ Total earned (lifetime)
- ✅ All their trades
- ✅ Live updates with refresh button

### Option 2: Click This URL in Your Browser
**Check pending earnings:**
👉 http://localhost:3001/api/affiliates/influencer1/pending-earnings

**Response shows:**
```json
{
  "success": true,
  "referralCode": "influencer1",
  "totalPending": 0,        // ← Amount you owe them
  "tradeCount": 0,
  "trades": []
}
```

### Option 3: Use Terminal Command
```bash
curl http://localhost:3001/api/affiliates/influencer1/pending-earnings
```

---

## 📊 Current Status

**Affiliate Code:** `influencer1`
**Name:** Influencer 1
**Share:** 50% of net fees
**Wallet:** `REPLACE_WITH_THEIR_REAL_SOLANA_WALLET` ⚠️

**Current Earnings:**
- Pending: $0.00
- Total: $0.00
- Trades: 0

---

## ⚠️ Important: Update Wallet Address

The wallet is currently set to a placeholder. Update it with their real Solana wallet:

```bash
curl -X PUT http://localhost:3001/api/affiliates/influencer1 \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "THEIR_REAL_SOLANA_WALLET_ADDRESS"
  }'
```

---

## 🔄 How It Works

1. **Influencer shares the link** with their followers
2. **Users click** `http://localhost:5173?ref=influencer1`
3. **Referral code saved** in user's browser (30 days)
4. **User trades** → Fees split automatically
5. **You check pending earnings** → See what you owe
6. **You send payment** from Ultra wallet to their wallet
7. **You mark as paid** in the system

---

## 📈 Tracking Example

After their first trade:

```bash
curl http://localhost:3001/api/affiliates/influencer1/pending-earnings
```

**Response:**
```json
{
  "totalPending": 4.50,    // ← Send them $4.50
  "tradeCount": 3,
  "trades": [
    {
      "influencerShare": 2.00,
      "tradeVolume": 1000,
      "payoutStatus": "pending"
    },
    // ... more trades
  ]
}
```

---

## 💸 When to Pay Them

### Recommended Schedule:
- **Weekly:** If they drive significant volume
- **Monthly:** For smaller affiliates
- **Threshold:** When pending earnings > $50

### Payment Process:
1. Check pending: http://localhost:3001/api/affiliates/influencer1/pending-earnings
2. Get their wallet: http://localhost:3001/api/affiliates/influencer1
3. Send USDC/SOL from your Ultra wallet
4. Record payout (see Payment Dashboard)

---

## 🔗 Quick Access Links

**Influencer 1 Dashboard:**
file:///Users/victor/Desktop/Desktop/moonfeed alpha copy 3/influencer1-dashboard.html

**Check Pending Earnings:**
http://localhost:3001/api/affiliates/influencer1/pending-earnings

**View All Stats:**
http://localhost:3001/api/affiliates/influencer1/stats

**View Trades:**
http://localhost:3001/api/affiliates/influencer1/trades

**Full Payment Dashboard:**
file:///Users/victor/Desktop/Desktop/moonfeed alpha copy 3/affiliate-payment-dashboard.html

---

## 🎯 Next Steps

1. ✅ **DONE:** Affiliate account created
2. ⚠️ **TODO:** Update their real Solana wallet address
3. 📱 **TODO:** Give them the referral link
4. 👀 **TODO:** Monitor their dashboard for earnings
5. 💰 **TODO:** Pay them when trades come in

---

## 💡 Pro Tips

### Test the Link Yourself
1. Open: `http://localhost:5173?ref=influencer1`
2. Open browser console (F12)
3. Type: `localStorage.getItem('moonfeed_referral_code')`
4. Should show: `"influencer1"` ✅

### Monitor Daily
Just open the dashboard and click "🔄 Refresh Stats" to see latest earnings.

### Automate Checks
Bookmark this URL for quick checks:
http://localhost:3001/api/affiliates/influencer1/pending-earnings

---

## 📞 Contact Info

**Email:** influencer1@example.com
**Wallet:** REPLACE_WITH_THEIR_REAL_SOLANA_WALLET (update this!)

---

🎉 **You're all set!** Give them the link and start tracking their earnings!
