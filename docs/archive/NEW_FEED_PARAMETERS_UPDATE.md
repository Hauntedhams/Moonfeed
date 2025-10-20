# NEW Feed Parameters Update - Complete

## Summary
Updated the Solana Tracker API parameters for the NEW feed to target a different set of recently created tokens with specific liquidity, market cap, and volume characteristics.

## Changes Made

### 1. Updated Search Parameters in `fetchNewCoinBatch()`
**File:** `/backend/server.js` (Lines 363-398)

#### Old Parameters:
- **Liquidity:** $10k minimum (no max)
- **Market Cap:** $50k minimum (no max)
- **5-minute Volume:** $20k - $70k
- **Age Range:** 1 to 96 hours

#### New Parameters:
- **Liquidity:** $5,000 - $200,000 (min to max range)
- **Market Cap:** $20,000 - $1,000,000 (min to max range)
- **1-Hour Volume:** $5,000 minimum (no max)
- **6-Hour Volume:** $20,000 minimum (no max)
- **Age Range:** 0 to 96 hours (includes brand new coins)

### 2. Updated API Response Criteria
**File:** `/backend/server.js` - `/api/coins/new` endpoint

Both the loading state and success state responses now return updated criteria:
```javascript
criteria: {
  age: '0-96 hours',
  liquidity: '$5k-$200k',
  market_cap: '$20k-$1M',
  volume_1h: '$5k+',
  volume_6h: '$20k+'
}
```

### 3. Enhanced Token Data Mapping
Added support for 1-hour and 6-hour volume fields in the token data:
```javascript
volume_1h: token.volume_1h || 0,
volume_6h: token.volume_6h || 0,
```

## Technical Details

### Search Parameters Object:
```javascript
const searchParams = {
  // Liquidity range - $5k to $200k
  minLiquidity: 5000,
  maxLiquidity: 200000,
  
  // Market cap range - $20k to $1M
  minMarketCap: 20000,
  maxMarketCap: 1000000,
  
  // 1H volume - $5k to Max
  minVolume_1h: 5000,
  
  // 6H volume - $20k to Max
  minVolume_6h: 20000,
  
  // Age - 0 to 96 hours old
  minCreatedAt: now - (96 * 60 * 60 * 1000),
  maxCreatedAt: now,
  
  // Sorting
  sortBy: 'createdAt',
  sortOrder: 'desc',
  limit: 100,
  page: 1
};
```

## Impact

### What This Changes:
1. **Broader Liquidity Range:** Now captures coins from $5k to $200k (vs $10k+), targeting smaller, newer tokens
2. **Wider Market Cap Range:** $20k to $1M (vs $50k+), allowing smaller-cap opportunities
3. **Different Volume Metrics:** Switched from 5-minute volume to 1-hour and 6-hour volume for better momentum indicators
4. **Includes Brand New Coins:** Changed from 1-96 hours to 0-96 hours to catch coins immediately after creation

### Expected Results:
- More coins that fit the NEW feed criteria
- Coins with lower liquidity and market cap (earlier opportunities)
- Better volume filtering with 1H and 6H timeframes
- Includes freshly launched tokens (0 hours old)

## Auto-Refresh Behavior

The NEW feed automatically refreshes every **30 minutes** via the `newFeedAutoRefresher` service. After this update:
- The next auto-refresh will use the new parameters
- Fresh coins matching the new criteria will be fetched from Solana Tracker
- The first 10 coins will be enriched before being displayed
- The feed will be saved to disk for persistence

## Testing

To test the new parameters:
1. Wait for the next auto-refresh (or restart the backend server)
2. Check the backend console logs for:
   ```
   🆕 NEW FEED - Fetching recently created coins with updated parameters
   📊 Filters: Liq $5k-$200k | MC $20k-$1M | 1H Vol $5k+ | 6H Vol $20k+ | Age 0-96h
   ```
3. Verify coins in the NEW feed match the new criteria

## Git Commit

**Commit:** `6cb6266`
**Message:** "Update NEW feed parameters: Liq $5k-$200k, MC $20k-$1M, Vol 1H $5k+, Vol 6H $20k+, Age 0-96h"

**Changes:**
- 1 file changed: `backend/server.js`
- 63 insertions, 21 deletions

## Deployment

Changes have been pushed to GitHub (`main` branch). To deploy:
1. Pull changes on production server
2. Restart backend service
3. Monitor NEW feed for new coins matching updated criteria

---

**Date:** October 11, 2025
**Status:** ✅ Complete and Pushed to GitHub
