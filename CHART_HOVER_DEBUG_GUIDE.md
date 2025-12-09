# 🐛 Chart Hover Debug Guide

## 🔍 How to Debug the Chart Hover Issue

### Step 1: Open Browser Console
1. Open your app in browser
2. Press `F12` or `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows)
3. Go to the **Console** tab

### Step 2: Expand a Coin Card
1. Click on any coin to expand it
2. The chart should load

### Step 3: Look for These Logs

#### ✅ When Chart Initializes:
```
📊 [TwelveDataChart] Setting up crosshair subscription for GOOK, onCrosshairMove: true
```

If you see `onCrosshairMove: false`, that means the callback isn't being passed!

#### ✅ When You Hover Over Chart:
```
📊 [TwelveDataChart] Crosshair move event: Object
  hasParam: true
  hasTime: true
  hasSeriesData: true
  hasCallback: true

📊 [TwelveDataChart] Price data at crosshair: Object { value: 0.00000123, time: 1765061234 }

📊 [TwelveDataChart] Calling onCrosshairMove with price: $0.00000123

📊 [GOOK] Chart crosshair callback: Object { price: 0.00000123, time: 1765061234 }

✅ [GOOK] Set hovered price to: $0.00000123

📊 [GOOK] PRICE CALC: Object
  chartHoveredPrice: 0.00000123
  displayPrice: 0.00000122
  finalPrice: 0.00000123
  usingHoveredPrice: true
```

#### ✅ When You Move Mouse Away:
```
📊 [TwelveDataChart] Calling onCrosshairMove(null) to restore live price

📊 [GOOK] Chart crosshair callback: null

🔄 [GOOK] Cleared hovered price, back to live
```

---

## 🐛 Common Issues & Solutions

### Issue 1: No logs at all when hovering
**Problem**: Chart might not be loaded or crosshair is disabled  
**Check**: 
- Is the chart visible on screen?
- Is there data in the chart?
- Try refreshing the page

### Issue 2: Logs show `hasCallback: false`
**Problem**: `onCrosshairMove` callback not passed to chart  
**Fix**: Already fixed in code, refresh page

### Issue 3: Logs show crosshair events but price not updating in UI
**Problem**: React state not causing re-render  
**Check**: Look for the "PRICE CALC" log - if `chartHoveredPrice` is set but `finalPrice` doesn't match, there's a state issue

### Issue 4: `hasSeriesData: false` or `priceData` is undefined
**Problem**: Chart series not properly initialized  
**Check**: Chart data might be loading or empty

---

## 📊 What Should Happen

1. **You hover over chart** → Console floods with logs
2. **Price in UI updates** → Shows exact price at cursor position
3. **You move mouse away** → Price returns to live price
4. **Logs confirm everything** → All checks pass

---

## 🔥 Quick Test

1. **Refresh browser** (`Cmd+R` or `Ctrl+R`)
2. **Expand any coin card**
3. **Wait for chart to load** (you'll see chart appear)
4. **Hover your mouse over the chart**
5. **Watch console** - Should flood with logs
6. **Watch main price display** - Should update as you move mouse

---

## 📝 Report Back

If it's still not working, copy-paste the console logs you see (or screenshot) so we can diagnose exactly what's happening!
