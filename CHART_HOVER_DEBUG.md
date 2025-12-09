# Chart Hover Debugging - December 6, 2025

## Changes Made

### 1. Fixed Stale Closure in Crosshair Handler
**File:** `TwelveDataChart.jsx`
- Changed from using closure variable `lineSeries` to `lineSeriesRef.current`
- Prevents stale reference issues

### 2. Enhanced Crosshair Configuration
**File:** `TwelveDataChart.jsx` (lines ~1018-1035)
- Explicitly set `crosshair.mode: 1` (Normal/Magnet mode)
- Enabled `vertLine.visible: true` and `horzLine.visible: true`
- Ensured `labelVisible: true` for both axes
- Set visible green crosshair color

### 3. Added Comprehensive Logging
**File:** `TwelveDataChart.jsx` (crosshair handler)
- Logs every crosshair movement
- Logs when price data is found
- Logs when callback is sent to parent
- Shows symbol in all logs for easy tracking

### 4. Added Mouse Event Diagnostic
**File:** `TwelveDataChart.jsx` (chart initialization)
- Added direct `mousemove` listener on chart container
- Verifies mouse events reach the container
- Helps isolate if issue is with chart library or our code

## How to Test

1. **Start your development server**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Open browser** to http://localhost:5173

3. **Open DevTools Console** (F12)

4. **Expand a coin card**

5. **Move mouse over the chart area**

## Expected Console Output

### When mouse moves over chart:
```
🖱️  [SYMBOL] Mouse move detected on chart container at 450 320
📊 [SYMBOL] 🎯 CROSSHAIR MOVED to point: {x: 450, y: 320}
📊 [SYMBOL] ✅ Sending price to parent: $0.00145623 at time 1733504400
📊 [SYMBOL] Chart crosshair callback: {price: 0.00145623, time: 1733504400}
✅ [SYMBOL] Set hovered price to: $0.00145623
```

### Expected Visual Changes:
1. Green crosshair lines appear on chart
2. Timestamp badge appears: "📊 Dec 6, 3:45 PM"
3. Price updates to historical value
4. Percentage recalculates dynamically

## Troubleshooting

### If you see mouse events but NO crosshair events:
- Chart library issue - crosshair not being triggered
- Check if chart data is loaded
- Verify `chartInitialized` state is true

### If you see crosshair events but NO price data:
- Series data not properly stored
- Check `lineSeriesRef.current` is not null
- Verify historical data was loaded

### If you see price data but UI doesn't update:
- React state not updating
- Check `setChartHoveredPrice` is being called
- Verify `chartHoveredData` state changes

### If you see NOTHING at all:
- Mouse events not reaching container
- Element might be overlapping chart
- Check CSS `pointer-events` settings
- Verify chart is actually rendered

## Files Modified

1. `/frontend/src/components/TwelveDataChart.jsx`
   - Crosshair handler (lines ~1362-1400)
   - Chart initialization (lines ~850)
   - Chart options (lines ~1018-1035)

2. `/frontend/src/components/CoinCard.jsx`
   - Already had correct setup (no changes needed)
   - `handleChartCrosshairMove` callback
   - State management for `chartHoveredData` and `chartHoveredPrice`

## Status

✅ Code changes complete
✅ Logging added for debugging
✅ Crosshair explicitly configured
🧪 Ready for testing

Please test and share console output if it still doesn't work!
