# Age & Holders Header Display Fix

## Problem
Age and Holders showing as "-" (blank) in the coin card header metrics section.

## Root Cause
The coin data was missing the `age`, `ageHours`, `holders`, or `holderCount` properties, or they were located under different property paths.

## Solution Applied

### Updated Data Extraction Logic

**File**: `/frontend/src/components/CoinCard.jsx`

#### 1. Enhanced `ageHours` Variable (Line 801)
**Before:**
```javascript
const ageHours = liveData?.ageHours ?? coin.ageHours ?? coin.dexscreener?.poolInfo?.ageHours ?? 0;
```

**After:**
```javascript
const ageHours = liveData?.ageHours ?? coin.ageHours ?? coin.age ?? coin.dexscreener?.poolInfo?.ageHours ?? 0;
```

**Added**: `coin.age` as a fallback option

#### 2. Enhanced `holders` Variable (Line 792)
**Before:**
```javascript
const holders = liveData?.holders ?? coin.holders ?? 0;
```

**After:**
```javascript
const holders = liveData?.holders ?? coin.holders ?? coin.holderCount ?? coin.dexscreener?.holders ?? 0;
```

**Added**: 
- `coin.holderCount` as alternative property name
- `coin.dexscreener?.holders` from DexScreener data

## How It Works

### Age Display Logic (Lines 1135-1143)
```javascript
<div className="header-metric">
  <div className="header-metric-label">Age</div>
  <div className="header-metric-value">
    {ageHours > 0 ? (ageHours < 24 ? `${ageHours}h` : `${Math.floor(ageHours / 24)}d`) : '-'}
  </div>
</div>
```

**Format**:
- `< 24 hours`: Shows as "18h"
- `>= 24 hours`: Shows as "3d" (rounded down)
- `No data`: Shows as "-"

### Holders Display Logic (Lines 1144-1150)
```javascript
<div className="header-metric">
  <div className="header-metric-label">Holders</div>
  <div className="header-metric-value">
    {holders > 0 ? formatCompact(holders) : '-'}
  </div>
</div>
```

**Format**:
- Uses `formatCompact()` function (e.g., "1.2K", "15.3K")
- `No data`: Shows as "-"

## Data Source Priority

### Age (ageHours)
1. `liveData.ageHours` (WebSocket live updates)
2. `coin.ageHours` (API response)
3. `coin.age` ⭐ NEW (alternative property)
4. `coin.dexscreener.poolInfo.ageHours` (DexScreener data)
5. `0` (default/no data)

### Holders
1. `liveData.holders` (WebSocket live updates)
2. `coin.holders` (API response)
3. `coin.holderCount` ⭐ NEW (alternative property)
4. `coin.dexscreener.holders` ⭐ NEW (DexScreener data)
5. `0` (default/no data)

## Backend Requirements

For Age and Holders to display properly, the backend should provide ONE of these:

### For Age:
- `ageHours` - Number of hours since token creation
- `age` - Number of hours since token creation  
- `dexscreener.poolInfo.ageHours` - From DexScreener API

### For Holders:
- `holders` - Total number of unique token holders
- `holderCount` - Total number of unique token holders
- `dexscreener.holders` - From DexScreener API

## Testing

### 1. Check if data is being received
Open browser console and look for coin data:
```javascript
// In the CoinCard component
console.log('Coin data:', coin);
console.log('Age hours:', ageHours);
console.log('Holders:', holders);
```

### 2. Verify data sources
Check which source is providing the data:
```javascript
console.log('Age sources:', {
  liveData: liveData?.ageHours,
  coinAgeHours: coin.ageHours,
  coinAge: coin.age,
  dexscreener: coin.dexscreener?.poolInfo?.ageHours
});

console.log('Holder sources:', {
  liveData: liveData?.holders,
  coinHolders: coin.holders,
  coinHolderCount: coin.holderCount,
  dexscreener: coin.dexscreener?.holders
});
```

### 3. Expected Results
- If backend provides data: Age shows "Xh" or "Xd", Holders shows "X.XK"
- If backend has no data: Both show "-"

## Next Steps

### If Still Showing "-"

1. **Check Backend Response**
   - Verify the backend is sending `age`/`ageHours` and `holders`/`holderCount` in the API response
   - Check the DexScreener enrichment is working

2. **Add Debug Logging**
   Add temporary logging in CoinCard.jsx around line 792-801:
   ```javascript
   const holders = liveData?.holders ?? coin.holders ?? coin.holderCount ?? coin.dexscreener?.holders ?? 0;
   const ageHours = liveData?.ageHours ?? coin.ageHours ?? coin.age ?? coin.dexscreener?.poolInfo?.ageHours ?? 0;
   
   console.log('🔍 Debug:', {
     symbol: coin.symbol,
     holders,
     ageHours,
     rawCoin: coin
   });
   ```

3. **Backend Enrichment**
   - Ensure DexScreener enrichment includes holder count
   - Calculate age from `created_timestamp` if available
   - Add to coin object before sending to frontend

## Visual Result

**Header Metrics Section:**
```
┌─────────────────────────────────────────────┐
│  LIQUIDITY    AGE      HOLDERS              │
│  $12.3K  🔒   18h      1.2K                 │
└─────────────────────────────────────────────┘
```

Instead of:
```
┌─────────────────────────────────────────────┐
│  LIQUIDITY    AGE      HOLDERS              │
│  $12.3K  🔒    -         -                  │
└─────────────────────────────────────────────┘
```

## Status
✅ Frontend code updated to check multiple data sources
⏳ Waiting for backend to provide age/holder data OR for existing data to populate

---

**Files Modified:**
- `/frontend/src/components/CoinCard.jsx` (Lines 792, 801)
