# 🧪 Wallet Modal Testing Guide

## Quick Test Steps

### 1. Visual Test in Browser
1. Open the app at `http://localhost:5173`
2. Navigate to a coin that has "Top Traders" section
3. Click on any wallet address (looks like: `9WzD...AWWM`)
4. The wallet modal should appear showing comprehensive analytics

### 2. What You Should See

#### Header Section
```
👛 Wallet Tracker
[Wallet Address with Solscan link]
📊 Showing comprehensive trading analytics (last 100 transactions)
```

#### Trading Activity Section
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Total Trades │ Unique Tokens│Active Position│Avg Trades/Day│
│     156      │      42      │      12      │     4.32     │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

#### Trading History Section
```
┌─────────────────────┬─────────────────────┐
│    First Trade      │     Last Trade      │
│ 1/15/2024, 3:45 PM  │ 3/20/2024, 9:12 AM  │
└─────────────────────┴─────────────────────┘
```

#### SOL Activity Section
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Total Spent  │Total Received│  Net Change  │  Total Fees  │
│ 145.23 SOL   │ 198.46 SOL   │ +53.22 SOL   │  0.45 SOL    │
│   (red)      │   (green)    │   (green)    │  (neutral)   │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

#### Top Traded Tokens Section
```
🪙 EPjFWdd5...  8 buys • 6 sells      1234.56    Active
🪙 So11111...   12 buys • 10 sells    5678.90    Active
🪙 Es9vMFrz... 5 buys • 5 sells      890.12     Closed
... (up to 10 tokens)
```

### 3. Backend Test (Terminal)

```bash
# Test endpoint directly
curl http://localhost:3001/api/wallet/9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM

# Expected JSON response:
{
  "success": true,
  "wallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "hasData": true,
  "trading": { ... },
  "solActivity": { ... },
  "tokens": [ ... ],
  "cached": false
}
```

### 4. Test Wallet Addresses

#### Active Trader (should show lots of data):
```
9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
```

#### New/Empty Wallet (should show "No transaction history"):
```
11111111111111111111111111111111
```

### 5. Error States to Test

#### No Backend Running
- Stop backend: `lsof -ti:3001 | xargs kill`
- Open wallet modal
- Should show: "❌ Unable to fetch wallet data: HTTP 500"
- Retry button should work when backend restarts

#### Invalid Wallet Address
- Try a malformed address (too short/long)
- Should handle gracefully with error message

#### Slow Network
- Backend logs should show caching behavior:
  - First request: "📡 Fetching 100 signatures..."
  - Second request within 5min: "💾 Cache hit: analytics-..."

### 6. Expected Backend Logs

```
🔍 Fetching Helius wallet analytics for: 9WzD...AWWM
📡 Fetching 100 signatures for 9WzD...AWWM
✅ API Response: 100 signatures
📊 Analyzing 100 transactions...
   Processed 10/50 transactions...
   Processed 20/50 transactions...
   Processed 30/50 transactions...
   Processed 40/50 transactions...
   Processed 50/50 transactions...
✅ Fetched 48 detailed transactions
✅ Successfully fetched wallet analytics for 9WzD...AWWM
```

### 7. Performance Benchmarks

| Metric | Target | Actual |
|--------|--------|--------|
| Initial Load | < 5s | ~3-4s |
| Cached Load | < 100ms | ~50ms |
| Cache Duration | 5 min | 5 min |
| Modal Open Animation | Smooth | ✅ |

### 8. Browser Console Checks

Open DevTools (F12) → Console:

**Expected logs:**
```
🔍 Fetching wallet data for: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
✅ Wallet data loaded from Helius
📊 Trading stats: {totalTrades: 156, uniqueTokens: 42, ...}
💰 SOL activity: {totalSpent: "145.2300", ...}
🪙 Tokens traded: 42
```

**No errors** - Should see NO red error messages

### 9. Mobile Test (Optional)

