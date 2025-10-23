# Price Update Logic - Complete Flow Explanation

## Current Issue
The main price display in CoinCard is not updating visually in real-time, even though backend Jupiter updates are being received.

## Complete Update Chain

### 1. Backend → WebSocket
```javascript
// backend/jupiterLivePriceService.js
// Fetches prices every ~1 second from Jupiter API
// Broadcasts to all WebSocket clients via:
wsServer.broadcast({
  type: 'jupiter-prices-update',
  data: priceUpdates // Array of {address, price, symbol, ...}
});
```

### 2. WebSocket → Frontend Context
```javascript
// frontend/src/hooks/useLiveDataContext.jsx
wsRef.current.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'jupiter-prices-update') {
    updateCoins(prev => {
      const updated = new Map(prev);
      message.data.forEach(priceUpdate => {
        const address = priceUpdate.address;
        updated.set(address, {
          ...existing,
          price: priceUpdate.price,  // ← New price here
          jupiterLive: true
        });
      });
      return updated; // ← NEW Map reference triggers re-renders
    });
  }
};
```

### 3. Context → CoinCard Component
```javascript
// frontend/src/components/CoinCard.jsx

// Get coins Map from context
const { coins } = useLiveData();

// Compute liveData from coins Map
const liveData = useMemo(() => {
  return coins?.get(address) || null;
}, [coins, address]); // ← Re-computes when coins Map changes

// Compute displayPrice from liveData
const displayPrice = useMemo(() => {
  if (liveData?.price) {
    return liveData.price; // ← Use live price
  }
  return coin.price_usd || 0; // ← Fallback to prop
}, [liveData?.price, coin.price_usd]);

// Use displayPrice in render
const price = displayPrice;

// In JSX:
{formatPrice(price)} // ← Displays the price
```

## Why It Might Not Be Working

### Possible Issue #1: Map Reference Not Changing
**Symptom:** WebSocket receives updates but coins Map doesn't trigger re-renders

**Check:**
```javascript
// In useLiveDataContext.jsx, verify this creates NEW Map:
setCoins(new Map(coinsState)); // ← Must be new Map(...)
// NOT just: setCoins(coinsState) // ← This wouldn't trigger re-render
```

**Current Code:**
```javascript
const updateCoins = useCallback((updater) => {
  coinsState = typeof updater === 'function' ? updater(coinsState) : updater;
  setCoins(new Map(coinsState)); // ✅ Creates new reference
}, []);
```

### Possible Issue #2: CoinCard Not Visible
**Symptom:** Price updates but only for visible cards

**Check:**
```javascript
// CoinCard.jsx line ~79
const liveData = useMemo(() => {
  if (isMobile || !isVisible || !address) return null; // ← Skips if not visible
  return coins?.get(address) || null;
}, [isMobile, isVisible, address, coins]);
```

**Solution:** Make sure the coin card is actually visible on screen (not scrolled out of view)

### Possible Issue #3: Address Mismatch
**Symptom:** Backend updates one address, frontend looks for different address

**Check:**
```javascript
// Backend uses: coin.mintAddress || coin.address || coin.tokenAddress
// Frontend uses: coin.mintAddress || coin.address

// Make sure they match!
```

**Debug:**
```javascript
// In browser console while looking at a coin:
const coinCards = document.querySelectorAll('.coin-card');
console.log('Coin addresses:', Array.from(coinCards).map(card => 
  card.querySelector('[data-address]')?.dataset.address
));
```

### Possible Issue #4: useMemo Dependencies Wrong
**Symptom:** useMemo not re-computing when it should

**Current Dependencies:**
```javascript
// liveData dependencies
useMemo(() => { ... }, [isMobile, isVisible, address, coins]);
// ✅ Correct - includes coins Map

// displayPrice dependencies  
useMemo(() => { ... }, [liveData?.price, coin.price_usd, ...]);
// ✅ Correct - includes liveData.price
```

## Debugging Steps

### Step 1: Verify WebSocket is Receiving Updates
**In browser console:**
```javascript
// Look for these logs every ~1 second:
💰 [WebSocket] Jupiter price update received: X coins
💰 [WebSocket] Sample price: SYMBOL = $0.XXXXX
💰 [WebSocket] Updated Map for SYMBOL : 0.XXXXX
💰 [WebSocket] Coins Map updated, new size: X
```

**If NOT seeing these:**
- WebSocket is not connected
- Check Network tab for WS connection
- Backend Jupiter service might not be running

