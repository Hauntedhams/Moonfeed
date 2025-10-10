# New Feed - Separate API Call Implementation

## Overview
The app now has **TWO SEPARATE** Solana Tracker API calls:

### 1. TRENDING Feed API Call
**Function:** `fetchFreshCoinBatch()`  
**Endpoint:** `GET /search`  
**Refresh Interval:** Every 24 hours (auto-refresh)

**Parameters:**
```javascript
{
  minLiquidity: 50000,        // $50k minimum liquidity
  maxLiquidity: 500000,       // $500k maximum liquidity  
  minVolume: 50000,           // $50k minimum volume
  maxVolume: 5000000,         // $5M maximum volume
  volumeTimeframe: "24h",     // 24 hour timeframe
  minMarketCap: 300000,       // $300k minimum market cap
  maxMarketCap: 10000000,     // $10M maximum market cap
  page: 1
}
```

**Focus:** Established coins with good liquidity and 24-hour volume metrics

---

### 2. NEW Feed API Call  
**Function:** `fetchNewCoinBatch()`  
**Endpoint:** `GET /search`  
**Refresh Interval:** Every 30 minutes (auto-refresh)

**Parameters:**
```javascript
{
  minVolume_5m: 1000,         // $1k minimum volume in 5 minutes
  volumeTimeframe: "5m",      // 5-minute timeframe for fresh activity
  sortBy: "createdAt",        // Sort by creation time
  sortOrder: "desc",          // Newest first
  limit: 100,                 // Get 100 newest coins
  page: 1
}
```

**Focus:** Recently created coins with 5-minute volume activity (fresher, more volatile)

---

## Key Differences

| Feature | Trending Feed | New Feed |
|---------|--------------|----------|
| **Volume Window** | 24 hours | **5 minutes** |
| **Min Volume** | $50,000 | **$1,000** |
| **Min Liquidity** | $50,000 | **None** (more permissive) |
| **Min Market Cap** | $300,000 | **None** (more permissive) |
| **Sorting** | By trending metrics | **By creation date (newest first)** |
| **Refresh Rate** | Every 24 hours | **Every 30 minutes** |
| **Focus** | Established trending coins | **Newly launched coins** |

---

## Data Fields Returned

### Trending Feed Returns:
- `volume_24h_usd` - 24-hour volume
- Higher liquidity requirements
- More established coins
- Priority based on trending metrics

### New Feed Returns:
- `volume_5m_usd` - **5-minute volume** 
- `age` - Age in hours (calculated from `createdAt`)
- `buys_5m`, `sells_5m` - 5-minute trading activity
- Lower entry barriers for new launches
- Priority based on creation time (newest first)

---

## Implementation Status

✅ **fetchNewCoinBatch()** function created  
⏳ Next: Update `/api/coins/new` endpoint to use this function  
⏳ Next: Create auto-refresher for NEW feed (30-minute interval)  
⏳ Next: Test the API call and show top 10 coins

---

## Expected Result for NEW Feed

When the NEW feed API call is made, you should see:
- Coins created within the last few hours/days
- Sorted by creation date (newest first)
- 5-minute volume metrics showing fresh trading activity
- Lower market caps and liquidity (catching them early!)

Example output:
```
1. NEWCOIN - Just launched 2 hours ago
   Volume 5m: $5,000
   Age: 2 hours
   
2. FRESH - Launched 5 hours ago
   Volume 5m: $3,200
   Age: 5 hours
```

Instead of old coins from July 2024!
