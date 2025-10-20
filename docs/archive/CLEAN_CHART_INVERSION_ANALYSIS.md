# Clean Chart Inversion Issue - Analysis & Fix

## Problem

The Clean chart is showing **opposite trend** to the real DexScreener chart:
- Real chart (Advanced view): Going UP ✅
- Clean chart: Going DOWN ❌

## Investigation Results

### Token: PumpScreen (9LRTJXYpzu6B2VvDV5MMDsc9Hpdseps4hecJJcbdQknZ)

**DexScreener Price Changes:**
```
5m:   +0.10%
1h:   -24.16%  ← Negative means price DROPPED from 1h ago to now
6h:   -2.01%   ← Negative means price DROPPED from 6h ago to now  
24h:  +10.35%  ← Positive means price ROSE from 24h ago to now
```

**Calculated Anchor Prices:**
```
24h ago: $0.00740462
6h ago:  $0.00833861  (up from 24h)
1h ago:  $0.010774    (HUGE SPIKE - up 29% from 6h!)
5m ago:  $0.00816284  (down from 1h spike)
Current: $0.00817100  (slightly up from 5m)
```

**Expected Chart Shape:**
```
Start  ─────────────────────▲ Spike at 1h
(24h ago)                    │
$0.0074                      │ $0.01077
                             │
                             ▼ Recent pullback
                           End (now)
                           $0.00817

Overall: UP +10.35% from 24h ago
```

## Root Cause Analysis

The issue is with how we interpret **negative price changes**:

### ❌ Current Misunderstanding:
- `change1h = -24.16%` 
- We think: "Price changed -24.16% in the last hour"
- We calculate: `price1hAgo = currentPrice / (1 + (-24.16/100))`
- We get: `price1hAgo = $0.010774`

### The Problem:
When we have a **negative 1h change** (-24.16%), this means:
- **Price FELL** from 1 hour ago to now
- The price 1 hour ago was HIGHER than now
- Our calculation is correct: `$0.010774` → `$0.00817100` = -24.16% ✅

BUT the issue is likely in the **interpolation or anchor ordering**.

## Detailed Analysis

### Anchor Points (Sorted Oldest First):
1. 24h ago: $0.00740462
2. 6h ago: $0.00833861  ← UP 12.6% from 24h
3. 1h ago: $0.010774    ← UP 29% from 6h (SPIKE!)
4. 5m ago: $0.00816284  ← DOWN 24% from 1h
5. Current: $0.00817100 ← UP 0.1% from 5m

### Chart Should Show:
```
Hour 0 (24h ago):    $0.00740
Hour 6 (18h ago):    ~$0.0075 (gradual rise)
Hour 12 (12h ago):   ~$0.0078 (gradual rise)
Hour 18 (6h ago):    $0.00834 (continuing rise)
Hour 23 (1h ago):    $0.01077 (MASSIVE SPIKE!)
Hour 24 (now):       $0.00817 (sharp drop from spike)
```

## Likely Issues

### 1. **Interpolation Between Negative-Change Anchors**

When interpolating between 6h ago ($0.00834) and 1h ago ($0.01077):
- This is a 5-hour span
- Price should RISE throughout this period
- Interpolation should show gradual increase

Then between 1h ago ($0.01077) and current ($0.00817):
- This is a 1-hour span
- Price should FALL throughout this period (the -24.16% drop)
- Interpolation should show sharp decrease

### 2. **Possible Anchor Sorting Issue**

Check if anchors are being sorted correctly:
```javascript
// Sort by time (oldest first)
anchors.sort((a, b) => b.hoursAgo - a.hoursAgo);
```

This sorts **descending** by `hoursAgo`, which means:
- First: 24 (oldest)
- Last: 0 (newest)

This is CORRECT ✅

### 3. **Interpolation Direction**

```javascript
for (let hour = 24; hour >= 0; hour--) {
  // Loop from 24h ago to now
  const targetHoursAgo = hour;
  
  // Find surrounding anchors
  // lowerAnchor = older (higher hoursAgo)
  // upperAnchor = newer (lower hoursAgo)
  
  const timeFraction = (lowerAnchor.hoursAgo - targetHoursAgo) / 
                       (lowerAnchor.hoursAgo - upperAnchor.hoursAgo);
  
  const basePrice = lowerAnchor.price + 
                   (upperAnchor.price - lowerAnchor.price) * timeFraction;
}
```

**Example:** Interpolating at hour 23 (1h ago) between:
- lowerAnchor: 24h ago ($0.00740)
- upperAnchor: 6h ago ($0.00834)

```
timeFraction = (24 - 23) / (24 - 6) = 1 / 18 = 0.055
basePrice = 0.00740 + (0.00834 - 0.00740) * 0.055
basePrice = 0.00740 + (0.00094 * 0.055)
basePrice = 0.00740 + 0.0000517
basePrice = $0.007452
```

