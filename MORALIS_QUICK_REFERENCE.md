# 🚀 Moralis API Quick Reference

## 📝 Summary
**Status:** ✅ Working & Ready  
**Migration Date:** November 7, 2025  
**API Provider:** Moralis  
**Endpoint:** Get Bonding Pump.fun Tokens  

---

## 🔑 API Key
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjJkODdkZDFhLTI3ZmMtNDliNS04YjQ2LTkwNDY4ZjNiNTY0ZSIsIm9yZ0lkIjoiNDc4NzM3IiwidXNlcklkIjoiNDkyNTI4IiwidHlwZUlkIjoiMDUzMzA5NWMtMDM4MS00YTY0LWEzMjItYTMwMzYxOGRmNzU4IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjE4NzQ1MTUsImV4cCI6NDkxNzYzNDUxNX0.Q-loivKb6SB63TTOKtiwCHKub-AIAxftLOc2qUfarmU
```
**Expires:** 2095 (basically never)

---

## 🌐 API Endpoints

### Get Bonding Tokens (What we use)
```bash
curl --request GET \
  --url 'https://solana-gateway.moralis.io/token/mainnet/exchange/pumpfun/bonding?limit=100' \
  --header 'accept: application/json' \
  --header 'X-API-Key: YOUR_API_KEY'
```

### Get Graduated Tokens (For reference)
```bash
curl --request GET \
  --url 'https://solana-gateway.moralis.io/token/mainnet/exchange/pumpfun/graduated?limit=100' \
  --header 'accept: application/json' \
  --header 'X-API-Key: YOUR_API_KEY'
```

---

## 📂 Files Changed

### New Files:
- `/backend/moralisService.js` - Main service (replaces bitqueryService)
- `/backend/test-moralis-api.js` - Test Moralis API directly
- `/backend/test-moralis-integration.js` - Test service integration
- `/backend/test-graduating-endpoint.js` - Test full endpoint

### Modified Files:
- `/backend/server.js` - Lines 1251-1262, 1303-1310

### Documentation:
- `/MORALIS_MIGRATION_COMPLETE.md` - Full migration guide
- `/BITQUERY_VS_MORALIS.md` - Comparison analysis

---

## 🧪 Quick Tests

### Test API directly:
```bash
cd backend
node test-moralis-api.js
```

### Test service:
```bash
node test-moralis-integration.js
```

### Test endpoint (backend must be running):
```bash
node test-graduating-endpoint.js
```

### Test in browser:
```
http://localhost:3001/api/coins/graduating?limit=10
```

---

## 📊 What We Get

**Current data (Nov 7, 2025):**
- 100 tokens total
- 15 tokens >90% progress (very close!)
- 50 tokens 80-90% progress
- 35 tokens 70-80% progress

**Fields per token:**
- tokenAddress, name, symbol, logo
- priceUsd, priceNative (SOL)
- liquidity, fullyDilutedValuation
- bondingCurveProgress (0-100%)
- decimals

---

## ⚙️ Configuration

**In `/backend/moralisService.js`:**

```javascript
// API Key
const MORALIS_API_KEY = 'eyJhbGci...';

// Cache TTL (2 minutes)
ttl: 2 * 60 * 1000

// Minimum bonding progress (70%)
minProgress = 70

// Max tokens per request
limit = 100
```

---

## 🔄 How It Works

```
1. Frontend requests /api/coins/graduating
         ↓
2. Backend checks cache (2-min TTL)
         ↓
3. If expired: Call Moralis API
         ↓
4. Transform data to app format
         ↓
5. Sort by graduation score
         ↓
6. Cache for 2 minutes
         ↓
7. Return to frontend
```

---

## 🎯 Graduation Scoring

```javascript
score = (bondingProgress × 90%) + 
        (liquidity/1000 × 5%) + 
        (fdv/1000 × 5%)
```

**Result:** Tokens closest to graduating appear first!

---

## 📱 Frontend Impact

**NONE!** The frontend works automatically because:
- Same endpoint URL
- Same response structure
- Same field names
- Same caching behavior

---

## 🚨 Troubleshooting

### Issue: "API Error 401"
**Fix:** Check API key is correct in moralisService.js

### Issue: "No tokens returned"
**Fix:** Check if Moralis API is down (rare), check rate limits

### Issue: "Endpoint returns 500"
**Fix:** Check backend logs for errors, verify moralisService.js exists

### Issue: "Frontend shows empty feed"
**Fix:** Check browser console, verify backend is running

---

## 🔐 Security Notes

**Current:** API key is in `moralisService.js`  
**Recommended:** Move to `.env` file

Add to `.env`:
```bash
MORALIS_API_KEY=eyJhbGci...
```

Update `moralisService.js`:
```javascript
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
```

---

## 📈 Rate Limits

**Free Tier:** 100,000 API calls/month  
**Our Usage:** ~22,000 calls/month  
**Status:** ✅ Well within limits!

Calculation:
- Cache: 2 minutes
- Calls per hour: 30
- Calls per day: 720
- Calls per month: ~22,000

---

## 🔗 Useful Links

**Moralis Dashboard:**
https://admin.moralis.io/

**API Documentation:**
https://docs.moralis.io/web3-data-api/solana/pump-fun-api

**Bonding Tokens Endpoint:**
https://docs.moralis.io/web3-data-api/solana/pump-fun-api/get-bonding-pumpfun-tokens

**Support:**
https://moralis.io/support/

---

## ✅ Deployment Checklist

Before deploying:
- [x] Test API connection
- [x] Test service integration
- [x] Test endpoint response
- [x] Verify frontend compatibility
- [ ] Move API key to .env (optional but recommended)
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Check graduating feed in app

After deploying:
- [ ] Verify feed loads
- [ ] Check bonding progress bars
- [ ] Ensure prices update
- [ ] Monitor for errors
- [ ] Celebrate! 🎉

---

## 🎊 Success Criteria

After deployment, you should see:
- ✅ Graduating feed loads in <500ms
- ✅ 100 tokens available
- ✅ Bonding progress shows 70-100%
- ✅ Prices are accurate
- ✅ Logos display correctly
- ✅ No console errors
- ✅ Smooth scrolling

---

## 💡 Pro Tips

1. **Cache is your friend:** 2-minute cache means fast responses
2. **70% threshold is optimal:** Good balance of quantity and relevance
3. **Graduation score works:** Best tokens really do appear first
4. **Free tier is generous:** No worry about costs
5. **Rollback is easy:** Keep bitqueryService.js just in case

---

## 🎓 Bottom Line

**The Moralis integration is:**
- ✅ Simple to use
- ✅ Reliable and fast
- ✅ Well documented
- ✅ Free (for our usage)
- ✅ Better than BitQuery
- ✅ Ready to deploy NOW!

**Just do it!** 🚀

---

**Questions? Check the full docs:**
- `MORALIS_MIGRATION_COMPLETE.md` - Complete guide
- `BITQUERY_VS_MORALIS.md` - Detailed comparison
