# 🔧 ENRICHMENT INFRASTRUCTURE FIX PLAN

## Current Issues

### Issue 1: TRENDING Feed 70% Enrichment Failure
**Problem:** 7 out of 10 TRENDING coins are marked as `dexscreenerProcessedAt` but have NO actual enrichment data (no dexscreener object, no cleanChartData, no price changes).

**Root Cause:** DexScreener API may not return data for some tokens, OR the enrichment is failing silently and still marking coins as "processed".

**Fix:**
- Don't mark coins as "processed" if DexScreener returns no data
- Retry failed enrichments on next cycle
- Add logging to see WHY enrichment fails

---

### Issue 2: No Re-Enrichment System
**Problem:** Coins are enriched once and never updated. Data becomes stale.

**Fix:**
- Clear `dexscreenerProcessedAt` timestamp every 5-10 minutes to force re-enrichment
- Keep enriching in cycles continuously
- Fresh price changes, banner, market data every cycle

---

### Issue 3: One Enrichment Cycle Per Feed
**Problem:** Auto-enricher runs once on startup for first 10 coins, then stops or runs very slowly.

**Fix:**
- Continuous enrichment cycles every 20 seconds
- Process 5-10 coins per cycle per feed
- Rotate through all coins in feed

---

## Ideal Enrichment Flow

```
┌─────────────────────────────────────────────────────────────┐
│ SOLANA TRACKER API CALL                                     │
│ - TRENDING: Once per day                                    │
│ - NEW: Every 30 minutes                                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ IMMEDIATE PRIORITY ENRICHMENT                               │
│ - First 5-10 coins per feed                                 │
│ - Batch DexScreener API call                                │
│ - Get: price changes, banner, chart data, pair address      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ CONTINUOUS ENRICHMENT CYCLES (every 20 seconds)             │
│ - Process next 5 unenriched coins per feed                  │
│ - OR re-enrich coins >5 minutes old                         │
│ - Batch API calls to respect rate limits                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ PERIODIC RE-ENRICHMENT (every 5-10 minutes)                 │
│ - Clear processed timestamps                                │
│ - Re-fetch DexScreener data for all coins                   │
│ - Update: price changes, chart data                         │
│ - Keep: banner (doesn't change)                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ LIVE PRICE UPDATES (Jupiter API)                            │
│ - Independent of enrichment                                 │
│ - Updates price_usd every few seconds                       │
│ - Does NOT trigger re-enrichment                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Step 1: Fix Enrichment Success Detection
**File:** `backend/dexscreenerService.js`

```javascript
// In applyEnrichmentData function
async function applyEnrichmentData(coin, enrichmentData, options = {}) {
  // ... existing code ...
  
  // ONLY mark as enriched if we actually got DexScreener data
  if (enrichmentData.priceChanges && enrichmentData.transactions) {
    enrichedCoin.enriched = true;
    enrichedCoin.enrichmentSource = 'dexscreener';
    enrichedCoin.dexscreenerProcessedAt = new Date().toISOString();
  } else {
    // Don't mark as processed if enrichment failed
    console.log(`⚠️  Enrichment incomplete for ${coin.symbol} - will retry`);
  }
  
  return enrichedCoin;
}
```

---

### Step 2: Implement Re-Enrichment System
**File:** `backend/dexscreenerAutoEnricher.js`

```javascript
// Add periodic re-enrichment
async function processNext() {
  // ... existing code ...
  
  // Find coins that need re-enrichment (>5 minutes old)
  const staleCoins = currentCoins.filter(coin => {
    if (!coin.dexscreenerProcessedAt) return false;
    const age = Date.now() - new Date(coin.dexscreenerProcessedAt).getTime();
    return age > 5 * 60 * 1000; // 5 minutes
  });
  
  if (staleCoins.length > 0) {
    console.log(`🔄 Re-enriching ${Math.min(5, staleCoins.length)} stale coins...`);
    const batch = staleCoins.slice(0, 5);
    
    // Clear processed timestamps to allow re-enrichment
    batch.forEach(coin => {
      delete coin.dexscreenerProcessedAt;
    });
    
    await enrichBatch(batch);
  }
}
```

---

### Step 3: Increase Batch Processing
**File:** `backend/dexscreenerAutoEnricher.js`

```javascript
// Update batch size
this.batchSize = 5; // Process 5 coins at a time per feed
this.processInterval = 20000; // Check every 20 seconds

// Enrich first 10 immediately on startup
async function processPriorityCoins() {
  const priorityCoins = currentCoins.slice(0, 10); // First 10
  await enrichBatch(priorityCoins);
}
```

---

### Step 4: Add Enrichment Logging
**File:** `backend/dexscreenerService.js`

```javascript
// In fetchTokensBatch
const response = await fetch(`${DEXSCREENER_API_BASE}/dex/tokens/${addressesString}`);

if (!response.ok) {
  console.log(`❌ DexScreener batch API error ${response.status} for addresses:`, batchAddresses);
  return null;
}

const data = await response.json();

if (!data.pairs || data.pairs.length === 0) {
  console.log(`⚠️  No pairs returned for batch:`, batchAddresses);
  return null;
}

console.log(`✅ DexScreener returned ${data.pairs.length} pairs for ${batchAddresses.length} addresses`);
```

---

## Rate Limiting Strategy

**Current:** 
- 10 coins processed simultaneously (could hit rate limits)

**Improved:**
- Process 5 coins per batch per feed
- 200ms delay between batches
- Max 25 requests per minute per feed = 50 total
- DexScreener limit: ~300 requests/minute (safe margin)

---

## Testing Checklist

- [ ] TRENDING feed: First 10 coins enriched immediately on startup
- [ ] NEW feed: First 10 coins enriched immediately on startup
- [ ] Re-enrichment: Coins >5 minutes old get re-enriched
- [ ] Failed enrichment: Coins without data are retried, not marked as processed
- [ ] Batch processing: 5 coins per cycle, every 20 seconds
- [ ] cleanChartData: Present with 5 data points for all enriched coins
- [ ] Price changes: All 4 timeframes (5m, 1h, 6h, 24h) present
- [ ] No rate limiting: <50 requests per minute total
- [ ] Live prices: Jupiter updates working independently

---

## Success Metrics

**Target:**
- ✅ 100% enrichment rate for first 10 coins per feed
- ✅ 90%+ enrichment rate for all coins in feed
- ✅ Re-enrichment every 5-10 minutes
- ✅ No stale data >10 minutes old
- ✅ Clean charts working for all enriched coins

**Current:**
- ❌ 30% TRENDING enrichment (7 failed)
- ⚠️  80% NEW enrichment (2 failed)
- ❌ No re-enrichment (7 minutes stale)
- ❌ Clean charts missing for 70% TRENDING coins
