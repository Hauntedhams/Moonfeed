# Backend Auto-Refresh and Enrichment System ✅

## Overview
The backend now handles ALL data fetching and enrichment automatically, independent of frontend requests. The frontend simply loads pre-enriched data that's constantly being updated in the background.

## How It Works

### 🔄 Automatic Background Processing

#### 1. **TRENDING Feed** (24-hour refresh cycle)
```
Server Starts
    ↓
Load cached trending coins
    ↓
Start DexScreener enrichment (first 10 coins prioritized)
    ↓
Start Rugcheck enrichment (first 10 coins prioritized)
    ↓
Start 24-hour auto-refresh timer
    ↓
Every 24 hours:
    - Fetch fresh trending coins from Solana Tracker
    - Update cache
    - Restart enrichment process
    - First 10 coins enriched immediately
```

#### 2. **NEW Feed** (30-minute refresh cycle)
```
Server Starts
    ↓
Start 30-minute auto-refresh timer
    ↓
IMMEDIATELY fetch NEW coins from Solana Tracker
    ↓
Start DexScreener enrichment (first 10 coins prioritized)
    ↓
Start Rugcheck enrichment (first 10 coins prioritized)
    ↓
Every 30 minutes:
    - Fetch fresh NEW coins from Solana Tracker
    - Update cache
    - Restart enrichment process
    - First 10 coins enriched immediately
```

### 📡 Frontend Request Flow

```
Frontend calls /api/coins/trending or /api/coins/new
    ↓
Backend returns CACHED data (already enriched)
    ↓
NO API calls to Solana Tracker
NO enrichment triggered
INSTANT response with pre-processed data
```

## Key Components

### 1. **Trending Auto-Refresher** (`trendingAutoRefresher.js`)
- **Frequency**: Every 24 hours
- **Purpose**: Keep trending coins fresh
- **Process**:
  - Fetches from Solana Tracker
  - Updates `currentCoins` cache
  - Triggers enrichment restart

### 2. **NEW Feed Auto-Refresher** (`newFeedAutoRefresher.js`)
- **Frequency**: Every 30 minutes
- **Purpose**: Keep NEW feed with latest 1-96 hour old coins
- **Process**:
  - Fetches from Solana Tracker with age filters
  - Updates `newCoins` cache
  - Triggers enrichment restart

### 3. **DexScreener Auto-Enricher** (`dexscreenerAutoEnricher.js`)
- **Per Feed**: Separate process for trending and new
- **Frequency**: Every 20 seconds (continuous)
- **Priority Processing**:
  - First 10 coins enriched IMMEDIATELY
  - Smaller batch size (10 instead of 25)
  - Faster delays (500ms instead of 1000ms)
  - Force banner enrichment enabled
- **Background Processing**:
  - Remaining coins enriched in 25-coin batches
  - Continues until all coins enriched

### 4. **Rugcheck Auto-Processor** (`rugcheckAutoProcessor.js`)
- **Per Feed**: Separate process for trending and new
- **Frequency**: Every 30 seconds (continuous)
- **Priority Processing**:
  - First 10 coins processed IMMEDIATELY
  - Smaller batch size (10 instead of 30)
  - Gets liquidity lock status, risk levels
- **Background Processing**:
  - Remaining coins processed in 30-coin batches
  - Continues until all coins processed

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    SERVER STARTUP                        │
└─────────────────────────────────────────────────────────┘
                           │
                           ├─→ Load cached trending coins
                           │   Start enrichment for trending
                           │   Start 24h auto-refresh timer
                           │
                           └─→ Start 30min auto-refresh timer
                               Fetch NEW coins immediately
                               Start enrichment for new feed

┌─────────────────────────────────────────────────────────┐
│                 BACKGROUND PROCESSES                     │
│                 (Independent of frontend)                │
└─────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐
│  TRENDING FEED   │     │    NEW FEED      │
│  (every 24h)     │     │  (every 30min)   │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         ├─ Fetch from API        ├─ Fetch from API
         ├─ Update cache          ├─ Update cache
         ├─ Enrich first 10       ├─ Enrich first 10
         └─ Enrich remaining      └─ Enrich remaining

