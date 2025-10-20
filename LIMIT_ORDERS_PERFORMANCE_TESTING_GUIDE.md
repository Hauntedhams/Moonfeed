# Limit Orders Performance Testing Guide

## 🎯 Quick Testing Checklist

Use this guide to verify all performance optimizations are working correctly.

---

## 🧪 Test 1: Backend Metadata Caching

### Steps
1. Open backend terminal and watch logs
2. In browser, load your profile with limit orders
3. Look for metadata API calls in logs
4. **Refresh the page immediately**
5. Check logs again

### Expected Results
- ✅ **First load**: See API calls to Jupiter/Solscan/Dexscreener for metadata
- ✅ **Second load**: See logs: `🚀 Using cached metadata: SYMBOL`
- ✅ **No API calls** for same tokens on second load

### Console Log Example
```
First Load:
[Jupiter Trigger] ✅ Token metadata from Jupiter: BONK
[Jupiter Trigger] ✅ Token metadata from Solscan: WIF

Second Load (immediate):
[Jupiter Trigger] 🚀 Using cached metadata: BONK
[Jupiter Trigger] 🚀 Using cached metadata: WIF
```

---

## 🧪 Test 2: Backend Price Caching

### Steps
1. Load profile with limit orders
2. Note the load time
3. **Immediately refresh** (F5)
4. Note the load time again

### Expected Results
- ✅ **First load**: ~3-5 seconds
- ✅ **Second load**: ~0.5-1 second (much faster)
- ✅ Console shows: `🚀 Using cached price: X.XXXXXXXXXX SOL per token`

### Console Log Example
```
First Load:
[Jupiter Trigger] Current price via Jupiter (USD→SOL): 0.0000123456 SOL per token

Second Load (within 30s):
[Jupiter Trigger] 🚀 Using cached price: 0.0000123456 SOL per token
```

---

## 🧪 Test 3: Batch Price Fetching

### Steps
1. Clear browser cache
2. Load profile with **multiple orders** (3+ different tokens)
3. Watch backend logs carefully

### Expected Results
- ✅ See: `🚀 Pre-fetched X prices for enrichment` (before individual order logs)
- ✅ See: `🚀 Batch fetched prices for X/Y tokens`
- ✅ See: `🚀 Using batched price: X.XXXXXXXXXX SOL per token` (for each order)
- ✅ **Only 1-2 API calls** instead of 3 per token

### Console Log Example
```
[Jupiter Trigger] Found 5 orders
[Jupiter Trigger] 🚀 Pre-fetched 5 prices for enrichment
[Jupiter Trigger] 🚀 Batch fetched prices for 5/5 tokens
[Jupiter Trigger] 🚀 Using batched price: 0.0000123456 SOL per token
[Jupiter Trigger] 🚀 Using batched price: 0.0000789012 SOL per token
...
```

---

## 🧪 Test 4: Frontend Order Caching

### Steps
1. Load profile page (Active Orders tab)
2. Wait for orders to load (~3-5 seconds)
3. Click **"History" tab**
4. Note the loading time
5. Click **"Active Orders" tab** again
6. Note the loading time

### Expected Results
- ✅ **First load (Active)**: 3-5 seconds with loading spinner
- ✅ **Switch to History**: **Instant** (<100ms, no spinner)
- ✅ **Switch back to Active**: **Instant** (<100ms, no spinner)
- ✅ Console shows: `🚀 Using cached orders for active (X orders, age: Ys)`

### Console Log Example
```
// First load
Fetching orders from backend...

// Tab switch (within 30s)
[Order Cache] 🚀 Using cached orders for history (5 orders, age: 5s)

// Another tab switch
[Order Cache] 🚀 Using cached orders for active (3 orders, age: 10s)
```

---

## 🧪 Test 5: Cache Expiration

### Steps
1. Load profile with orders
2. Switch tabs a few times (verify caching works)
3. **Wait 35 seconds** (cache expires after 30s)
4. Switch tabs again
5. Watch for loading spinner

