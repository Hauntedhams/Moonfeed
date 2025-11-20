# Chart Cache System - Quick Reference

## Cache Layers & Durations

| Layer | Location | Duration | Size Limit | Features |
|-------|----------|----------|------------|----------|
| **Frontend** | `TwelveDataChart.jsx` | 10 min | 100 entries | Deduplication, instant loads |
| **Backend Proxy** | `server.js` | 10 min (OHLCV)<br>5 min (Pool) | 200 entries | Stale fallback on rate limits |
| **Service** | `geckoTerminalService.js` | 15 min (base)<br>30 min (OHLCV) | 500 entries | Deduplication, stale fallback |

## Cache Keys

### Frontend Cache Keys
```javascript
// Format: poolAddress-timeframe
"2Qv3...abc-5m"
"2Qv3...abc-1h"
"2Qv3...abc-1d"
```

### Backend Proxy Cache Keys
```javascript
// OHLCV: ohlcv_network_poolAddress_timeframe_aggregate_limit
"ohlcv_solana_2Qv3...abc_minute_1_100"

// Pool: pool_network_poolAddress
"pool_solana_2Qv3...abc"
```

### Service Cache Keys
```javascript
// Format: endpoint_params
"/networks/solana/pools/2Qv3...abc/ohlcv/minute_{\"limit\":100}"
```

## Usage Patterns

### Typical User Journey
```
1. User opens app
   └─► Frontend: ❌ Cache miss → Fetch from backend
       └─► Backend Proxy: ❌ Cache miss → Fetch from service
           └─► Service: ❌ Cache miss → Fetch from GeckoTerminal
           
2. User scrolls to next coin (after 30s)
   └─► Frontend: ❌ Cache miss → Fetch from backend
       └─► Backend Proxy: ✅ Cache HIT (instant return)
       
3. User scrolls back to first coin (after 1 min)
   └─► Frontend: ✅ Cache HIT (instant, < 10ms)
   
4. User changes timeframe on same coin
   └─► Frontend: ❌ Cache miss (different key) → Fetch from backend
       └─► Backend Proxy: ❌ Cache miss → Fetch from service
           └─► Service: ❌ Cache miss → Fetch from GeckoTerminal
```

### Multi-User Benefit
```
User A loads coin → Backend caches for 10 min
User B loads same coin (5 min later) → Backend cache HIT → No API call
User C loads same coin (8 min later) → Backend cache HIT → No API call
User D loads same coin (11 min later) → Cache expired → New API call
```

## Cache Hit Scenarios

### ✅ Frontend Cache Hits (< 10ms)
- Revisiting a coin within 10 minutes
- Switching away and back to the same coin
- Same timeframe selection

### ✅ Backend Cache Hits (50-100ms)
- Different users viewing the same coin
- User refreshes page within cache window
- Navigating between coins

### ✅ Service Cache Hits (100-200ms)
- Multiple backend instances (future)
- Different endpoints using same pool data
- Recovery from proxy cache expiry

## Rate Limit Handling

### Scenario: GeckoTerminal Returns 429

```javascript
// Flow:
1. Request hits GeckoTerminal API
2. API returns 429 (Too Many Requests)
3. Service checks for stale cache
   - If found: Returns old data (even if > 15 min old)
   - If not found: Throws error
4. Backend proxy checks for stale cache
   - If found: Returns old data (even if > 10 min old)
   - If not found: Returns error to frontend
5. Frontend shows cached data or error message
```

### Graceful Degradation
```
Best case:     Fresh data (< cache duration)
Good case:     Stale data (> cache duration, but available)
Acceptable:    Very stale data (during rate limit events)
Last resort:   Error message with retry option
```

## Deduplication Examples

### Frontend Deduplication
```javascript
// Scenario: User rapidly switches between timeframes
Time 0ms:   Request 5m chart → Start fetching
Time 100ms: Request 5m chart → Returns same promise (deduplicated)
Time 200ms: First request completes → Both resolve with same data
```

### Backend Deduplication
```javascript
// Scenario: Multiple users load same coin simultaneously
Request A at 0ms:   OHLCV for pool X → Start fetching from GeckoTerminal
Request B at 50ms:  OHLCV for pool X → Returns same promise (deduplicated)
Request C at 100ms: OHLCV for pool X → Returns same promise (deduplicated)
Time 400ms: Single GeckoTerminal call completes → All 3 requests resolve
```

## Cache Cleanup

### Automatic Cleanup Triggers
```javascript
// Frontend (TwelveDataChart.jsx)
if (chartDataCache.size > 100) {
  // Remove oldest entry (FIFO)
}

// Backend Proxy (server.js)
if (geckoCache.size > 200) {
  // Remove oldest entry (FIFO)
}

// Service (geckoTerminalService.js)
if (this.cache.size > 500) {
  // Remove oldest entry (FIFO)
}
```

### Manual Cleanup (if needed)
```javascript
// Clear frontend cache
chartDataCache.clear();
pendingFetches.clear();

// Clear backend cache (requires restart or cache clear endpoint)
geckoCache.clear();

// Clear service cache (requires restart)
geckoTerminalService.cache.clear();
```

## Debugging Cache Issues

### Check Cache Status

**Frontend Console:**
```javascript
console.log('Frontend cache size:', chartDataCache.size);
console.log('Pending fetches:', pendingFetches.size);
console.log('All cache keys:', Array.from(chartDataCache.keys()));
```

**Backend Logs:**
```bash
# Look for these patterns:
grep "Cache hit" logs.txt
grep "Cache miss" logs.txt
grep "Rate limited" logs.txt
grep "stale cache" logs.txt
```

### Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Too many cache misses** | High API usage | Increase cache duration |
| **Stale data showing** | Old prices displayed | Reduce cache duration or add refresh button |
| **Memory usage high** | Server memory growing | Reduce cache size limits |
| **Rate limits persisting** | Still getting 429s | Increase rate limit delay |

## Performance Metrics

### Target Metrics
```
Frontend cache hit rate:  > 60%
Backend cache hit rate:   > 40%
Service cache hit rate:   > 30%
Overall API reduction:    70-85%
Average load time:        < 200ms
Rate limit errors:        < 5%
```

### How to Measure
```javascript
// Add to code:
const stats = {
  frontendHits: 0,
  frontendMisses: 0,
  backendHits: 0,
  backendMisses: 0,
  apiCalls: 0,
  rateLimits: 0
};

// Track in each layer and log periodically
setInterval(() => {
  console.log('Cache stats:', stats);
}, 60000); // Every minute
```

## Best Practices

### ✅ Do
- Monitor cache hit rates
- Use stale data when rate limited
- Deduplicate concurrent requests
- Clean up old cache entries
- Log cache operations for debugging

### ❌ Don't
- Cache error responses
- Set cache duration too short (< 5 min)
- Store unlimited cache entries
- Ignore rate limit errors
- Cache user-specific data (use user ID in key)

## Future Enhancements

### Potential Improvements
1. **Persistent cache** (Redis/Database)
2. **Cache warming** (Pre-fetch popular coins)
3. **Smart invalidation** (Clear on price change > 10%)
4. **Compression** (Reduce memory usage)
5. **Analytics** (Track cache effectiveness)

---

**Last Updated:** November 19, 2025  
**Version:** 1.0  
**Status:** Production Ready ✅
