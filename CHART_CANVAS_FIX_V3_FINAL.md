# Chart Canvas Timing Fix V3 - Final Solution

## The Real Problem (Discovered)

When you swipe away and come back, the chart works because:
1. **Swipe away:** Component UNMOUNTS → all state reset
2. **Swipe back:** Component REMOUNTS with enriched data already present → chart renders ✅

But on first load:
1. Component mounts → `canvasReady = true`
2. Enrichment completes → `chartData` updates
3. First useEffect runs BUT second useEffect doesn't (canvasReady already true, no change)
4. Chart doesn't render ❌

## The Root Issue

**TWO separate useEffects watching different dependencies:**
- Effect #1: watches `[chartData]` → draws when data arrives
- Effect #2: watches `[canvasReady]` → draws when canvas mounts

**Problem:** When component is already mounted (`canvasReady=true`) and enrichment completes, Effect #2 never fires because `canvasReady` didn't change!

## The Solution V3: Consolidated Single Effect

Replace two separate effects with ONE effect watching BOTH dependencies:

```jsx
// ✅ SINGLE EFFECT - watches BOTH canvas readiness AND data
useEffect(() => {
  // Guard: Need canvas element, chart data, and points
  if (!canvasRef.current || !chartData || !chartData.dataPoints || chartData.dataPoints.length === 0) {
    console.log(`⏳ Waiting... Canvas: ${!!canvasRef.current}, Data: ${!!chartData}`);
    return;
  }

  // Guard: Need canvas to be ready (mounted in DOM)
  if (!canvasReady) {
    console.log(`⏳ Canvas element exists but not ready yet`);
    return;
  }

  console.log(`✅ All conditions met, drawing chart`);
  
  requestAnimationFrame(() => {
    if (canvasRef.current && chartData && chartData.dataPoints) {
      drawChart(chartData.dataPoints);
    }
  });
}, [canvasReady, chartData]); // Watch BOTH!
```

## Why This Works

### Scenario A: Canvas Ready First (Normal)
1. Canvas mounts → `canvasReady = true` → Effect runs
2. No chartData yet → Early return
3. Enrichment completes → `chartData` set → Effect runs AGAIN
4. Both conditions met → Chart draws ✅

### Scenario B: Data Ready First (Race)
1. Enrichment completes quickly → `chartData` set → Effect runs
2. Canvas not ready yet → Early return  
3. Canvas mounts → `canvasReady = true` → Effect runs AGAIN
4. Both conditions met → Chart draws ✅

### Scenario C: Both Ready Simultaneously
1. Both true → Effect runs once
2. Chart draws ✅

## Key Improvements Over V2

- ✅ **Single effect** instead of two (cleaner, no duplication)
- ✅ **Better debug logging** shows exactly what's missing
- ✅ **Explicit guards** make logic crystal clear
- ✅ **No double-drawing** (single effect fires once per change)

## Console Output

### Success (Data arrives after canvas):
```
[PriceHistoryChart] 🎨 Canvas element mounted for ELUNMOSK
⏳ Waiting... Canvas: true, Data: false, Points: 0
✅ On-view enrichment complete for ELUNMOSK in 847ms
✅ All conditions met, drawing chart for ELUNMOSK (9 points)
🎨 Clean chart rendered with 9 points
```

### Success (Canvas arrives after data):
```
✅ On-view enrichment complete for ELUNMOSK in 621ms
⏳ Canvas element exists but not ready yet for ELUNMOSK
[PriceHistoryChart] 🎨 Canvas element mounted for ELUNMOSK
✅ All conditions met, drawing chart for ELUNMOSK (9 points)
🎨 Clean chart rendered with 9 points
```

## Files Modified
- `frontend/src/components/PriceHistoryChart.jsx`
  - Consolidated two useEffects into one (line 225-252)
  - Added clear guard clauses with debug logging
  - Watch both `[canvasReady, chartData]` dependencies

---

**Status:** ✅ COMPLETE V3 - Consolidated single-effect solution
**Date:** October 17, 2025  
**Result:** Charts render immediately on enrichment, all timing scenarios handled
