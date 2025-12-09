# Quick Test Guide - Chart Hover Price Fix

## What Was Fixed
The chart hover feature now properly updates the main price display when you hover over different points on the chart.

## How to Test

### 1. Start the App
Make sure both frontend and backend are running:
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

### 2. Test the Hover Feature

1. **Open the app** in your browser
2. **Find any coin** in the feed
3. **Tap/click to expand** the coin card (to show the chart)
4. **Hover over the chart** with your mouse or drag your finger across it
5. **Watch the main price** at the top of the card

### 3. Expected Behavior ✅

**WHEN HOVERING:**
- ✅ Main price display updates to show the price at the crosshair position
- ✅ Price changes smoothly as you move across the chart
- ✅ You can see historical prices at any point on the chart
- ✅ Percentage change reflects difference from first visible price to hovered price

**WHEN NOT HOVERING:**
- ✅ Main price display shows the current live on-chain price
- ✅ Live indicator shows "connected" status
- ✅ Price updates in real-time from blockchain

### 4. Check Browser Console

Open Developer Tools (F12) and look for these logs:

**When hovering:**
```
📊 [TwelveDataChart] Crosshair move event: { hasParam: true, hasTime: true, ... }
📊 [TwelveDataChart] Calling onCrosshairMove with price: $0.00012345
📊 [COIN_SYMBOL] Chart crosshair callback: { price: 0.00012345, time: ... }
✅ [COIN_SYMBOL] Set hovered price to: $0.00012345
```

**When moving away:**
```
📊 [TwelveDataChart] Calling onCrosshairMove(null) to restore live price
🔄 [COIN_SYMBOL] Cleared hovered price, back to live
```

### 5. Debug Tips

If it's not working:

1. **Check console for errors** - Red errors in browser console
2. **Verify chart is loaded** - Green chart should be visible
3. **Check connection status** - Live indicator should be green
4. **Try different coins** - Some coins may have limited chart data
5. **Refresh the page** - Clear any stale state

### 6. Technical Details

**What's different:**
- Callbacks are now wrapped in `useCallback` to prevent stale closures
- Crosshair subscription updates when callback changes
- Proper cleanup prevents memory leaks
- Debug logging helps track event flow

**Files changed:**
- `frontend/src/components/CoinCard.jsx` - Added useCallback wrappers
- `frontend/src/components/TwelveDataChart.jsx` - Separate effect for subscription

## Known Good State

If everything is working correctly:
- Hovering over chart → Price updates instantly
- Moving away → Price returns to live value  
- No console errors
- Smooth, responsive UI

## Troubleshooting

**Price not updating?**
- Check console logs - are crosshair events firing?
- Verify chart has data - is the green line visible?
- Check callback is defined - logs should show "hasCallback: true"

**Console spam?**
- Normal! Debug logs are active to verify the fix
- Can be disabled later by removing console.log statements

**Chart not loading?**
- Wait a few seconds for enrichment to complete
- Check network tab for API errors
- Verify backend is running on port 3001

## Success Criteria ✅

The fix is working if:
1. ✅ Main price updates as you hover
2. ✅ Console logs show callbacks firing  
3. ✅ No JavaScript errors
4. ✅ Price returns to live when not hovering
5. ✅ UI is responsive and smooth

---

Ready to test! The build completed successfully with no errors.
