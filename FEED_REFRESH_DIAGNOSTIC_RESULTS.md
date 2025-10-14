# Feed Refresh Diagnostic Results

## Date: October 13, 2025

## Summary
We've diagnosed the periodic refresh system for both NEW feed (30 min) and TRENDING feed (24 hrs). The diagnostic reveals that **the production server needs to be updated** with the latest code that includes admin monitoring endpoints.

## Findings

### ✅ What's Working
1. **Production Server is Running**: Health check responds correctly
2. **Feeds are Serving Data**: Both trending and new feeds return coins
3. **New Feed Coins are Fresh**: Average age is 7.2 hours (good!)
4. **Enrichment is Working**: All 5 test coins show enrichment data

### ⚠️ What Needs Attention
1. **Admin Endpoints Missing on Production**: 404 errors for:
   - `/api/admin/trending-refresher-status`
   - `/api/admin/new-refresher-status`
2. **Cannot Verify Refresh Status**: Without admin endpoints, we can't check if auto-refreshers are actually running

## Code Changes Made

### 1. Added Admin Endpoints to `backend/server.js`
```javascript
// Admin endpoint: Check trending auto-refresher status
app.get('/api/admin/trending-refresher-status', (req, res) => {
  try {
    const status = trendingAutoRefresher.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      isRunning: false
    });
  }
});

// Admin endpoint: Check new feed auto-refresher status
app.get('/api/admin/new-refresher-status', (req, res) => {
  try {
    const status = newFeedAutoRefresher.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      isRunning: false
    });
  }
});

// Admin endpoint: Manually trigger trending refresh
app.post('/api/admin/trending-refresh-trigger', async (req, res) => {
  try {
    const result = await trendingAutoRefresher.triggerRefresh();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Admin endpoint: Manually trigger new feed refresh
app.post('/api/admin/new-refresh-trigger', async (req, res) => {
  try {
    const result = await newFeedAutoRefresher.triggerRefresh();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

### 2. Created Diagnostic Script: `backend/diagnostic-feed-refresh.js`
- Checks both localhost and production environments
- Verifies auto-refresher status
- Checks feed data freshness
- Calculates time since last refresh

## Current Refresh System

### NEW Feed Auto-Refresher (`newFeedAutoRefresher.js`)
- **Interval**: 30 minutes
- **Source**: Solana Tracker API `/tokens/latest` endpoint
- **First Refresh**: 10 seconds after server start
- **Process**: 
  1. Fetches fresh NEW coins from Solana Tracker
  2. Updates `newCoins` cache
  3. Clears old enrichment data
  4. Triggers enrichment for first 10 coins

### TRENDING Feed Auto-Refresher (`trendingAutoRefresher.js`)
- **Interval**: 24 hours
- **Source**: Solana Tracker API `/tokens/trending` endpoint
- **First Refresh**: Does NOT run immediately (relies on cached data)
- **Process**:
  1. Fetches fresh TRENDING coins from Solana Tracker
  2. Saves to storage (auto-rotates old batches)
  3. Updates `currentCoins` cache
  4. Clears old enrichment data
  5. Restarts enrichment for first 10 coins

## Next Steps

### To Deploy the Fix:
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3
./deploy.sh
```

When prompted for commit message, use:
```
feat: add admin endpoints for monitoring feed refresh status
```

### After Deployment:
Wait 2-3 minutes for Render to rebuild and deploy, then run:
```bash
cd backend
node diagnostic-feed-refresh.js
```

This will now show:
- ✅ Trending auto-refresher status (running/not running, last refresh, next refresh)
- ✅ New feed auto-refresher status (running/not running, last refresh, next refresh)
- ✅ Verification that production matches localhost behavior

## How to Check Manually

### Check Production Status:
```bash
# Check trending refresher
curl https://api.moonfeed.app/api/admin/trending-refresher-status

# Check new feed refresher
curl https://api.moonfeed.app/api/admin/new-refresher-status
```

### Manually Trigger Refresh (if needed):
```bash
# Trigger trending refresh
curl -X POST https://api.moonfeed.app/api/admin/trending-refresh-trigger

# Trigger new feed refresh
curl -X POST https://api.moonfeed.app/api/admin/new-refresh-trigger
```

## Expected Behavior After Deployment

### NEW Feed (30 min cycle)
- Should refresh automatically every 30 minutes
- First refresh happens 10 seconds after server start
- Should see fresh coins with average age < 48 hours
- `stats.lastRefreshAt` should be within last 30 minutes

### TRENDING Feed (24 hour cycle)
- Should refresh automatically every 24 hours
- First refresh happens on next scheduled interval
- Should see stable trending coins
- `stats.lastRefreshAt` should be within last 24 hours + buffer

## Files Modified
1. ✅ `backend/server.js` - Added 4 admin endpoints
2. ✅ `backend/diagnostic-feed-refresh.js` - Created diagnostic script

## Files Involved (Reference)
- `backend/newFeedAutoRefresher.js` - NEW feed auto-refresh logic
- `backend/trendingAutoRefresher.js` - TRENDING feed auto-refresh logic
- `backend/server.js` - Main server with initialization
- `backend/new-coin-storage.js` - NEW feed storage
- `backend/coin-storage.js` - TRENDING feed storage

## Troubleshooting

### If NEW feed still shows old coins after deployment:
1. Check admin status: `curl https://api.moonfeed.app/api/admin/new-refresher-status`
2. If not running, check server logs on Render
3. Manually trigger: `curl -X POST https://api.moonfeed.app/api/admin/new-refresh-trigger`

### If TRENDING feed needs immediate refresh:
1. Manually trigger: `curl -X POST https://api.moonfeed.app/api/admin/trending-refresh-trigger`
2. Check status after: `curl https://api.moonfeed.app/api/admin/trending-refresher-status`

## Test Results Summary

### Production (Before Deployment)
- ✅ Server is running
- ✅ Feeds return data
- ✅ NEW feed coins are fresh (7.2 hours avg)
- ❌ Cannot verify auto-refresher status (endpoints missing)

### Expected After Deployment
- ✅ Server is running
- ✅ Feeds return data
- ✅ NEW feed coins are fresh
- ✅ Can verify auto-refresher status
- ✅ Can manually trigger refreshes if needed
- ✅ Can monitor next scheduled refresh times
