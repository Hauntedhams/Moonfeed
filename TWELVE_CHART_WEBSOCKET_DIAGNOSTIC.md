# TwelveData Chart - WebSocket Live Price Diagnostic

## Current Status
✅ Historical data from GeckoTerminal working perfectly  
🔍 Live price updates from SolanaStream WebSocket being investigated

## Enhanced Logging Added

The chart now has comprehensive WebSocket logging to diagnose live price issues:

### Connection Logging
```
🔌 Setting up WebSocket for pool: [pool_address]
🔌 SolanaStream WebSocket connected
📤 Sending subscription message: {...}
```

### Message Logging
```
📨 Received WebSocket message: {...}
✅ Subscription confirmed: {...}
💱 Swap notification received: {...}
💰 Extracted price: [price] timestamp: [timestamp]
✅ Chart updated with new price: [price]
```

### Error Logging
```
❌ WebSocket subscription error: {...}
❌ WebSocket connection error: {...}
❌ WebSocket message parsing error: {...}
⚠️ Invalid price data: {...}
🔌 WebSocket disconnected. Code: [code] Reason: [reason]
```

## What to Check in Browser Console

### 1. WebSocket Connection
Look for:
```
🔌 Setting up WebSocket for pool: 8dwaWrZP9qjuUm3J2YmaQo4aXGrxjNt41LcKorotvsgM
🔌 SolanaStream WebSocket connected
📤 Sending subscription message: {jsonrpc: "2.0", id: 1, method: "swapSubscribe", ...}
```

**If you see this:** ✅ Connection is working  
**If you don't:** ❌ WebSocket can't connect (check network/firewall)

### 2. Subscription Response
Look for:
```
📨 Received WebSocket message: {result: true, ...}
✅ Subscription confirmed: {...}
```

**If you see this:** ✅ Subscription successful  
**If you see error:** ❌ Check API key or pool address format

### 3. Swap Notifications
Look for:
```
📨 Received WebSocket message: {swap: {...}}
💱 Swap notification received: {...}
💰 Extracted price: 0.00123456 timestamp: 1700000000
✅ Chart updated with new price: 0.00123456
```

**If you see this:** ✅ Live prices working!  
**If you don't:** The pool might not have active swaps right now

### 4. Unhandled Messages
Look for:
```
ℹ️ Unhandled message type: {...}
```

This tells us if SolanaStream is sending messages in an unexpected format.

## Possible Issues & Solutions

### Issue 1: No Swap Notifications
**Symptom:** Connected, subscribed, but no swap messages  
**Possible Causes:**
- The coin/pool isn't actively trading right now
- Very low volume = very few swaps
- Wrong pool address format

**Solution:** 
- Test with a high-volume coin (e.g., popular meme coin)
- Wait 30-60 seconds for a swap to occur
- Check that `pairAddress` matches the pool address exactly

### Issue 2: WebSocket Disconnects
**Symptom:** `🔌 WebSocket disconnected` appears  
**Possible Causes:**
- SolanaStream API issues
- Network connectivity
- Rate limiting
- Invalid API key

**Solution:**
- Check disconnect code/reason in console
- Code 1000 = normal close
- Code 1006 = abnormal close (connection lost)
- Code 1008 = policy violation (bad API key)

### Issue 3: Invalid Price Data
**Symptom:** `⚠️ Invalid price data` warnings  
**Possible Causes:**
- Price field is missing or null
- Wrong field name (quotePrice vs price vs priceUsd)
- Price is 0 or NaN

**Solution:**
- Check the swap notification structure
- We now handle multiple field names automatically

### Issue 4: Wrong Message Format
**Symptom:** All messages show as `ℹ️ Unhandled message type`  
**Possible Causes:**
- SolanaStream API changed format
- Using wrong endpoint/version

**Solution:**
- Post the unhandled message structure in chat
- We'll update the parser to handle it

## Code Changes Made

### Enhanced Message Parsing
Now handles TWO message formats:

**Format 1 (Direct swap object):**
```json
{
  "swap": {
    "ammAccount": "...",
    "quotePrice": "0.00001234",
    "blockTime": 1700000000
  }
}
```

**Format 2 (Method-based notification):**
```json
{
  "method": "swapNotification",
  "params": {
    "ammAccount": "...",
    "quotePrice": "0.00001234",
    "blockTime": 1700000000
  }
}
```

### Price Field Fallbacks
Tries multiple field names:
- `quotePrice` (most common)
- `price`
- `priceUsd`
- `priceNative`

### Timestamp Fallbacks
Tries multiple sources:
- `blockTime` (blockchain timestamp)
- `timestamp` (server timestamp)
- `Date.now()` (client timestamp as last resort)

## Testing Instructions

1. **Open the app** with Developer Console open
2. **Navigate to a coin** with the "twelve" chart tab
3. **Watch the console** for WebSocket messages
4. **Look for the patterns** described above
5. **Wait 30-60 seconds** for swap activity
6. **Switch to a high-volume coin** if no swaps appear

## Expected Console Output (Success)

```
📊 Initializing chart for: 8dwaWrZP9qjuUm3J2YmaQo4aXGrxjNt41LcKorotvsgM
✅ Chart created, fetching historical data...
✅ Chart initialized with 100 data points
🔌 Setting up WebSocket for pool: 8dwaWrZP9qjuUm3J2YmaQo4aXGrxjNt41LcKorotvsgM
🔌 SolanaStream WebSocket connected
📤 Sending subscription message: {jsonrpc: "2.0", id: 1, method: "swapSubscribe", ...}
📨 Received WebSocket message: {result: true}
✅ Subscription confirmed: {result: true}
... [wait for swap] ...
📨 Received WebSocket message: {swap: {...}}
💱 Swap notification received: {ammAccount: "...", quotePrice: "0.00123", ...}
💰 Extracted price: 0.00123 timestamp: 1700000000
✅ Chart updated with new price: 0.00123
```

## What to Report Back

Please share:
1. ✅ Or ❌ for "WebSocket connected"
2. ✅ Or ❌ for "Subscription confirmed"
3. ✅ Or ❌ for "Swap notifications received"
4. Any error messages
5. Any unhandled message types with their structure

This will help us pinpoint exactly where the issue is!

## Alternative: Fallback to GeckoTerminal Polling

If SolanaStream isn't working, we can implement a fallback:
- Poll GeckoTerminal API every 10-30 seconds
- Update chart with latest close price
- Less real-time but still reasonably current

Let me know what the console shows and we'll fix it! 🚀
