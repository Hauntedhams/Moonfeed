# 🔍 Live Price Not Updating - Enhanced Diagnostics

## Current Status
The price display is still not updating visually. We've added React state tracking to force re-renders, but **the root issue is that Jupiter price updates are not being received by the frontend**.

## Diagnostic Logs Added

### Backend (jupiterLivePriceService.js)
Added `[Jupiter]` prefix to all logs:
```
💰 [Jupiter] Fetching live prices for X coins... (Y subscribers)
📦 [Jupiter] Processing batch 1/N (X coins)
✅ [Jupiter] Updated X coin prices - broadcasting to Y subscribers
🔍 [Jupiter] Sample update: SYMBOL = $PRICE
📡 [Jupiter] Broadcast complete - sent X updates
📡 [Jupiter] Broadcasted to X/Y clients (Z closed)
⚠️ [Jupiter] No subscribers to broadcast to
```

### Frontend (useLiveDataContext.jsx)
Enhanced WebSocket message logging:
```
💰 [WebSocket] Jupiter price update received: X coins
💰 [WebSocket] Sample price: SYMBOL = $PRICE
💰 [WebSocket] Updated Map for SYMBOL: PRICE
💰 [WebSocket] Coins Map updated, new size: X
```

## What to Check Now

### 1. **Backend Console** (Terminal running `npm run dev` in backend/)

Look for these logs every ~1 second:

✅ **GOOD** - If you see:
```
💰 [Jupiter] Fetching live prices for 25 coins... (1 subscribers)
📦 [Jupiter] Processing batch 1/1 (25 coins)
✅ [Jupiter] Updated 25 coin prices - broadcasting to 1 subscribers
🔍 [Jupiter] Sample update: BET = $0.00012345
📡 [Jupiter] Broadcast complete - sent 25 updates
📡 [Jupiter] Broadcasted to 1/1 clients (0 closed)
```

❌ **BAD** - If you see:
```
⚠️ [Jupiter] No subscribers to broadcast to
```
**Solution**: The WebSocket isn't registering Jupiter subscribers properly.

❌ **BAD** - If you see:
```
⚠️ [Jupiter] No price updates received - possible API issue
```
**Solution**: Jupiter API is failing or rate limiting.

❌ **BAD** - If you see nothing at all:
**Solution**: Jupiter service isn't running or isn't being called.

### 2. **Frontend Console** (Browser DevTools Console)

Look for these logs every ~1 second:

✅ **GOOD** - If you see:
```
💰 [WebSocket] Jupiter price update received: 25 coins
💰 [WebSocket] Sample price: BET = $0.00012345
💰 [WebSocket] Updated Map for BET: 0.00012345
💰 [WebSocket] Coins Map updated, new size: 25
💰 Live price UPDATE for BET: $0.00012345 → displayPrice: $0.00012345 (Jupiter: ✅)
```

❌ **BAD** - If you see only:
```
🟢 WebSocket connected
```
**Solution**: Backend isn't broadcasting, or messages are being filtered.

## Immediate Actions

### Step 1: Check if Jupiter Service is Running

Look at backend startup logs. You should see:
```
🪐 Starting Jupiter Live Price Service...
✅ Jupiter Live Price Service started with 25 coins
```

If missing, the service didn't start.

### Step 2: Check if WebSocket is Connecting Subscribers

When frontend connects, backend should log:
```
🔗 New WebSocket client connected: [CLIENT_ID] from [IP]
🪐 Added client [CLIENT_ID] to Jupiter Live Price Service
```

If you see the first line but NOT the second, the subscriber isn't being added to Jupiter service.

### Step 3: Force a Manual Price Fetch

In backend terminal, check if service is actually fetching:
```bash
# Look for these logs every 1 second:
💰 [Jupiter] Fetching live prices for X coins...
```

If these are missing, the interval timer might not be running.

## Common Issues & Solutions