┌─────────────────────────────────────────────────────────┐
│                  FRONTEND REQUEST                        │
└─────────────────────────────────────────────────────────┘
                           │
                GET /api/coins/trending
                GET /api/coins/new
                           │
                           ↓
                   Return CACHED data
                   (already enriched)
                           │
                           ↓
                    Instant response!
```

## API Endpoints

### GET /api/coins/trending
- **Returns**: Cached trending coins (50-300 limit)
- **Data Source**: `currentCoins` array (auto-refreshed every 24h)
- **Enrichment**: Pre-enriched with banners, Rugcheck status
- **Response Time**: < 10ms (just array slicing, no API calls)

### GET /api/coins/new
- **Returns**: Cached NEW coins (1-100 limit)
- **Data Source**: `newCoins` array (auto-refreshed every 30min)
- **Enrichment**: Pre-enriched with banners, Rugcheck status
- **Response Time**: < 10ms (just array slicing, no API calls)
- **First Load**: Returns 503 if NEW feed not yet loaded (< 30 seconds)

## Benefits

### ✅ Backend-Driven
- All data fetching happens on backend
- Frontend never triggers API calls
- Consistent data for all users

### ✅ Always Fresh
- Trending: Updated every 24 hours
- NEW: Updated every 30 minutes
- First 10 coins always enriched

### ✅ Fast Response
- No wait time for Solana Tracker API
- No wait time for enrichment
- Instant response with cached data

### ✅ Scalable
- Multiple users don't trigger multiple API calls
- Enrichment happens once per refresh cycle
- Rate limits respected automatically

### ✅ Resilient
- If enrichment fails, old data still available
- Background processes retry automatically
- Frontend always gets valid response

## Configuration

### Timing
```javascript
TRENDING_REFRESH: 24 hours
NEW_FEED_REFRESH: 30 minutes
DEXSCREENER_CHECK: 20 seconds
RUGCHECK_CHECK: 30 seconds
```

### Priority Processing
```javascript
PRIORITY_COINS: 10 (first coins in each feed)
PRIORITY_BATCH_SIZE: 10
PRIORITY_DELAY: 500ms
```

### Background Processing
```javascript
DEXSCREENER_BATCH: 25 coins
DEXSCREENER_DELAY: 1000ms
RUGCHECK_BATCH: 30 coins
RUGCHECK_DELAY: 1500ms
```

## Monitoring

### Logs to Watch
- `🆕 NEW FEED AUTO-REFRESH` - NEW feed refresh cycle
- `🔄 TRENDING AUTO-REFRESH` - Trending feed refresh cycle
- `🚀 PRIORITY:` - First 10 coins being enriched
- `✅ Auto-batch complete:` - Background enrichment progress

### Success Indicators
- `🎉 SUCCESS! All first 10 coins are fully enriched!`
- `🎉 COMPLETE!` - All coins in feed enriched
- `✅ Returning X cached coins` - API endpoint serving data

## Test Verification

Run the test to verify everything is working:
```bash
node test-priority-enrichment.js
```

Expected results:
- TRENDING: 10/10 enriched (100%)
- NEW: 10/10 enriched (100%)
- Both feeds: Banners and Rugcheck data present

## Files

### Core System
- `/backend/server.js` - Main server with endpoints
- `/backend/trendingAutoRefresher.js` - 24h trending refresh
- `/backend/newFeedAutoRefresher.js` - 30min NEW refresh

### Enrichment
- `/backend/dexscreenerAutoEnricher.js` - Banner/social enrichment
- `/backend/rugcheckAutoProcessor.js` - Security/lock enrichment

### Data Fetching
- `fetchFreshCoinBatch()` - Trending coins from Solana Tracker
- `fetchNewCoinBatch()` - NEW coins (1-96h old) from Solana Tracker

## Summary

✅ **Frontend**: Just displays pre-enriched data
✅ **Backend**: Handles all fetching and enrichment
✅ **Auto-Refresh**: Keeps data fresh automatically
✅ **Priority**: First 10 coins always enriched
✅ **Fast**: Instant responses (no waiting)
✅ **Scalable**: One refresh serves all users
