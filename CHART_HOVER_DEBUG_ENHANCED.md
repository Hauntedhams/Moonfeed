# Chart Hover Feature - Enhanced Debug Session

## 🎯 Issue
User reports that hovering over the chart does not show the historical price and timestamp overlay (crosshair data).

## ✅ What We've Confirmed
1. **Crosshair subscription code EXISTS** ✅
2. **Callback plumbing is CORRECT** ✅  
3. **UI rendering logic is IN PLACE** ✅
4. **Event handler uses correct refs** ✅

## 🔍 What We Added (Debug Session)

### 1. **isActive Prop Detection**
Added immediate chart loading when `isActive={true}` (card is expanded):
```javascript
// TwelveDataChart.jsx - Line ~115
if (isActive) {
  console.log('📱 Card is expanded - loading chart immediately:', coin?.symbol);
  setIsInView(true);
  setShouldLoad(true);
  return;
}
```

### 2. **Enhanced Crosshair Logging**
Added comprehensive logging to track every crosshair event:

**In TwelveDataChart.jsx:**
```javascript
const handler = (param) => {
  console.log(`📊 [${coin?.symbol}] 🖱️  CROSSHAIR EVENT RECEIVED:`, {
    hasParam: !!param,
    hasPoint: !!param?.point,
    hasTime: !!param?.time,
    hasSeriesData: !!param?.seriesData,
    seriesDataSize: param?.seriesData?.size
  });
  // ... rest of handler
};
```

**In CoinCard.jsx:**
```javascript
const handleChartCrosshairMove = React.useCallback((data) => {
  console.log(`📊📊📊 [CoinCard - ${coin.symbol}] ✨✨✨ RECEIVED CROSSHAIR CALLBACK:`, {
    hasData: !!data,
    hasPrice: !!data?.price,
    hasTime: !!data?.time,
    price: data?.price,
    timestamp: data?.time ? new Date(data.time * 1000).toLocaleString() : null
  });
  // ... rest of callback
}, [coin.symbol]);
```

### 3. **Dependency Array Fix**
Added `isActive` to the lazy-loading useEffect dependencies:
```javascript
}, [coin?.symbol, shouldLoad, isDesktopMode, isActive]);
```

## 📋 Testing Instructions

### Step 1: Open DevTools Console
1. Open Chrome DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Clear the console (Cmd+K or Ctrl+L)

### Step 2: Expand a Coin Card
1. Scroll to a coin in the feed
2. Click to expand the card
3. **Watch console logs** - you should see:
   ```
   📱 Card is expanded - loading chart immediately: <SYMBOL>
   📐 Container current dimensions: { clientWidth: X, clientHeight: Y, ... }
   ```

### Step 3: Wait for Chart to Load
Wait for:
```
✅ Chart initialized with N data points
✅✅✅ CROSSHAIR SUBSCRIPTION IS NOW ACTIVE for <SYMBOL>
```

### Step 4: Hover Over Chart
1. Move your mouse over the chart area
2. **Watch for these logs:**

   **If working correctly:**
   ```
   📊 [SYMBOL] 🖱️  CROSSHAIR EVENT RECEIVED: { hasParam: true, hasPoint: true, ... }
   📊 [SYMBOL] 🔍 Price data from series: { hasPriceData: true, hasValue: true, value: 0.00001234 }
   📊 [SYMBOL] ✅✅✅ SENDING PRICE TO PARENT: $0.00001234 at time 1733512800
   📊📊📊 [CoinCard - SYMBOL] ✨✨✨ RECEIVED CROSSHAIR CALLBACK: { hasData: true, hasPrice: true, ... }
   ✅✅✅ [SYMBOL] SUCCESS - Set hovered price to: $0.00001234
   ```

   **If NOT working (no crosshair events):**
   - No logs appear when hovering
   - This means chart is not capturing mouse events
   - Check: Chart dimensions, z-index, pointer-events CSS

### Step 5: Check UI Update
Look at the **price section** in the expanded card header:
- Should show: `📊 Dec 6, 2:30 PM` (historical timestamp) when hovering
- Should show: `🟢 LIVE` indicator when NOT hovering

## 🐛 Debugging Scenarios

### Scenario A: No Chart Loads
**Symptoms:** No chart visible, container shows placeholder or error

**Check logs for:**
```
❌ Chart container has no dimensions after retries
```

