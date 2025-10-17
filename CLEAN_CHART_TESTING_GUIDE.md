# 🧪 Clean Chart & Rugcheck - Testing Guide

## Quick Test (30 seconds)

1. **Open your frontend** (should already be running at http://localhost:5173)
2. **Open browser console** (F12 or Cmd+Option+I)
3. **Scroll through 3-5 coins** in any feed
4. **Look for these indicators:**

### ✅ Success Indicators:

#### Visual (What You Should See):
- 🎨 **Banner image** at top of card
- 📊 **5-point line chart** below price
- 🔒 **Liquidity lock badge** showing percentage
- 💰 **Numeric data** (price, volume, market cap)

#### Console Logs (What You Should See):
```
🎯 On-view enrichment triggered for SYMBOL
✅ On-view enrichment complete for SYMBOL in 234ms
📦 Storing enrichment data for SYMBOL
📊 Enriched data includes: { 
  hasCleanChartData: true, 
  hasRugcheck: true, 
  hasBanner: true 
}
✅ Updated coin in array for SYMBOL: { 
  hasCleanChartData: true, 
  hasRugcheck: true, 
  hasBanner: true 
}
```

### ❌ Failure Indicators:

#### Visual Problems:
- ❌ No chart appears (just blank space)
- ❌ No liquidity lock percentage shown
- ❌ Banner missing or placeholder

#### Console Issues:
- ❌ `hasCleanChartData: false`
- ❌ `hasRugcheck: false`
- ❌ Any error messages
- ❌ 404 or API errors

## Detailed Test Scenarios

### Test 1: First Coin Load
**Action:** Open app, wait for first coin to load  
**Expected:** Banner + Chart + Rugcheck all appear together within 1-2 seconds  
**Console:** Should show enrichment success logs  

### Test 2: Scroll to Next Coin
**Action:** Swipe/scroll to next coin  
**Expected:** Banner + Chart + Rugcheck appear immediately (no delay)  
**Console:** New enrichment logs for the new coin  

### Test 3: Rapid Scrolling
**Action:** Quickly scroll through 5+ coins  
**Expected:** Each coin enriches on-demand, no crashes  
**Console:** Enrichment logs for each coin (with 500ms debounce)  

### Test 4: Scroll Back
**Action:** Scroll back to a previously viewed coin  
**Expected:** Data loads instantly (from cache), no re-enrichment needed  
**Console:** No new enrichment logs (uses cached data)  

### Test 5: Different Feeds
**Action:** Test TRENDING, NEW, and CUSTOM feeds  
**Expected:** All feeds show chart + rugcheck data  
**Console:** Same enrichment logs for all feeds  

## Quick Debug Checklist

If chart or rugcheck is missing:

1. **Check Console**
   - Are there enrichment logs?
   - Does `hasCleanChartData` show `true`?
   - Does `hasRugcheck` show `true`?

2. **Check Network Tab**
   - Is `/api/coins/enrich-single` being called?
   - What's the response? (Should include `cleanChartData`, `rugcheckScore`, etc.)

3. **Check Backend Logs**
   - Is enrichment completing successfully?
   - Are there "Generated clean chart" logs?

4. **Check Component**
   - Inspect coin object in React DevTools
   - Does it have `cleanChartData` property?
   - Does it have `rugcheckScore`, `liquidityLocked` properties?

## Expected Timeline

| Event | Time | What Happens |
|-------|------|--------------|
| Coin enters viewport | 0ms | CoinCard detects visibility |
| Enrichment triggered | +500ms | Debounced enrichment request |
| Backend processing | +500-1500ms | DexScreener + Rugcheck APIs |
| Data returned | +1000-2000ms | Enriched data sent to frontend |
| UI updates | +1000-2000ms | Banner, chart, rugcheck appear together |

**Total:** ~1-2 seconds from scroll to fully enriched display

## Status Indicators

### Backend Running ✅
```bash
🚀 MoonFeed Backend Server running on port 3001
✅ Background initialization complete: X coins cached
✅ Jupiter Live Price Service started
```

### Frontend Running ✅
```bash
VITE vX.X.X  ready in XXX ms
➜  Local:   http://localhost:5173/
```

### Enrichment Working ✅
Browser console shows:
- `🎯 On-view enrichment triggered`
- `✅ On-view enrichment complete`
- `📦 Storing enrichment data`
- `hasCleanChartData: true`
- `hasRugcheck: true`

## If Something Doesn't Work

1. **Restart Backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Restart Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Clear Browser Cache:**
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

4. **Check Logs:**
   - Backend terminal
   - Frontend terminal  
   - Browser console

## Success Criteria

✅ Banner loads  
✅ 5-point chart displays  
✅ Rugcheck badge shows  
✅ All data appears together  
✅ Works on scroll  
✅ Works across all feeds  
✅ No console errors  

---

**Last Updated:** October 17, 2025  
**Status:** Ready for Testing 🧪