### Expected Results
- ✅ **Within 30s**: Instant tab switches (cached)
- ✅ **After 30s**: Loading spinner appears (cache expired)
- ✅ Fresh data fetched from backend

---

## 🧪 Test 6: Cache Invalidation (Cancel Order)

### Steps
1. Load profile with an active order
2. Click "Cancel Order"
3. Approve in wallet
4. Wait for success message
5. **Immediately switch to History tab**

### Expected Results
- ✅ After cancel: Console shows `🗑️ Invalidated order cache`
- ✅ Orders refresh automatically
- ✅ Next tab switch: **Fetches fresh data** (not from cache)
- ✅ Loading spinner appears briefly

### Console Log Example
```
[Cancel Order] Step 1: Requesting cancel transaction...
[Cancel Order] Order cancelled successfully
[Order Cache] 🗑️ Invalidated order cache
Fetching orders from backend...
```

---

## 🧪 Test 7: Cache Clearing (Wallet Disconnect)

### Steps
1. Load profile with orders (cache populated)
2. Click wallet disconnect button
3. Check session storage in DevTools
4. Reconnect wallet

### Expected Results
- ✅ On disconnect: Console shows `🗑️ Cleared X order caches`
- ✅ Session storage empty (check DevTools → Application → Session Storage)
- ✅ On reconnect: Fresh fetch (not from cache)

### How to Check Session Storage
1. Open DevTools (F12)
2. Go to **Application** tab
3. Expand **Session Storage**
4. Look for keys starting with `order_cache_`
5. After disconnect, these should be **gone**

---

## 🧪 Test 8: Performance Comparison

### Measure Load Times

#### Before Optimization (Disable Cache)
```javascript
// Temporarily disable cache in ProfileView.jsx
const cachedOrders = null; // getCachedOrders(walletAddress, statusFilter);
```

1. Clear browser cache
2. Load profile
3. Measure time until orders display
4. Note: **~5-10 seconds**

#### After Optimization (Cache Enabled)
```javascript
// Re-enable cache
const cachedOrders = getCachedOrders(walletAddress, statusFilter);
```

1. Clear browser cache
2. **First load**: ~3-5 seconds (cold cache)
3. **Second load**: <1 second (warm cache)
4. **Tab switch**: <100ms (cached)

### Performance Metrics Table

| Action | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial load | 10s | 3s | 70% faster |
| Second load | 10s | 0.5s | 95% faster |
| Tab switch | 5s | <0.1s | 98% faster |

---

## 🐛 Common Issues & Solutions

### Issue 1: Cache Not Working
**Symptoms**: Tab switches still slow, no cache logs

**Solution**:
```bash
# Check session storage is enabled
# In browser console:
sessionStorage.setItem('test', 'value')
sessionStorage.getItem('test')  // Should return 'value'

# If null, session storage is disabled or full
```

### Issue 2: Batch Fetching Not Working
**Symptoms**: Still seeing individual API calls per token

**Solution**:
```bash
# Check backend logs for batch pre-fetch
grep "Pre-fetched" backend_logs.txt

# Should see:
# [Jupiter Trigger] 🚀 Pre-fetched X prices for enrichment

# If not, check if orders array is empty or malformed
```

### Issue 3: Stale Data After Cancel
**Symptoms**: Cancelled order still shows in list

**Solution**:
```javascript
// Verify cache invalidation is called
// In ProfileView.jsx, after cancel:
const { invalidateOrderCache } = await import('../utils/orderCache.js');
invalidateOrderCache(publicKey.toString());  // ← This line should be present
await fetchOrders();  // ← This should refetch
```

---

## 📊 Performance Monitoring

### Backend Metrics to Track

Open backend terminal and watch for:
```bash
# Good signs:
🚀 Using cached metadata
🚀 Using cached price
🚀 Pre-fetched X prices
🚀 Batch fetched prices

# Bad signs (if too frequent):
⚠️  Using mint address as fallback symbol
⚠️  Using trigger price as fallback
```