**Solution:** Container sizing issue - check parent CSS

---

### Scenario B: Chart Loads But No Crosshair Events
**Symptoms:** Chart is visible and animating, but hovering does nothing

**Check logs for:**
```
✅✅✅ CROSSHAIR SUBSCRIPTION IS NOW ACTIVE for <SYMBOL>
```

**If subscription confirmed but no events when hovering:**
- Check: `pointer-events: auto` on chart container
- Check: No overlay div covering the chart
- Check: Chart canvas is actually rendered (inspect DOM)

**Solution:** Run this in console:
```javascript
document.querySelector('.chart-container').style.pointerEvents = 'auto';
```

---

### Scenario C: Events Fire But No UI Update
**Symptoms:** Console shows crosshair events and callback, but price doesn't update in UI

**Check logs for:**
```
📊📊📊 [CoinCard - SYMBOL] ✨✨✨ RECEIVED CROSSHAIR CALLBACK
✅✅✅ [SYMBOL] SUCCESS - Set hovered price to: $X.XXXXXXXX
```

**If these appear but UI doesn't update:**
- React state update issue
- Check: Component is not unmounting/remounting
- Check: `chartHoveredData` state is being read in render

**Solution:** Check React DevTools - search for `chartHoveredData` in component state

---

### Scenario D: Container is 0x0
**Symptoms:** Logs show `Container dimensions: 0x0`

**This is the ROOT CAUSE from previous sessions**

**Check:**
1. Is card actually expanded? (`isExpanded` prop)
2. Is chart section visible in DOM inspector?
3. Parent element has height?

**Solution:** Add explicit height to chart container in CSS:
```css
.twelve-chart-section {
  min-height: 320px;
  height: 320px;
}
```

## 🎯 Expected Console Flow (Success Case)

```
1. 📱 Card is expanded - loading chart immediately: SYMBOL
2. 📐 Container current dimensions: { clientWidth: 500, clientHeight: 320 }
3. ✅ Container ready with dimensions: 500x320
4. 📊 Initializing chart for: <pairAddress>
5. ✅ Chart created - Canvas elements found: 2
6. ✅ Chart initialized with 288 data points
7. ✅✅✅ CROSSHAIR SUBSCRIPTION IS NOW ACTIVE for SYMBOL
8. [USER HOVERS OVER CHART]
9. 📊 [SYMBOL] 🖱️  CROSSHAIR EVENT RECEIVED: { ... }
10. 📊 [SYMBOL] ✅✅✅ SENDING PRICE TO PARENT: $0.00001234 ...
11. 📊📊📊 [CoinCard - SYMBOL] ✨✨✨ RECEIVED CROSSHAIR CALLBACK: { ... }
12. ✅✅✅ [SYMBOL] SUCCESS - Set hovered price to: $0.00001234
13. [UI UPDATES TO SHOW HISTORICAL TIMESTAMP]
```

## 📝 Next Steps Based on Logs

### If you see logs 1-7 but NOT 9-12:
→ **Mouse events are not reaching the chart**
→ Check: pointer-events, overlays, z-index

### If you see logs 1-10 but NOT 11-12:
→ **Callback is not being invoked**
→ Check: `onCrosshairMove` prop is passed correctly

### If you see logs 1-12 but UI doesn't update:
→ **React state update issue**
→ Check: React DevTools for `chartHoveredData` state

### If you see logs 1-3 then error at step 4:
→ **Chart container sizing issue (ROOT CAUSE)**
→ Fix: Ensure parent has height and card is expanded

## 🚀 Quick Test Command

Run this in console to verify chart exists and has crosshair subscription:
```javascript
// Check if chart container exists
const container = document.querySelector('.chart-container');
console.log('Container exists:', !!container);
console.log('Container dimensions:', container?.clientWidth, 'x', container?.clientHeight);
console.log('Computed style:', window.getComputedStyle(container));
```

## 🎨 UI Elements to Verify

When hovering over chart, this should appear in the expanded card header:
```html
<div class="chart-hover-indicator" title="Showing historical price from chart">
  📊 Dec 6, 2:30 PM
</div>
```

Location: In `.live-indicators` div, replaces the LIVE indicator temporarily

---

**Last Updated:** December 6, 2025  
**Status:** Debug logging enhanced, waiting for user testing results
