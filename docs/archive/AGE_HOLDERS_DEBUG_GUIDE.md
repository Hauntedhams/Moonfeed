# Age & Holders Debug Guide - Coin BwbZ992sMqabbBYnEj4tfNBmtdYtjRkSqgAGCyCRpump

## Purpose
Debug why Age and Holders are not displaying for the specific coin: `BwbZ992sMqabbBYnEj4tfNBmtdYtjRkSqgAGCyCRpump`

## Debug Logging Added

### Frontend Logging (CoinCard.jsx)
Added comprehensive logging around line 792 to track:
- All possible holders data sources
- All possible age data sources
- Full coin object
- Full liveData object

### Backend Logging (server.js)
Added logging around line 107 to track:
- Enriched coin holders data
- Enriched coin age data
- Full enriched coin object

## How to Test

### Step 1: Restart Backend
```bash
cd backend
npm run dev
```

### Step 2: Open Frontend in Browser
```bash
cd frontend
npm run dev
```

### Step 3: Find the Coin
1. Search for the coin using mint address: `BwbZ992sMqabbBYnEj4tfNBmtdYtjRkSqgAGCyCRpump`
2. OR scroll through feeds to find it
3. OR use the search modal

### Step 4: Check Browser Console
Look for the debug log:
```
🔍 DEBUG - Coin Data for BwbZ992s...: {
  symbol: "...",
  name: "...",
  mintAddress: "BwbZ992sMqabbBYnEj4tfNBmtdYtjRkSqgAGCyCRpump",
  holders_data: {
    'liveData.holders': ...,
    'coin.holders': ...,
    'coin.holderCount': ...,
    'coin.holder_count': ...,
    'coin.dexscreener.holders': ...,
    'FINAL holders': ...
  },
  age_data: {
    'liveData.ageHours': ...,
    'coin.ageHours': ...,
    'coin.age': ...,
    'coin.created_timestamp': ...,
    'coin.createdAt': ...,
    'coin.dexscreener.pairCreatedAt': ...
  },
  full_coin_object: {...},
  full_liveData: {...}
}
```

### Step 5: Check Backend Console
Look for the debug log:
```
🔍 DEBUG - Backend Enriched Data for BwbZ992s...: {
  symbol: "...",
  name: "...",
  mintAddress: "BwbZ992sMqabbBYnEj4tfNBmtdYtjRkSqgAGCyCRpump",
  holders_data: {
    holders: ...,
    holderCount: ...,
    holder_count: ...,
    'dexscreener.holders': ...
  },
  age_data: {
    age: ...,
    ageHours: ...,
    created_timestamp: ...,
    createdAt: ...,
    'dexscreener.pairCreatedAt': ...
  },
  full_enriched_coin: {...}
}
```

## What to Look For

### Scenario 1: Data Exists in Backend but Not Frontend
**Symptom**: Backend log shows holders/age but frontend shows 0 or undefined
**Cause**: Property name mismatch or data structure issue
**Fix**: Update frontend variable extraction to match backend property names

### Scenario 2: Data Missing in Backend
**Symptom**: Backend log shows null/undefined for all holders/age properties
**Cause**: Enrichment services not providing the data
**Fix**: Update backend enrichment services to fetch/calculate this data

### Scenario 3: Data Exists but Wrong Format
**Symptom**: Data is present but in unexpected format (string vs number, etc.)
**Cause**: Data type inconsistency
**Fix**: Add type conversion in frontend

## Common Data Sources

### Holders Data Sources (in priority order)
1. `liveData.holders` - WebSocket live updates
2. `coin.holders` - Direct property
3. `coin.holderCount` - Alternative property name
4. `coin.holder_count` - Snake case variant
5. `coin.dexscreener.holders` - From DexScreener enrichment

### Age Data Sources (in priority order)
1. `liveData.ageHours` - WebSocket live updates
2. `coin.ageHours` - Direct property (hours)
3. `coin.age` - Alternative property (hours)
4. `coin.created_timestamp` - Timestamp (needs calculation)
5. `coin.createdAt` - Alternative timestamp
6. `coin.dexscreener.pairCreatedAt` - DexScreener timestamp

## Expected Debug Output

### Example: Data Present
```javascript
holders_data: {
  'liveData.holders': undefined,
  'coin.holders': undefined,
  'coin.holderCount': 1234,  // ✅ FOUND HERE
  'coin.holder_count': undefined,
  'coin.dexscreener.holders': undefined,
  'FINAL holders': 1234  // ✅ Should show in UI
}

age_data: {
  'liveData.ageHours': undefined,
  'coin.ageHours': undefined,
  'coin.age': undefined,
  'coin.created_timestamp': 1729353600000,  // ✅ FOUND HERE
  'coin.createdAt': undefined,
  'coin.dexscreener.pairCreatedAt': undefined
}
```

### Example: Data Missing
```javascript
holders_data: {
  'liveData.holders': undefined,
  'coin.holders': undefined,
  'coin.holderCount': undefined,  // ❌ NOT FOUND
  'coin.holder_count': undefined,
  'coin.dexscreener.holders': undefined,
  'FINAL holders': 0  // ❌ Will show "-" in UI
}

age_data: {
  'liveData.ageHours': undefined,
  'coin.ageHours': undefined,
  'coin.age': undefined,
  'coin.created_timestamp': undefined,  // ❌ NOT FOUND
  'coin.createdAt': undefined,
  'coin.dexscreener.pairCreatedAt': undefined
}
```

## Next Steps Based on Results

### If Backend Has Data
1. Check property name mapping in frontend
2. Verify data type compatibility
3. Update frontend extraction logic if needed

### If Backend Missing Data
1. Check DexScreener enrichment service
2. Check Jupiter token service
3. Check Pump.fun service (for pump.fun tokens)
4. Add API calls to fetch missing data

### If Data Format Wrong
1. Add type conversion (parseInt, parseFloat, etc.)
2. Add timestamp to hours conversion
3. Add validation and fallbacks

## Cleanup After Testing

Once you've identified the issue, remove the debug logging:

### Frontend (CoinCard.jsx - around line 792)
Remove the entire debug console.log block

### Backend (server.js - around line 107)
Remove the entire debug console.log block

## Files Modified

- `/frontend/src/components/CoinCard.jsx` - Line ~792 (debug logging added)
- `/backend/server.js` - Line ~107 (debug logging added)

## Status
🔍 **DEBUGGING IN PROGRESS**

Ready to test - follow steps above and report findings!
