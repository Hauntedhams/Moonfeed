# Volume Popup Price Changes Fix

## Problem
The volume popup window was showing "Price change data loading..." even for enriched coins with working clean charts. It was only displaying the 24h change in fallback mode, not showing all available price change timeframes (5m, 1h, 6h, 24h) from the DexScreener API.

## Root Cause
The code was checking for price change data in the wrong location:
- It checked `coin.dexscreener?.priceChanges` first
- But the backend stores price change data at the **root level** as `coin.priceChange` and `coin.priceChanges`
- The backend code in `OnDemandEnrichmentService.js` (lines 362-363) sets:
  ```javascript
  priceChange: pair.priceChange || {},
  priceChanges: pair.priceChange || {}, // Alternative field name for compatibility
  ```

## Solution Applied

### 1. Fixed Price Change Data Location Check
**File**: `frontend/src/components/CoinCard.jsx` (lines ~217-244)

**Before**:
```javascript
let changes = coin.dexscreener?.priceChanges || coin.priceChanges;

if (!changes && coin.priceChange) {
  changes = {
    change5m: parseFloat(coin.priceChange.m5 || 0),
    change1h: parseFloat(coin.priceChange.h1 || 0),
    change6h: parseFloat(coin.priceChange.h6 || 0),
    change24h: parseFloat(coin.priceChange.h24 || 0)
  };
}
```

**After**:
```javascript
let changes = null;

// Priority order: coin.priceChanges > coin.priceChange > coin.dexscreener?.priceChanges
const rawPriceChange = coin.priceChanges || coin.priceChange || coin.dexscreener?.priceChanges;

if (rawPriceChange) {
  // Check if it's in DexScreener format (m5, h1, h6, h24) or already converted
  if ('m5' in rawPriceChange || 'h1' in rawPriceChange || 'h6' in rawPriceChange || 'h24' in rawPriceChange) {
    // Convert from DexScreener format
    changes = {
      change5m: parseFloat(rawPriceChange.m5 || 0),
      change1h: parseFloat(rawPriceChange.h1 || 0),
      change6h: parseFloat(rawPriceChange.h6 || 0),
      change24h: parseFloat(rawPriceChange.h24 || 0)
    };
  } else if ('change5m' in rawPriceChange || 'change1h' in rawPriceChange || 'change6h' in rawPriceChange || 'change24h' in rawPriceChange) {
    // Already in converted format
    changes = rawPriceChange;
  }
}
```

### 2. Fixed "More timeframes available" Message
**File**: `frontend/src/components/CoinCard.jsx` (lines ~347-350)

**Before**:
```javascript
priceChangeInfo += '<div style="font-size: 0.7rem; color: #64748b; margin-top: 8px; text-align: center;">📊 More timeframes available after enrichment</div>';
```

**After**:
```javascript
// Only show "more timeframes available after enrichment" if coin is NOT yet enriched
if (!coin.enriched && !coin.cleanChartData) {
  priceChangeInfo += '<div style="font-size: 0.7rem; color: #64748b; margin-top: 8px; text-align: center;">📊 More timeframes available after enrichment</div>';
}
```

## How It Works Now

1. **Price Change Data Priority**:
   - First checks `coin.priceChanges` (backend sets this)
   - Then checks `coin.priceChange` (backend also sets this with same data)
   - Fallback to `coin.dexscreener?.priceChanges` (for backwards compatibility)

2. **Format Detection**:
   - Detects if data is in DexScreener format (m5, h1, h6, h24)
   - Converts to display format (change5m, change1h, change6h, change24h)
   - Handles already-converted format for compatibility

3. **Display Logic**:
   - Shows ALL available timeframes (5m, 1h, 6h, 24h)
   - Uses the `in` operator to show even 0% changes
   - Only shows "more timeframes available after enrichment" if coin is NOT enriched

## Expected Behavior

### For Enriched Coins with Clean Charts:
✅ Shows all available price changes (5m, 1h, 6h, 24h)
✅ Shows transaction activity (buys/sells)
✅ Shows "Live price tracking" message
❌ Does NOT show "Price change data loading..."
❌ Does NOT show "More timeframes available after enrichment"

### For Non-Enriched Coins:
⏳ Shows basic 24h change if available
⏳ Shows "More timeframes available after enrichment"
⏳ Shows "Price change data will load shortly" if no data yet

## Data Flow

1. **Backend** (`OnDemandEnrichmentService.js`):
   ```javascript
   processDexScreenerData(pair, coin) {
     return {
       priceChange: pair.priceChange || {},  // { m5, h1, h6, h24 }
       priceChanges: pair.priceChange || {}, // Same data, alternative field
       // ... other fields
     };
   }
   ```

2. **Frontend** (`CoinCard.jsx`):
   ```javascript
   // Get data from root level
   const rawPriceChange = coin.priceChanges || coin.priceChange;
   
   // Convert to display format
   if ('m5' in rawPriceChange) {
     changes = {
       change5m: rawPriceChange.m5,
       change1h: rawPriceChange.h1,
       change6h: rawPriceChange.h6,
       change24h: rawPriceChange.h24
     };
   }
   
   // Display all available timeframes
   if ('change5m' in changes) { /* show 5m */ }
   if ('change1h' in changes) { /* show 1h */ }
   if ('change6h' in changes) { /* show 6h */ }
   if ('change24h' in changes) { /* show 24h */ }
   ```

## Testing

To verify the fix:

1. Load a coin and wait for enrichment
2. Click the volume metric to open the popup
3. **Expected**: See all available price change timeframes (5m, 1h, 6h, 24h)
4. **Expected**: See transaction activity if available
5. **Expected**: See "Live price tracking" message
6. **Not expected**: "Price change data loading..." or "More timeframes available after enrichment"

Check the console for debug log:
```javascript
📊 Volume tooltip for SYMBOL: {
  hasChanges: true,
  changes: { change5m: 0, change1h: 5.2, change6h: -2.1, change24h: 15.8 },
  rawPriceChange: { m5: 0, h1: 5.2, h6: -2.1, h24: 15.8 },
  enriched: true,
  hasCleanChart: true
}
```

## Related Files
- `frontend/src/components/CoinCard.jsx` - Volume popup display logic
- `backend/services/OnDemandEnrichmentService.js` - Backend enrichment and data structure
- Lines 362-363: Where `priceChange` and `priceChanges` are set

## Status
✅ **COMPLETE** - All price change timeframes now display correctly for enriched coins
