# Mobile Scroll Diagnostic Report
**Date**: October 23, 2025  
**Issue**: Mobile scrolling not working properly after recent fixes

---

## 🔍 DIAGNOSTIC FINDINGS

### Current Mobile Scroll Architecture

#### 1. **CSS Layer** (ModernTokenScroller.css)
```css
/* Mobile: CSS scroll-snap is DISABLED */
@media (max-width: 767px) {
  .modern-scroller-container {
    scroll-snap-type: none;  /* ✅ Disabled */
    scroll-behavior: smooth;  /* ⚠️ PROBLEM: Conflicts with JS */
  }
}
```

**Issue**: `scroll-behavior: smooth` in CSS interferes with JavaScript's instant snap correction!

#### 2. **JavaScript Layer** (ModernTokenScroller.jsx)

**Two conflicting scroll handlers:**

**Handler #1**: `handleScroll()` callback (lines 670-717)
- Only handles enrichment
- Does NOT update index anymore (we removed it)
- Called on every scroll event

**Handler #2**: Main `useEffect` scroll handler (lines 722-900)
- Handles index updates via `updateCurrentIndex()`
- Handles snap correction via `snapToNearestCard()`
- Handles touch swipe navigation
- Also calls `handleScroll()` for enrichment

**Problem**: Double handling and conflicting logic!

---

## 🐛 IDENTIFIED PROBLEMS

### Problem #1: CSS `scroll-behavior: smooth` Conflict
**Location**: ModernTokenScroller.css line 121  
**Impact**: When JS tries to do instant snap (`container.scrollTop = targetScroll`), CSS smooth scrolling takes over and ruins the snap precision.

**Evidence**:
```javascript
// JS tries instant snap
container.scrollTop = targetScroll; // ❌ CSS overrides with smooth!
```

### Problem #2: Redundant `handleScroll()` Function
**Location**: Lines 670-717  
**Impact**: This function is now only used for enrichment but is called on every scroll event. It duplicates the `findNearestCardIndex` logic that already exists in the main handler.

**Evidence**:
```javascript
const handleScroll = useCallback(() => {
  // Duplicates findNearestCardIndex logic
  const findNearestCardIndexDuringScroll = () => { /* ... */ };
  const newIndex = findNearestCardIndexDuringScroll();
  // Only does enrichment now, index update removed
}, [coins, enrichedCoins, enrichCoins, expandedCoin]);
```

### Problem #3: Over-aggressive Snap Detection
**Location**: Lines 828-846  
**Impact**: The snap detection is TOO sensitive (0.1px tolerance, 30ms checks) and may be fighting with CSS smooth scrolling.

**Evidence**:
```javascript
// Checks every 30ms with 0.1px tolerance
if (Math.abs(currentScrollTop - lastScrollTop) < 0.1) {
  snapToNearestCard(); // Fires too often!
}
```

### Problem #4: Touch Swipe Interference
**Location**: Lines 878-912  
**Impact**: Touch handlers may interfere with native mobile scrolling momentum.

---

## 🎯 ROOT CAUSE ANALYSIS

The mobile scroll is broken because:

1. **CSS smooth scrolling conflicts with JS instant snap** - Browser tries to animate when JS wants instant positioning
2. **Too many handlers doing similar things** - `handleScroll()` + main handler + touch handlers all fighting each other
3. **Over-aggressive snap correction** - Snapping too frequently interferes with natural scroll
4. **Virtual scrolling with placeholders** - Placeholder divs may not have proper heights, causing scroll position miscalculations

---

## 💡 RECOMMENDED FIX

### Fix #1: Remove CSS `scroll-behavior: smooth` on Mobile
```css
@media (max-width: 767px) {
  .modern-scroller-container {
    scroll-snap-type: none;
    scroll-behavior: auto; /* ✅ Let JS control scrolling */
  }
}
```

### Fix #2: Simplify JavaScript Scroll Logic
**Remove** the redundant `handleScroll()` callback and do everything in one place:

```javascript
const handleScrollEvent = () => {
  // 1. Update index immediately
  updateCurrentIndex();
  
  // 2. Handle enrichment inline (no separate function)
  const newIndex = findNearestCardIndex();
  const currentCoin = coins[newIndex];
  if (currentCoin && !enrichedCoins.has(currentCoin.mintAddress)) {
    setTimeout(() => enrichCoins([currentCoin.mintAddress]), 100);
  }
  
  // 3. Start snap detection
  if (scrollEndTimer) clearTimeout(scrollEndTimer);
  lastScrollTop = container.scrollTop;
  scrollEndTimer = setTimeout(checkScrollStopped, 100); // ✅ Slower = less aggressive
};
```

### Fix #3: Relax Snap Tolerance
```javascript
// Less aggressive snap detection
if (Math.abs(currentScrollTop - lastScrollTop) < 1) { // ✅ 1px instead of 0.1px
  scrollStopCheckCount++;
  if (scrollStopCheckCount >= 2) { // ✅ 2 checks instead of 1
    snapToNearestCard();
  }
}
```

### Fix #4: Disable Touch Handlers (Let Native Scroll Work)
Remove `handleTouchStart` and `handleTouchEnd` - they're interfering with native iOS/Android scrolling.

---

## 🚀 IMPLEMENTATION PRIORITY

1. **CRITICAL**: Fix CSS `scroll-behavior: smooth` → `auto` on mobile
2. **HIGH**: Remove redundant `handleScroll()` callback  
3. **MEDIUM**: Relax snap tolerance from 0.1px to 1px
4. **LOW**: Consider removing touch handlers

---

## 📊 Expected Behavior After Fix

- ✅ Smooth native mobile scrolling
- ✅ Snap-to-card when scroll stops
- ✅ No drift or index mismatch
- ✅ Trade button loads correct coin
- ✅ No fighting between CSS and JS

---

## 🧪 Testing Checklist

After implementing fixes:

- [ ] Test on iPhone Safari
- [ ] Test on Android Chrome
- [ ] Scroll through 20+ coins - no drift
- [ ] Click Trade button - correct coin loads
- [ ] Fast swipe - smooth momentum
- [ ] Slow scroll - snaps to nearest coin
- [ ] Check console for snap correction logs

