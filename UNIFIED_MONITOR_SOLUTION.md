# Unified Solana Token Monitor - Architecture

## Overview
The new `SolanaTokenMonitor` provides a **smart fallback system** for monitoring Solana token prices:

1. **First**: Check if token is on Pump.fun
2. **If yes**: Use Pump.fun monitoring (RPC logs + API polling)
3. **If no**: Use Birdeye WebSocket for graduated/DEX tokens

## Why This Approach?

Many tokens **start on Pump.fun** but then **graduate to Raydium** or other DEXes once they reach certain metrics. When a token graduates:
- Pump.fun API returns 404
- But the token is still valid and tradeable on Raydium/Jupiter/etc.
- Birdeye tracks all Solana DEX activity

## Flow Diagram

```
Frontend requests price for token
         |
         v
Is it on Pump.fun?
    |          |
   YES        NO
    |          |
    v          v
Pump.fun    Birdeye
Monitor     Monitor
    |          |
    v          v
Real-time price updates
```

## Pump.fun Monitoring
- **RPC Logs**: Subscribes to `logsSubscribe` for the Pump.fun program
- **Polling**: Fetches price every 3 seconds as backup
- **Speed**: Sub-second updates on every swap
- **Best for**: Active Pump.fun tokens

## Birdeye Monitoring
- **WebSocket**: Connects directly to Birdeye's real-time price feed
- **Coverage**: All Solana DEXes (Raydium, Orca, etc.)
- **Speed**: ~1-2 second updates
- **Best for**: Graduated tokens, established DEX tokens

## Error Handling

### Pump.fun 404
```
Token not found on Pump.fun (404)
→ Automatically falls back to Birdeye
→ No error shown to user
```

### Birdeye Connection Error
```
Birdeye connection failed
→ Error sent to frontend
→ Automatic reconnection after 5 seconds
```

### Neither Works
```
Both Pump.fun and Birdeye fail
→ Error displayed to user
→ "Unable to fetch price data"
```

## Files Modified

1. **`solanaTokenMonitor.js`** (NEW)
   - Unified monitoring logic
   - Auto-detection of token source
   - Handles subscriptions for both Pump.fun and Birdeye

2. **`priceWebSocketServer.js`** (UPDATED)
   - Now uses `SolanaTokenMonitor` instead of `PumpfunMonitor`
   - No changes to API - frontend stays the same

## Frontend Impact

**Zero changes needed!** The frontend continues to:
- Connect to `/ws/price`
- Send `{ type: 'subscribe', token: '<address>' }`
- Receive `{ type: 'price_update', data: {...} }`

The backend now automatically determines the best monitoring method.

## Benefits

✅ **No 404 errors** for graduated tokens
✅ **Automatic fallback** to best data source
✅ **No frontend changes** required
✅ **Better coverage** - all Solana tokens supported
✅ **Maintains speed** for Pump.fun tokens

## Testing

To test a token:
1. Open frontend chart
2. Enter token address
3. Backend will log which monitor it's using:
   - `🎯 [Monitor] Using Pump.fun monitoring...` (active Pump.fun token)
   - `🐦 [Monitor] Using Birdeye monitoring...` (graduated/DEX token)

## Example Tokens

**Pump.fun token** (active):
```
Address: <new pump.fun token>
Expected: Pump.fun monitor with sub-second updates
```

**Graduated token** (was Pump.fun, now Raydium):
```
Address: G6z381aCFjKMzt6SbNXMVFZrzK1cjCuQnQBVEZH23nQ3
Expected: Birdeye monitor with 1-2s updates
```

## Next Steps

1. ✅ Created unified monitor
2. ✅ Updated WebSocket server
3. ⏳ Test with both token types
4. ⏳ Monitor logs for any edge cases
5. ⏳ Add other chains (if needed)

## Troubleshooting

### "Not a Pump.fun token" error gone
If you were seeing this before, it means:
- Token graduated from Pump.fun
- Now using Birdeye automatically
- Should see prices flowing in

### Backend logs to watch
```bash
# Pump.fun token detected
🎯 [Monitor] Using Pump.fun monitoring...
🔥 [Monitor] SWAP DETECTED...
💰 [Monitor] New price: $0.00000123

# Graduated token detected  
🐦 [Monitor] Using Birdeye monitoring...
✅ [Monitor] Connected to Birdeye...
💰 [Monitor] Birdeye price: $0.00000456
```

### Still seeing errors?
1. Check if token address is valid Solana address
2. Check if token has any trading activity (zero volume = no updates)
3. Check backend logs for connection errors
4. Verify Birdeye API key is valid
