# 🔧 Twelve Data WebSocket Debugging Guide

## Current Issue

**Problem**: WebSocket is not connecting, chart not loading
- REST API calls working (6/8 credits used)
- WebSocket credits still at 0 (means no WS connection made)
- No console logs showing WebSocket activity

## Debug Steps Added

### 1. Enhanced Console Logging

Added detailed logs throughout the component:
- `📊 Twelve: Effect triggered` - When component mounts/updates
- `📊 Twelve: Initializing for symbol: X` - Which symbol is being loaded
- `📊 Twelve: Fetching historical data` - REST API call starting
- `📊 Twelve: Received data` - REST API response received
- `📊 Twelve: Processed X data points` - Historical data processed
- `📊 Twelve: Drawing initial chart` - Canvas rendering
- `📊 Twelve: Attempting to connect WebSocket` - WS connection starting
- `📊 Twelve: Received message` - WS messages received
- `📊 Twelve: Price update: $X` - Live price updates

### 2. Added Loading Indicator

The canvas now shows "Loading chart data..." overlay while fetching.

### 3. Component Status Tracking

Monitor these in console:
```javascript
// What you should see:
📊 Twelve: Effect triggered - isActive: true
📊 Twelve: Initializing for symbol: SOL/USD
📊 Twelve: Starting initialization...
📊 Twelve: Fetching historical data for SOL/USD
📊 Twelve: Requesting https://api.twelvedata.com/time_series?...
📊 Twelve: Received data: {...}
📊 Twelve: Processed 390 data points
📊 Twelve: Drawing initial chart with 390 points
📊 Twelve: Connecting WebSocket...
📊 Twelve: Attempting to connect WebSocket for SOL/USD
🔌 Creating new Twelve Data WebSocket connection for SOL/USD
✅ Connected to Twelve Data for SOL/USD
📊 Twelve: WebSocket connection initiated
```

## What To Check Next

### Test Now:
1. **Reload the page** and click "Twelve" tab
2. **Open browser console** (F12)
3. **Look for the logs** with `📊 Twelve:` prefix
4. **Share the console output** - we need to see where it stops

### Possible Issues:

#### A. Effect Not Running
If you don't see: `📊 Twelve: Effect triggered - isActive: true`
- The `isActive` prop might not be true
- Component might not be rendering at all

#### B. Historical Data Failing
If logs stop at `📊 Twelve: Fetching historical data`
- REST API might be rate-limited
- Check Network tab for 429 status
- Check if outputsize=390 is too large (try 100)

#### C. WebSocket Not Connecting
If logs show historical data but no WebSocket:
- Browser might be blocking WS connections
- CORS policy issue
- Twelve Data might not support WebSocket on free plan

#### D. Canvas Not Rendering
If no visual chart appears:
- Canvas might be hidden behind another element
- Z-index issue
- Canvas ref not attached properly

## Quick Diagnostic Commands

### In Browser Console:

```javascript
// Check if component exists
document.querySelector('.twelve-data-chart')

// Check canvas
document.querySelector('.twelve-chart-canvas')

// Check WebSocket manager status
window.__TWELVE_WS_MANAGER__.getStatus()

// Check if isActive prop is true
// (look for the component in React DevTools)
```

## Potential Fixes

### Fix 1: If Historical Data Works But No Chart
The canvas needs to be visible and have proper dimensions:
```css
.twelve-chart-canvas {
  width: 100% !important;
  height: 250px !important;
  display: block !important;
  border: 1px solid red; /* Debug border */
}
```

### Fix 2: If WebSocket Won't Connect
Twelve Data might require different WS URL format:
```javascript
// Try alternative formats:
wss://ws.twelvedata.com/v1/quotes/price?apikey=YOUR_KEY
wss://stream.twelvedata.com/v1/prices/streaming
```

### Fix 3: If Free Plan Doesn't Support WebSocket
Use polling instead:
```javascript
// Fallback to REST API polling every 10 seconds
setInterval(async () => {
  const data = await fetch(`https://api.twelvedata.com/price?symbol=SOL/USD&apikey=...`);
  // Update chart
}, 10000);
```

## Expected vs Actual

### Expected Flow:
1. User clicks "Twelve" tab
2. Component mounts with `isActive=true`
3. Historical data fetches (6 API calls used ✅)
4. Canvas draws chart
5. WebSocket connects
6. Live updates start flowing

### Actual Flow (Current):
1. User clicks "Twelve" tab ✅
2. Component mounts ✅
3. Historical data fetches (6 API calls used) ✅
4. Canvas draws chart ❓ (not visible)
5. WebSocket connects ❌ (0 WS credits = no connection)
6. Live updates ❌

## Next Actions

1. **Test with new logging** - See where it stops
2. **Check Twelve Data docs** - Verify WS is available on free plan
3. **Try alternative approach** - Polling if WS unavailable
4. **Simplify** - Test with just historical chart first

## Alternative: Polling Fallback

If WebSocket doesn't work on free plan, we can do this:

```javascript
// Instead of WebSocket, poll every 15 seconds
useEffect(() => {
  if (!isActive) return;
  
  const interval = setInterval(async () => {
    const response = await fetch(
      `https://api.twelvedata.com/price?symbol=SOL/USD&apikey=${TWELVE_API_KEY}`
    );
    const data = await response.json();
    
    if (data.price) {
      // Update chart with new price
      updateChart(parseFloat(data.price));
    }
  }, 15000); // Every 15 seconds
  
  return () => clearInterval(interval);
}, [isActive]);
```

This would:
- ✅ Still show live(ish) data
- ✅ Work on free plan
- ✅ Use fewer API calls than REST requests
- ⚠️ Updates every 15s instead of real-time

---

## Test Instructions

1. Reload page
2. Click "Twelve" tab
3. Open console (F12)
4. Copy ALL console logs with `📊 Twelve:` prefix
5. Share here

This will tell us exactly where it's failing!