### Step 2: Verify Context is Updating
**In browser console:**
```javascript
// With our new debug logs, you should see (1% sample):
🔄 [CoinCard] liveData updated for SYMBOL: {
  address: "7GCihgDB...",
  price: 0.00001234,
  jupiterLive: true,
  coinsMapSize: 50
}
```

**If NOT seeing these:**
- coins Map is not being updated by context
- Check useLiveDataContext.jsx updateCoins function

### Step 3: Verify Price Computation
**In browser console:**
```javascript
// With our new debug logs, you should see (1% sample):
💰 [CoinCard] Price compute for SYMBOL: {
  address: "7GCihgDB",
  livePrice: 0.00001234,
  fallbackPrice: 0.00001200,
  returning: 0.00001234,
  hasLiveData: true,
  coinsMapSize: 50
}
```

**If NOT seeing these:**
- displayPrice useMemo is not re-computing
- Check dependencies are correct

### Step 4: Force Re-render Test
**In browser console:**
```javascript
// Find React root
const root = document.querySelector('#root');

// Try forcing update by changing a state somewhere
// Or check if hovering/scrolling triggers update
```

## Advanced Debugging

### Check Coins Map Contents
```javascript
// In React DevTools:
// 1. Find <LiveDataProvider> component
// 2. Look at coins in hooks
// 3. Expand the Map to see contents
// 4. Find your coin's address
// 5. Check if price value is updating
```

### Monitor Specific Coin
```javascript
// Add this temporarily to CoinCard.jsx after liveData useMemo:
useEffect(() => {
  if (coin.symbol === 'BONK') { // Pick a coin
    console.log('🔍 BONK liveData:', liveData);
    console.log('🔍 BONK displayPrice:', displayPrice);
    console.log('🔍 BONK final price:', price);
  }
}, [liveData, displayPrice, price]);
```

### Check Render Count
```javascript
// Add this to CoinCard to see if component is re-rendering:
const renderCount = useRef(0);
useEffect(() => {
  renderCount.current++;
  console.log(`🔄 CoinCard ${coin.symbol} rendered ${renderCount.current} times`);
});
```

## Expected Behavior

### When Working Correctly:

1. **Backend logs** (every ~1 second):
   ```
   🔥 [Jupiter Live] Broadcasting prices for 50 coins
   ```

2. **Frontend WebSocket logs** (every ~1 second):
   ```
   💰 [WebSocket] Jupiter price update received: 50 coins
   💰 [WebSocket] Coins Map updated, new size: 50
   ```

3. **CoinCard logs** (1% sample, so occasional):
   ```
   🔄 [CoinCard] liveData updated for WIF: { price: 0.00245 }
   💰 [CoinCard] Price compute for WIF: { returning: 0.00245 }
   ```

4. **Visual changes**:
   - Price display updates smoothly every ~1 second
   - Price flash animation shows green/red on changes
   - Jupiter indicator (🪐) appears on cards with live pricing

### When NOT Working:

1. **No WebSocket logs** → WebSocket not connected
2. **WebSocket logs but no CoinCard logs** → Map not updating or useMemo not reactive
3. **CoinCard logs but no visual change** → Rendering issue or CSS hiding changes

## Quick Fixes

### Fix #1: Hard Refresh
```bash
# Mac: Cmd + Shift + R
# Windows: Ctrl + Shift + R
```

### Fix #2: Restart Everything
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

### Fix #3: Clear React DevTools
```
Open React DevTools → Settings → Clear all data
```

### Fix #4: Check Mobile Mode
```
If in mobile view or device emulation, WebSocket is DISABLED
Check: isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
```

## Current Debug Logs Added

I've added two debug logs to help diagnose:

1. **liveData update log** (CoinCard.jsx ~line 80):
   - Shows when liveData is recomputed from coins Map
   - 1% sample rate to avoid spam

2. **displayPrice compute log** (CoinCard.jsx ~line 93):
   - Shows when displayPrice is recalculated
   - Shows which price it's using (live vs fallback)
   - 1% sample rate to avoid spam

These will help you see if the reactivity chain is working!

## Test Right Now

1. Open http://localhost:5173
2. Open DevTools Console (F12)
3. Watch for logs (you'll see them occasionally due to 1% sample rate)
4. Watch a coin's price display
5. It should update every ~1 second without page refresh

If you see the logs but price doesn't update visually, there's a rendering issue.
If you don't see the logs, there's a reactivity issue earlier in the chain.