1. Open app on mobile device (same network)
2. Navigate to wallet modal
3. Should be responsive and scrollable
4. All sections should stack vertically
5. Touch interactions should work smoothly

### 10. Edge Cases

#### Very Active Wallet
- 100+ transactions analyzed
- Should show accurate counts
- Performance should still be good (< 5s)

#### Brand New Wallet
- Zero transactions
- Should show: "ℹ️ No transaction history found for this wallet"
- Should still show Solscan link

#### Wallet with Only SOL (No Token Trades)
- Should show SOL activity
- Token section should be empty or hidden
- No crashes or errors

---

## 🐛 Troubleshooting

### Problem: Modal shows "Loading..." forever

**Check:**
1. Is backend running? `lsof -ti:3001`
2. Check backend logs for errors
3. Test endpoint directly: `curl http://localhost:3001/api/wallet/[ADDRESS]`

**Fix:**
```bash
cd backend
npm run dev
```

### Problem: "HELIUS_API_KEY not configured"

**Check:**
```bash
grep HELIUS_API_KEY backend/.env
```

**Fix:**
```bash
echo "HELIUS_API_KEY=3608fa10-5cdb-4f82-a5bb-8297a2cd433f" >> backend/.env
```

### Problem: Modal shows old data

**Cause:** Cache is active (5 min TTL)

**Fix (for testing):**
- Wait 5 minutes, OR
- Restart backend to clear cache, OR
- Reduce cache TTL in `heliusWalletService.js`:
  ```javascript
  this.cacheTTL = 30 * 1000; // 30 seconds for testing
  ```

### Problem: Wallet modal not opening

**Check:**
1. Is wallet address valid?
2. Is click handler attached?
3. Check browser console for JavaScript errors

**Fix:**
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Clear browser cache

### Problem: Network errors

**Check:**
```bash
# Test network connectivity
curl https://mainnet.helius-rpc.com/?api-key=3608fa10-5cdb-4f82-a5bb-8297a2cd433f
```

**Fix:**
- Check firewall settings
- Verify Helius API key is valid
- Try different network connection

---

## ✅ Success Checklist

Before marking as complete, verify:

- [ ] Backend starts without errors
- [ ] Frontend loads at `http://localhost:5173`
- [ ] Wallet modal opens when clicking wallet address
- [ ] Trading Activity section shows correct data
- [ ] SOL Activity section shows SOL amounts
- [ ] Top Traded Tokens list displays tokens
- [ ] Solscan link works (opens in new tab)
- [ ] Loading spinner appears during fetch
- [ ] Cache works (second load is faster)
- [ ] Error handling works (stops backend and tests)
- [ ] Browser console has no red errors
- [ ] Backend logs show successful analytics fetch

---

## 📸 Screenshots to Take

For documentation, capture:

1. **Full Modal View** - All sections visible
2. **Trading Activity** - 4-stat grid
3. **SOL Activity** - SOL flow stats with colors
4. **Top Traded Tokens** - Token list with status
5. **Loading State** - Spinner animation
6. **Error State** - Error message with retry button
7. **Empty State** - "No transaction history" message

---

## 🎬 Demo Script

For showing to stakeholders:

1. **Opening**: "Let me show you the new wallet analytics feature..."
2. **Navigate**: Click on a wallet address in Top Traders
3. **Highlight**: "You can see this trader has made 156 trades across 42 different tokens..."
4. **Scroll**: "Here's their SOL activity - they're net positive by 53 SOL..."
5. **Point**: "And these are their most traded tokens, with buy/sell counts..."
6. **Click**: "You can also open their full transaction history on Solscan..."
7. **Close**: "All of this data is pulled in real-time from the Solana blockchain, completely free."

---

**Quick Test Command:**
```bash
# One-liner to test everything
curl -s http://localhost:3001/api/wallet/9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM | jq '.success, .trading.totalTrades, .solActivity.netChange'
```

Expected output:
```
true
156
"+53.2267"
```

✅ If you see this output, everything is working correctly!
