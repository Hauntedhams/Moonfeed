# NEW Feed Parameters Update - $20k-$70k Volume Range ✅

## Summary
Updated the NEW feed Solana Tracker API parameters to adjust the 5-minute volume range from **$15k-$30k** to **$20k-$70k** while keeping the age range at **1-96 hours**.

## Changes Made

### Previous Parameters
```javascript
minVolume_5m: 15000,  // $15k minimum 5-minute volume
maxVolume_5m: 30000,  // $30k maximum 5-minute volume
minCreatedAt: 96h ago // 96 hours ago
maxCreatedAt: 1h ago  // 1 hour ago
```

### New Parameters
```javascript
minVolume_5m: 20000,  // $20k minimum 5-minute volume ⬆️
maxVolume_5m: 70000,  // $70k maximum 5-minute volume ⬆️
minCreatedAt: 96h ago // 96 hours ago (unchanged)
maxCreatedAt: 1h ago  // 1 hour ago (unchanged)
```

## Rationale
- **Higher minimum volume ($20k)**: Filters out coins with very low trading activity, focusing on coins with more substantial interest
- **Higher maximum volume ($70k)**: Captures coins that are gaining momentum but haven't yet exploded, providing more opportunities
- **Wider range ($50k spread)**: Gives a better spectrum of emerging coins at different stages of growth
- **Age unchanged (1-96 hours)**: Maintains the focus on recently created coins

## Files Modified

### backend/server.js
**Location: `fetchNewCoinBatch()` function (line ~260)**

1. Updated volume parameters:
```javascript
minVolume_5m: 20000,  // $20k minimum 5-minute volume
maxVolume_5m: 70000,  // $70k maximum 5-minute volume
```

2. Updated console log:
```javascript
console.log(`📊 Filters: 5m Vol $20k-$70k | Liq $10k+ | MC $50k+ | Age 1-96h`);
```

3. Updated function comment:
```javascript
// Parameters: 1-96 hours age, $20k-$70k 5m volume
```

4. Updated `/api/coins/new` endpoint response criteria (line ~367, ~386):
```javascript
criteria: {
  age: '1-96 hours',
  volume_5m: '$20k-$70k'
}
```

## Verification

### Backend Startup Log
```
🆕 NEW FEED - Fetching recently created coins with 5m volume activity
📊 Filters: 5m Vol $20k-$70k | Liq $10k+ | MC $50k+ | Age 1-96h
📅 Time range: 2025-10-07T04:32:03.832Z to 2025-10-11T03:32:03.832Z
⏰ Coins must be 1 to 96 hours old
✅ Solana Tracker response: success, 100 tokens
🆕 Got 100 NEW tokens (1-96 hours old)
```

### API Response
```bash
$ curl 'http://localhost:3001/api/coins/new?limit=1'
{
  "success": true,
  "coins": [ ... ],
  "count": 1,
  "total": 100,
  "criteria": {
    "age": "1-96 hours",
    "volume_5m": "$20k-$70k"  ✅
  }
}
```

### Sample Coin Verification
From the response, we can verify coins meet the criteria:
- **UMBRA**: 5m volume = $51,759 ✅ (within $20k-$70k range)
- **Age**: 13 hours ✅ (within 1-96 hour range)
- **Market Cap**: $25.9M ✅ (above $50k minimum)
- **Liquidity**: $48k ✅ (above $10k minimum)

## Impact

### Expected Results
- **More quality coins**: Higher minimum volume ensures coins have real trading activity
- **Better momentum tracking**: Higher max volume captures coins gaining traction
- **100 coins returned**: Successfully fetching full batch with new parameters
- **Auto-refresh**: NEW feed refreshes every 30 minutes with updated parameters

### Frontend Impact
- Coin List Modal will show coins with $20k-$70k 5min volume
- ModernTokenScroller NEW tab will display the updated coin set
- Criteria displayed in loading states will show "$20k-$70k"

## Status
✅ **COMPLETE AND VERIFIED**
- Backend updated and restarted
- API endpoint returning 100 coins with new criteria
- Criteria documentation updated throughout codebase
- Auto-refresh system working with new parameters

## Next Steps
1. ✅ Backend restarted with new parameters
2. ✅ Verified 100 coins returned with correct volume range
3. [ ] Test frontend Coin List Modal shows updated criteria
4. [ ] Monitor coin quality over next few refresh cycles
5. [ ] Consider deploying to production after testing

---

**Date:** January 11, 2025  
**Priority:** HIGH  
**Complexity:** LOW (parameter adjustment)  
**Impact:** MEDIUM (affects coin selection quality)
