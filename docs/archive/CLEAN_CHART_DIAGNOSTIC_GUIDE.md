# 🔍 Clean Chart Debug Guide - Step by Step

## Current Status
The banner loads correctly, but the clean chart stays flat (not displaying).

## Debug Steps to Find the Issue

### Step 1: Restart Frontend (REQUIRED)
**You MUST restart the frontend to see the new debug logs:**

```bash
# Stop the frontend (Ctrl+C)
cd frontend
npm run dev
```

### Step 2: Open Browser Console
1. Open http://localhost:5173
2. Press F12 or Cmd+Option+I
3. Go to Console tab
4. Clear the console (trash icon)

### Step 3: Scroll to a Coin

Watch the console for these log sequences:

#### Expected Log Sequence:

```
1️⃣ ENRICHMENT TRIGGER:
🔄 Enriching SYMBOL via http://localhost:3001/api/coins/enrich-single

2️⃣ ENRICHMENT SUCCESS:
✅ On-view enrichment complete for SYMBOL in 234ms
📊 Enriched coin data: { 
  hasCleanChartData: true,   ← Should be TRUE
  hasRugcheck: true, 
  hasBanner: true 
}

3️⃣ STATE UPDATE:
📦 Storing enrichment data for SYMBOL
📊 Enriched data includes: { 
  hasCleanChartData: true,   ← Should be TRUE
  hasRugcheck: true, 
  ...
}
✅ Updated coin in array for SYMBOL: { 
  hasCleanChartData: true,   ← Should be TRUE
  hasRugcheck: true, 
  hasBanner: true 
}

4️⃣ CHART RENDER:
[CoinCard] Rendering PriceHistoryChart for SYMBOL: {
  hasCleanChartData: true,   ← Should be TRUE
  dataPoints: 5,             ← Should be 5
  enriched: true,
  hasPriceChange: true
}
```

## Diagnostic Scenarios

### ❌ Scenario A: Enrichment API Not Called
**Console shows:** No enrichment logs at all

**Problem:** API call not triggering
**Check:**
- Is CoinCard visible (scroll works)?
- Check Network tab for `/enrich-single` request
- Any JavaScript errors?

### ❌ Scenario B: Enrichment Returns False
**Console shows:**
```
📊 Enriched coin data: { hasCleanChartData: false, ... }
```

**Problem:** Backend not generating chart data
**Check Backend Console for:**
```
✅ Generated clean chart with 5 points
```

**If missing, check:**
- Backend DexScreener API working?
- Backend logs show "No DexScreener data"?

### ❌ Scenario C: Chart Data Lost in State Update
**Console shows:**
```
📊 Enriched coin data: { hasCleanChartData: true }  ← TRUE here
...but...
[CoinCard] Rendering PriceHistoryChart: { hasCleanChartData: false }  ← FALSE here!
```

**Problem:** Data lost when updating state
**This means:** Bug in `handleEnrichmentComplete` merge logic

### ❌ Scenario D: Chart Component Not Receiving Data
**Console shows:**
```
[CoinCard] Rendering PriceHistoryChart: { hasCleanChartData: false }
```

**Problem:** Coin prop doesn't have cleanChartData
**Check:**
- React DevTools → Find CoinCard component
- Inspect `coin` prop
- Does it have `cleanChartData` property?

## Manual API Test

Test the enrichment API directly:

```bash
# 1. Get a coin address from the feed
curl http://localhost:3001/api/coins/trending | python3 -m json.tool | grep mintAddress | head -1

# 2. Copy the mintAddress and test enrichment
curl -X POST http://localhost:3001/api/coins/enrich-single \
  -H "Content-Type: application/json" \
  -d '{
    "coin": {
      "mintAddress": "PASTE_ADDRESS_HERE",
      "symbol": "TEST",
      "price_usd": 0.001
    }
  }' | python3 -m json.tool
```

**Check the response:**
```json
{
  "success": true,
  "coin": {
    "cleanChartData": {
      "dataPoints": [
        { "timestamp": ..., "price": ..., "time": "...", "label": "24h" },
        { "timestamp": ..., "price": ..., "time": "...", "label": "6h" },
        { "timestamp": ..., "price": ..., "time": "...", "label": "1h" },
        { "timestamp": ..., "price": ..., "time": "...", "label": "5m" },
        { "timestamp": ..., "price": ..., "time": "...", "label": "now" }
      ],
      "metadata": { ... }
    },
    "rugcheckScore": ...,
    "liquidityLocked": ...,
    ...
  }
}
```

**If `cleanChartData` is missing or null:**
- Backend issue: Check backend console
- Look for "Generated clean chart" log
- Check for "No DexScreener data" warnings

## Quick Checks

### Is Backend Running?
```bash
curl http://localhost:3001/health
```
Should return: `{"status":"ok"}`

### Is Frontend Running?
Browser should show the app at http://localhost:5173

### Check Network Tab
1. Open DevTools → Network tab
2. Filter: `enrich-single`
3. Scroll to a coin
4. Click on the request
5. Check Response tab
6. Look for `cleanChartData` in the response

## Common Issues

### Issue 1: "Coin not found in cache"
**Error in API response:**
```json
{
  "success": false,
  "error": "Coin not found in cache"
}
```

**Fix:** The coin object must be passed in the request body (already done in our code)

### Issue 2: Chart stays flat
**If enrichment succeeds but chart doesn't show:**
- Check PriceHistoryChart component
- Look for errors in chart rendering logic
- Check if chart is looking for data in wrong property name

### Issue 3: Only works after viewing advanced chart
**This was the original issue we fixed**
- Should be fixed now with state update changes
- If still happening, check console logs

## What to Report Back

After following these steps, please share:

1. **Console logs** - Copy/paste the enrichment sequence
2. **Network tab** - Screenshot of `/enrich-single` response
3. **Which scenario** - A, B, C, or D above
4. **Backend console** - Any relevant logs

This will help identify exactly where the issue is!

---

**Last Updated:** October 17, 2025  
**Status:** Diagnostic Mode - Debug logs added