### Issue 1: "No subscribers to broadcast to"
**Cause**: WebSocket clients aren't being added to Jupiter service
**Solution**: 
```javascript
// In backend/services/websocketServer.js, verify this code exists:
if (global.jupiterLivePriceService) {
  global.jupiterLivePriceService.addSubscriber(ws);
  console.log(`🪐 Added client ${clientId} to Jupiter Live Price Service`);
}
```

### Issue 2: Jupiter API Rate Limiting
**Cause**: Too many requests to Jupiter API
**Solution**: Check for `🚫 Rate limited by Jupiter API` messages. If present, reduce `updateFrequency` in `jupiterLivePriceService.js` from 1000ms to 2000ms or 5000ms.

### Issue 3: Service Not Starting
**Cause**: Service fails to initialize on server startup
**Solution**: Check server.js for:
```javascript
// At bottom of server.js:
console.log('🪐 Starting Jupiter Live Price Service...');
if (currentCoins.length > 0) {
  jupiterLivePriceService.start(currentCoins);
  console.log(`✅ Jupiter Live Price Service started with ${currentCoins.length} coins`);
}
```

### Issue 4: WebSocket Disconnects Immediately
**Cause**: CORS or network issues
**Solution**: Check for `🔌 Client disconnected` messages right after connection. If yes, check CORS settings in backend/server.js.

## Test Commands

### Backend Status Check
In backend directory:
```bash
curl http://localhost:3001/api/status | jq .jupiterLivePrice
```

Should return:
```json
{
  "isRunning": true,
  "coinsTracked": 25,
  "subscribers": 1,
  "updateFrequency": 1000,
  "lastUpdate": [timestamp],
  "lastSuccessfulFetch": [timestamp]
}
```

If `isRunning: false` or `subscribers: 0`, that's the problem.

## Next Steps Based on Logs

### If Backend Shows Broadcasts But Frontend Sees Nothing:
**Issue**: WebSocket message routing problem
**Solution**: Check frontend WebSocket URL is correct (`ws://localhost:3001/ws`)

### If Backend Shows No Subscribers:
**Issue**: WebSocket not registering Jupiter subscribers
**Solution**: Restart backend server and check `websocketServer.js` integration

### If Backend Shows Rate Limiting:
**Issue**: Jupiter API blocking requests
**Solution**: Increase update frequency from 1s to 5s

### If Backend Shows No Fetches:
**Issue**: Service timer not running
**Solution**: Check `start()` was called in server.js

## Files Changed

1. `backend/jupiterLivePriceService.js` - Enhanced logging with [Jupiter] prefix
2. `frontend/src/hooks/useLiveDataContext.jsx` - Enhanced logging with [WebSocket] prefix
3. `frontend/src/components/CoinCard.jsx` - Added displayPrice state to force re-renders

## Expected Flow (When Working)

```
1. Backend Server Starts
   └─> Jupiter Service Starts
       └─> Begins fetching every 1 second

2. Frontend WebSocket Connects
   └─> Backend adds client to Jupiter subscribers
       └─> Client receives initial prices

3. Every 1 Second:
   └─> Backend: Fetch from Jupiter API
       └─> Backend: Update price cache
           └─> Backend: Broadcast to WebSocket clients
               └─> Frontend: Receive price update message
                   └─> Frontend: Update coins Map
                       └─> Frontend: Trigger useEffect
                           └─> Frontend: Update displayPrice state
                               └─> Frontend: React re-renders with new price
```

## Restart Instructions

If all else fails, do a clean restart:

```bash
# Terminal 1 - Backend
cd backend
killall -9 node  # Kill any hanging processes
npm run dev

# Wait for:
# ✅ Jupiter Live Price Service started with X coins

# Terminal 2 - Frontend  
cd frontend
npm run dev

# Wait for:
# 🟢 WebSocket connected
# 💰 [WebSocket] Jupiter price update received: X coins
```

## Status Check

After restart, within 5 seconds you should see:
- ✅ Backend: `📡 [Jupiter] Broadcasted to 1/1 clients`
- ✅ Frontend: `💰 [WebSocket] Jupiter price update received: 25 coins`
- ✅ Frontend: Price numbers changing in the UI

If you don't see these, **share the console output** and we'll diagnose further!