### Frontend Metrics to Track

Open browser DevTools console and watch for:
```bash
# Good signs:
[Order Cache] 🚀 Using cached orders
[Jupiter Trigger] 🚀 Using batched price

# Bad signs:
Fetching orders from backend... (on every tab switch)
```

### Network Tab Check

1. Open DevTools → Network tab
2. Load profile with orders
3. Count API calls:
   - **Before optimization**: 30-60 requests
   - **After optimization**: 2-5 requests

---

## ✅ Success Criteria

All optimizations are working correctly if:

- [x] Backend logs show cache hits (`🚀 Using cached...`)
- [x] Batch price fetching runs before enrichment
- [x] Tab switches complete in <100ms (after first load)
- [x] Cache expires after 30 seconds
- [x] Cache invalidates after order cancel
- [x] Cache clears on wallet disconnect
- [x] Network tab shows 90%+ fewer API calls
- [x] User experience feels "instant" on tab switches

---

## 🚀 Quick Test Script

Run this in browser console to test caching:

```javascript
// Test 1: Check session storage cache
const checkCache = () => {
  const keys = Object.keys(sessionStorage);
  const orderKeys = keys.filter(k => k.startsWith('order_cache_'));
  console.log(`Found ${orderKeys.length} cached order sets`);
  orderKeys.forEach(key => {
    const data = JSON.parse(sessionStorage.getItem(key));
    const age = Math.round((Date.now() - data.timestamp) / 1000);
    console.log(`  ${key}: ${data.orders.length} orders, age: ${age}s`);
  });
};

checkCache();

// Test 2: Simulate tab switch timing
const measureTabSwitch = async () => {
  const start = performance.now();
  
  // Simulate clicking History tab
  document.querySelector('[data-tab="history"]')?.click();
  
  await new Promise(r => setTimeout(r, 100));
  const end = performance.now();
  
  console.log(`Tab switch took: ${(end - start).toFixed(2)}ms`);
};

measureTabSwitch();

// Test 3: Clear cache manually
const clearCache = () => {
  const keys = Object.keys(sessionStorage);
  const orderKeys = keys.filter(k => k.startsWith('order_cache_'));
  orderKeys.forEach(key => sessionStorage.removeItem(key));
  console.log(`Cleared ${orderKeys.length} cache entries`);
};

// clearCache();  // Uncomment to test
```

---

## 📝 Test Results Template

Copy this template to document your test results:

```markdown
## Performance Test Results

**Date**: [DATE]
**Tester**: [NAME]
**Wallet**: [WALLET ADDRESS - first 4/last 4]
**Order Count**: [X active, Y history]

### Backend Caching
- [ ] Metadata cache hit rate: X%
- [ ] Price cache hit rate: X%
- [ ] Batch fetching working: Yes/No

### Frontend Caching
- [ ] Tab switch time (cached): Xms
- [ ] Tab switch time (uncached): Xms
- [ ] Cache invalidation working: Yes/No

### API Call Reduction
- Before: X calls per load
- After: X calls per load
- Reduction: X%

### User Experience
- Initial load feels: Fast/Slow/Average
- Tab switches feel: Instant/Fast/Slow
- Overall satisfaction: 1-10

### Issues Found
- [List any issues or unexpected behavior]

### Notes
- [Any additional observations]
```

---

**Testing Duration**: ~10 minutes  
**Prerequisites**: Wallet with at least 2-3 active/history orders  
**Tools Needed**: Browser DevTools, backend terminal access

---

## 🎉 All Tests Passed? You're Ready!

If all tests pass:
- ✅ Performance optimizations are fully functional
- ✅ Caching is working correctly
- ✅ User experience is smooth and fast
- ✅ Ready for production deployment

**Report Issues**: If any test fails, check the "Common Issues" section above or refer to `LIMIT_ORDERS_PERFORMANCE_OPTIMIZATIONS_COMPLETE.md` for implementation details.
