# 🧪 Twelve Chart - Testing Guide

## Quick Test Steps

### 1. Start the App
```bash
cd frontend
npm run dev
```

### 2. Navigate to Chart
1. Open app in browser (usually `http://localhost:5173`)
2. Scroll through the feed
3. Click on any coin card
4. Click the **"Twelve"** tab

### 3. What to Look For

#### ✅ Initial Load (0-2 seconds)
- Status badge shows **"LOADING..."** (yellow)
- Loading overlay appears
- Message: "Loading chart data..."

#### ✅ Chart Appears (2-3 seconds)
- Status badge changes to **"● LIVE"** (green)
- Historical price line displays (~8 hours of data)
- Current price shows in header
- Percentage change displays (green if positive, red if negative)

#### ✅ Real-Time Updates (ongoing)
Watch the **console** for swap notifications:
```
🔌 Connecting to SolanaStream WebSocket...
✅ WebSocket connected
📡 Subscribed to swaps for pool: <address>
✅ Subscription confirmed: 1
💰 New swap: buy - Price: 0.00001234 USD - Value: $125.50
```

When a swap occurs:
- Price in header updates
- Line on chart extends with new data point
- Percentage change recalculates

### 4. Test Interactions

#### Zoom
- **Mouse:** Scroll wheel up/down
- **Trackpad:** Pinch gesture
- **Expected:** Chart zooms in/out

#### Pan
- **Mouse:** Click and drag left/right
- **Trackpad:** Click and drag
- **Expected:** Chart scrolls horizontally

#### Crosshair
- **Mouse:** Hover over chart
- **Expected:** Crosshair appears, shows exact price/time

#### Window Resize
- Resize browser window
- **Expected:** Chart resizes smoothly

### 5. Test Different Coins

Try these coin types:
- ✅ **Pump.fun tokens** - Should work (uses pairAddress)
- ✅ **Raydium pairs** - Should work (uses pairAddress)
- ✅ **Standard DEX pairs** - Should work (uses pairAddress)

### 6. Test Error Handling

#### No Historical Data
- **Scenario:** Pool has no GeckoTerminal data
- **Expected:** Error message appears
- **Message:** "Failed to load chart data: GeckoTerminal API error: 404"

#### WebSocket Disconnect
- **Scenario:** Disable network briefly
- **Expected:** 
  - Connection drops
  - Console shows: "🔌 WebSocket disconnected"
  - After 5 seconds: "🔄 Reconnecting in 5 seconds..."
  - Reconnects automatically

#### Invalid Pool Address
- **Scenario:** Coin has no pairAddress field
- **Expected:** Error message: "Pool address not found"

## 🔍 Console Monitoring

### Successful Flow
```
📊 Fetching historical data from GeckoTerminal: <pool_address>
✅ Loaded 100 historical data points
✅ Chart initialized successfully
🔌 Connecting to SolanaStream WebSocket...
✅ WebSocket connected
📡 Subscribed to swaps for pool: <pool_address>
✅ Subscription confirmed: 1
```

### When Swap Occurs
```
💰 New swap: buy - Price: 0.00001234 USD - Value: $125.50
```

### Errors to Watch
```
❌ No pool address available
❌ Error fetching historical data: <error>
❌ WebSocket error: <error>
⚠️  Invalid price in swap notification: <price>
```

## 📊 Expected Behavior

### Initial State
- Status: "LOADING..." (yellow badge)
- Chart: Loading overlay visible
- Price: Not shown yet

### Loaded State
- Status: "● LIVE" (green badge with pulsing dot)
- Chart: Line chart visible with ~8 hours of history
- Price: Current price + percentage change
- Color: Green line if price up, red if price down

### Active State (Real-Time)
- WebSocket connected
- Swaps appear in console
- Chart updates smoothly
- Price/percentage update instantly

### Error State
- Status: "ERROR" (red badge)
- Chart: Error message displayed
- Details: Specific error message shown

## 🐛 Troubleshooting

### Chart Doesn't Load
**Check:**
1. Is pool address available? (Check console for "No pool address")
2. Does GeckoTerminal have data for this pool?
3. Is network connection working?

**Fix:**
- Try a different coin
- Check browser console for specific error
- Verify GeckoTerminal API is accessible

### No Real-Time Updates
**Check:**
1. Is WebSocket connected? (Look for "✅ WebSocket connected")
2. Is subscription confirmed? (Look for "✅ Subscription confirmed")
3. Are swaps happening? (Low-volume coins may have infrequent swaps)

**Fix:**
- Wait longer (low volume = rare swaps)
- Try a high-volume coin (e.g., popular meme coins)
- Check console for WebSocket errors

### Chart is Blank/Black
**Check:**
1. Is historical data array empty? (Check console)
2. Are there errors in console?

**Fix:**
- Select a coin with active trading
- Refresh the page
- Clear browser cache

### WebSocket Keeps Disconnecting
**Check:**
1. Network stability
2. SolanaStream service status

**Fix:**
- Auto-reconnect should handle this
- If persists, contact SolanaStream support

## ✅ Success Criteria

The chart is working correctly if:
- ✅ Historical data loads in under 3 seconds
- ✅ Line chart displays clearly
- ✅ Current price shows in header
- ✅ Status badge shows "● LIVE"
- ✅ WebSocket connects successfully
- ✅ Console shows swap notifications
- ✅ Chart updates when swaps occur
- ✅ Zoom/pan/crosshair work
- ✅ Window resize works smoothly
- ✅ Mobile responsive

## 📱 Mobile Testing

### iOS Safari
- Open in iOS Safari
- Tap a coin → Twelve tab
- Try pinch-to-zoom
- Try pan (swipe left/right)

### Android Chrome
- Open in Android Chrome
- Same tests as iOS

### Expected
- Chart renders at 280px minimum height
- Touch gestures work smoothly
- Price displays clearly
- No horizontal scroll issues

## 🎯 Performance Targets

- **Initial Load:** < 2 seconds
- **Chart Render:** < 100ms
- **WebSocket Connect:** < 1 second
- **Real-Time Update:** < 100ms after swap
- **Window Resize:** < 50ms to reflow

## 📸 Visual Checklist

### Header
- [ ] Current price is large and prominent
- [ ] Percentage change has colored background
- [ ] Status badge is visible and correct color
- [ ] Layout doesn't overflow or wrap awkwardly

### Chart
- [ ] Line is smooth and clear
- [ ] Grid lines are subtle
- [ ] Axis labels are readable
- [ ] No visual glitches or artifacts

### Colors
- [ ] Green for positive trend (#00ff41)
- [ ] Red for negative trend (#ff3b3b)
- [ ] Black background (#000000)
- [ ] Subtle white grid lines

---

## 🎉 Ready to Test!

The Twelve Chart should now display a clean, professional line chart with:
1. 8 hours of historical price data
2. Real-time updates via WebSocket
3. Interactive zoom/pan controls
4. Live price and percentage change

**Happy Testing!** 🚀