But we KNOW that at hour 23 (1h ago), the actual price was $0.01077!

**This is the problem!** ❌

The interpolation is using 24h and 6h anchors when it should be using 6h and 1h anchors!

## The Bug

The anchor finding logic needs to find the **closest surrounding anchors**, not just any anchors that bracket the target time.

### Current Logic:
```javascript
for (let i = 0; i < anchors.length - 1; i++) {
  if (anchors[i].hoursAgo >= targetHoursAgo && 
      anchors[i + 1].hoursAgo <= targetHoursAgo) {
    lowerAnchor = anchors[i];
    upperAnchor = anchors[i + 1];
    break;  // TAKES FIRST MATCH
  }
}
```

For `targetHoursAgo = 23`:
- anchors[0] = 24h ago (hoursAgo=24) >= 23 ✅
- anchors[1] = 6h ago (hoursAgo=6) <= 23 ✅
- **MATCH! Uses 24h and 6h anchors**

But we have a 1h anchor (hoursAgo=1) that's much closer!

### The Fix:

We need to find the **closest** surrounding anchors:

```javascript
// Find closest surrounding anchors
let lowerAnchor = null;
let upperAnchor = null;
let minGap = Infinity;

for (let i = 0; i < anchors.length - 1; i++) {
  if (anchors[i].hoursAgo >= targetHoursAgo && 
      anchors[i + 1].hoursAgo <= targetHoursAgo) {
    const gap = anchors[i].hoursAgo - anchors[i + 1].hoursAgo;
    if (gap < minGap) {
      minGap = gap;
      lowerAnchor = anchors[i];
      upperAnchor = anchors[i + 1];
    }
  }
}
```

Now for `targetHoursAgo = 23`:
- Pair 1: 24h and 6h → gap = 18 hours
- Pair 2: 6h and 1h → gap = 5 hours ← Better fit!
- **Uses 6h and 1h anchors** ✅

Actually wait - for hour 23, the anchors should be:
- 24h ago (hoursAgo=24) and 1h ago (hoursAgo=1)? No, that's not right either.

Let me reconsider... The logic should work differently.

## Correct Solution

For each target hour, we need to find the **two closest anchors that surround it**:

```javascript
// Find the two closest anchors surrounding this point
let lowerAnchor = null; // Anchor with hoursAgo > targetHoursAgo
let upperAnchor = null; // Anchor with hoursAgo < targetHoursAgo

for (let i = 0; i < anchors.length; i++) {
  if (anchors[i].hoursAgo >= targetHoursAgo) {
    if (!lowerAnchor || anchors[i].hoursAgo < lowerAnchor.hoursAgo) {
      lowerAnchor = anchors[i];
    }
  }
  if (anchors[i].hoursAgo <= targetHoursAgo) {
    if (!upperAnchor || anchors[i].hoursAgo > upperAnchor.hoursAgo) {
      upperAnchor = anchors[i];
    }
  }
}
```

For `targetHoursAgo = 23`:
- lowerAnchor: closest anchor with hoursAgo >= 23 → 24h ago
- upperAnchor: closest anchor with hoursAgo <= 23 → 6h ago

Hmm, this gives the same result.

## Wait - I See It Now!

The anchors list has:
```
0: 24h ago
1: 6h ago  
2: 1h ago
3: 5m ago (0.083h)
4: 0h ago (current)
```

For `targetHoursAgo = 2` (2 hours ago):
- Should use: 6h ago and 1h ago
- Current logic checks: `anchors[i].hoursAgo >= 2 && anchors[i+1].hoursAgo <= 2`
  - i=0: 24 >= 2 && 6 <= 2? NO (6 is not <= 2)
  - i=1: 6 >= 2 && 1 <= 2? YES! ✅
  - Uses 6h and 1h anchors ✅

For `targetHoursAgo = 23` (23 hours ago):
- Should use: 24h ago and 6h ago
- Current logic checks: `anchors[i].hoursAgo >= 23 && anchors[i+1].hoursAgo <= 23`
  - i=0: 24 >= 23 && 6 <= 23? YES! ✅
  - Uses 24h and 6h anchors ✅

So the logic IS correct!

## Real Issue: Check the Data

The problem must be in:
1. **Data being displayed** - frontend might be inverting the chart
2. **Actual chart data generated** - check what's in `cleanChartData.dataPoints`

We need to inspect the actual generated data points to see if they match expectations.

## Next Steps

1. ✅ Verify anchor calculations are correct (DONE - they are!)
2. ✅ Verify interpolation logic (DONE - it's correct!)
3. ⏳ CHECK ACTUAL GENERATED DATA POINTS
4. ⏳ Verify frontend isn't inverting the chart when drawing

The bug is likely in **step 3 or 4** - either the backend is generating inverted data, or the frontend is drawing it upside-down.

