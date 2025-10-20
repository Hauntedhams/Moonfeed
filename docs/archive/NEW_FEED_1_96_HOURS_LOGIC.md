# NEW Feed - 1 to 96 Hours Old Logic ✅

## Time Range Logic

Based on the image you provided, the NEW feed uses this exact logic:

```javascript
const now = Date.now();
const minCreatedAt = now - (96 * 60 * 60 * 1000); // 96 hours ago (oldest)
const maxCreatedAt = now - (1 * 60 * 60 * 1000);  // 1 hour ago (youngest)
```

### Why This Range?

**`minCreatedAt` → now - 96 hours (oldest you'll allow)**
- Coins older than 96 hours (4 days) are excluded
- This keeps the feed fresh with recent launches

**`maxCreatedAt` → now - 1 hour (youngest you'll allow)**
- Coins newer than 1 hour are excluded
- **Gives them time to stabilize** before appearing
- Avoids showing coins with no trading history

### Result: Coins Between 1-96 Hours Old

✅ Perfect for "new but trending upward" tab  
✅ Coins have had time to establish some trading activity  
✅ Not too new (unstable) or too old (established)  

---

## Full API Parameters

```javascript
{
  minVolume_5m: 15000,          // $15k minimum 5-minute volume
  maxVolume_5m: 30000,          // $30k maximum 5-minute volume
  minCreatedAt: now - (96 * 60 * 60 * 1000),  // 96 hours ago
  maxCreatedAt: now - (1 * 60 * 60 * 1000),   // 1 hour ago
  sortBy: 'createdAt',          // Sort by creation date
  sortOrder: 'desc',            // Newest first
  limit: 100,
  page: 1
}
```

---

## Example Timeline

**Current time: October 9, 2025, 3:00 PM**

| Coin | Created At | Age | Included? |
|------|------------|-----|-----------|
| TOOYOUNG | Oct 9, 2:30 PM | 30 minutes | ❌ Too new (< 1 hour) |
| PERFECT1 | Oct 9, 12:00 PM | 3 hours | ✅ Yes (1-96 hours) |
| PERFECT2 | Oct 7, 5:00 PM | 46 hours | ✅ Yes (1-96 hours) |
| PERFECT3 | Oct 5, 4:00 PM | 95 hours | ✅ Yes (1-96 hours) |
| TOOLATE | Oct 5, 2:00 PM | 97 hours | ❌ Too old (> 96 hours) |

---

## Comparison with TRENDING Feed

| Feature | TRENDING Feed | NEW Feed |
|---------|--------------|----------|
| **Age Filter** | None | 1-96 hours |
| **Volume Window** | 24 hours | 5 minutes |
| **Volume Range** | $50k-$5M | $15k-$30k |
| **Purpose** | Established coins | New launches |
| **Stabilization** | Already stable | Given 1 hour to stabilize |

---

## Implementation Status

✅ **UPDATED:** `fetchNewCoinBatch()` in `server.js`
- Now uses `minCreatedAt: now - 96 hours`
- Now uses `maxCreatedAt: now - 1 hour`
- Properly filters for 1-96 hour old coins

✅ **UPDATED:** `test-new-feed-api.js`
- Test script matches the new logic
- Will show coins between 1-96 hours old

---

## Testing

Run the test to see actual coins:

```bash
node test-new-feed-api.js
```

Expected output:
```
🎯 TOP 10 NEW COINS (1-96 hours old, $15k-$30k 5m volume)

1. COIN1 - Created 2h ago, $18k 5m volume
2. COIN2 - Created 12h ago, $22k 5m volume
3. COIN3 - Created 24h ago, $25k 5m volume
...
```

All coins will be between 1 and 96 hours old! ✅
