# ✅ YOUR QUESTION ANSWERED

## Question: 
> "If I open http://localhost:5173?ref=moonfeedtest and do a test trade, where will the fee split show up? Where does it show the fee that the affiliate and the Ultra wallet should get?"

---

## Answer:

### 🎯 The Fee Splits Show Up in **3 PLACES**:

## 1. **Individual Trade Data (API)**

When you record a trade via the referral link, the split is **immediately calculated and stored** in the trade record.

**Endpoint:** `GET /api/affiliates/moonfeedtest/trades`

```json
{
  "trades": [
    {
      "tradeId": "trade_1761627086043_3dmtbs8mn",
      "referralCode": "moonfeedtest",
      
      "tradeVolume": 1000,
      "feeEarned": 2.5,        // ← Total fee
      
      "jupiterCut": 0.5,        // ← Jupiter takes 20%
      "netFee": 2,              // ← 80% to split
      
      "influencerShare": 1,     // ← 💙 Affiliate gets $1.00
      "platformShare": 1,       // ← 💚 Ultra wallet gets $1.00
      
      "payoutStatus": "pending"
    }
  ]
}
```

**Test it yourself:**
```bash
curl http://localhost:3001/api/affiliates/moonfeedtest/trades | python3 -m json.tool
```

---

## 2. **Platform Earnings Summary (API)**

To see **total** amounts owed to the Ultra wallet across all affiliates:

**Endpoint:** `GET /api/affiliates/platform/earnings`

```json
{
  "platformEarnings": {
    "total": 5,          // ← Total ever earned by Ultra wallet
    "pending": 1,        // ← Amount not yet paid out
    "paid": 4,           // ← Amount already sent
    "tradeCount": 2
  },
  "byAffiliate": {
    "moonfeedtest": {
      "total": 1,        // ← Ultra wallet earned $1 from this affiliate
      "pending": 1,      // ← $1 still pending
      "tradeCount": 1
    }
  }
}
```

**Test it yourself:**
```bash
curl http://localhost:3001/api/affiliates/platform/earnings | python3 -m json.tool
```

---

## 3. **Affiliate Admin Dashboard (UI)**

Open the dashboard at **http://localhost:5173** (after starting the frontend).

### What You'll See:

#### **A. Platform Earnings Card** (at the top)
```
┌────────────────────────────────────────────────┐
│ 💰 Ultra Wallet Earnings (Platform Share)     │
├────────────────────────────────────────────────┤
│  Total Earned    Pending      Paid Out         │
│  $5.00           $1.00        $4.00            │
└────────────────────────────────────────────────┘
```

#### **B. All Trades Table** (shows both splits)
```
Date       Volume   Total Fee   Influencer Share   Platform Share   Status
────────────────────────────────────────────────────────────────────────────
Oct 28     $1,000   $2.50       $1.00 💙           $1.00 💚        pending
```

**Column Colors:**
- 💙 **Blue** = Influencer share (affiliate gets this)
- 💚 **Green** = Platform share (Ultra wallet gets this)

---

## 🧪 Live Test Demonstration

I just ran a test trade with your `moonfeedtest` affiliate:

### Input:
- **Referral code:** moonfeedtest
- **Trade volume:** $1,000
- **Fee earned:** $2.50

### Output (the split):
```
Total fee:        $2.50
Jupiter cut:      $0.50  (20% to Jupiter)
Net fee:          $2.00  (80% distributable)

Influencer share: $1.00  (50% of net) ← moonfeedtest gets this
Platform share:   $1.00  (50% of net) ← Ultra wallet gets this
```

### Where to see it:
```bash
# See the trade with splits
curl http://localhost:3001/api/affiliates/moonfeedtest/trades

# See Ultra wallet total
curl http://localhost:3001/api/affiliates/platform/earnings
```

---

## 📊 Summary: Exactly Where to Look

| What You Want to See | Where to Find It |
|---------------------|------------------|
| **Split for a single trade** | API: `/api/affiliates/:code/trades` → Look at `influencerShare` and `platformShare` fields |
| **Affiliate's total earnings** | API: `/api/affiliates/:code/stats` → `totalEarnings` field |
| **Ultra wallet's total** | API: `/api/affiliates/platform/earnings` → `platformEarnings.total` |
| **Visual table with splits** | Dashboard → "All Trades" tab → See both columns |
| **Platform summary card** | Dashboard → Top section → Shows Ultra wallet totals |

---

## 🚀 To Test with a Real Trade:

1. **Open:** `http://localhost:5173?ref=moonfeedtest`
2. **Do a swap** (any token swap)
3. **Your code should track it** by calling:
   ```javascript
   fetch('http://localhost:3001/api/affiliates/track-trade', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       referralCode: 'moonfeedtest',
       userWallet: userPublicKey,
       tradeVolume: swapAmount,
       feeEarned: jupiterFee,
       tokenIn: inputToken,
       tokenOut: outputToken
     })
   })
   ```

4. **Check the split:**
   - API: `curl http://localhost:3001/api/affiliates/moonfeedtest/trades`
   - Dashboard: Open "All Trades" tab

---

## ✨ Key Points:

✅ **Every trade stores both splits** (affiliate + platform)  
✅ **API shows splits immediately** after trade  
✅ **Dashboard displays both columns** in table  
✅ **Platform endpoint shows Ultra wallet total**  
✅ **All amounts are in the exact same currency** as the fee  

**No guessing needed** - the exact split amounts are always visible! 🎯
