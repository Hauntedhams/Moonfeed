# Age Field Missing Fix - Complete

## Issue
Age was showing for some coins but not others, even though the coin was being enriched successfully. Holders was showing but Age was not.

## Root Cause
The backend `OnDemandEnrichmentService.js` was not extracting or calculating the age from DexScreener's `pairCreatedAt` timestamp.

## Solution

### Backend Fix (OnDemandEnrichmentService.js)
Added age calculation in the `processDexScreenerData` method:

```javascript
// Calculate age from pairCreatedAt timestamp
let ageHours = null;
if (pair.pairCreatedAt) {
  const createdTime = new Date(pair.pairCreatedAt).getTime();
  const now = Date.now();
  const ageMs = now - createdTime;
  ageHours = Math.floor(ageMs / (1000 * 60 * 60)); // Convert to hours
  console.log(`⏰ Calculated age for ${coin.symbol}: ${ageHours}h from ${pair.pairCreatedAt}`);
}

return {
  // ... other fields
  ageHours,
  created_timestamp: pair.pairCreatedAt,
  // ... other fields
};
```

### Frontend (CoinCard.jsx)
Already had the correct logic to display both `coin.age` and `coin.ageHours`:

```javascript
{(coin.age || coin.ageHours) && (
  <div className="info-row">
    <span className="info-label">Age:</span>
    <span className="info-value">
      {(() => {
        const hours = coin.age || coin.ageHours || 0;
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return `${days}d ${remainingHours}h`;
      })()}
    </span>
  </div>
)}
```

### Debug Logging
Added temporary debug logging in CoinCard.jsx to trace Age/Holders data:

```javascript
useEffect(() => {
  console.log(`🐛 [CoinCard] ${coin.symbol || coin.name} Age/Holders debug:`, {
    age: coin.age,
    ageHours: coin.ageHours,
    created_timestamp: coin.created_timestamp,
    createdTimestamp: coin.createdTimestamp,
    holders: coin.holders,
    holderCount: coin.holderCount,
    allCoinProps: Object.keys(coin).filter(k => 
      k.toLowerCase().includes('age') || 
      k.toLowerCase().includes('holder') || 
      k.toLowerCase().includes('created')
    )
  });
}, [coin]);
```

## Files Modified
1. `/backend/services/OnDemandEnrichmentService.js` - Added age calculation in `processDexScreenerData`
2. `/frontend/src/components/CoinCard.jsx` - Added debug logging (temporary)

## Testing
1. Search for any coin (e.g., PORNHUB mint: 9hv8jLxAGkn2zZFPvj19zxJfXD1acGiS8jaJrQwjpump)
2. Check browser console for debug logs showing `ageHours` value
3. Verify Age displays in Market Metrics section of CoinCard
4. Backend console should show: `⏰ Calculated age for COINNAME: XXh from TIMESTAMP`

## Expected Result
✅ Age now displays for all enriched coins that have DexScreener data with `pairCreatedAt`
✅ Age is calculated in hours and displayed as "Xh" or "Xd Yh" format
✅ Both Holders and Age display correctly in Market Metrics

## Cleanup Needed
Remove debug logging from CoinCard.jsx once confirmed working:
- Remove the `useEffect` that logs Age/Holders debug info

## Date
December 2024
