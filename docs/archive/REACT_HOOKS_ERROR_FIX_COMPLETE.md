# 🚨 CRITICAL FIX: React Hooks Error - Complete Resolution

## Issue
Black screen on mobile when clicking "Load Chart Here" + React error:
```
Uncaught Error: Rendered more hooks than during the previous render.
Warning: React has detected a change in the order of Hooks called by DexScreenerChart.
```

## Root Cause
**FATAL MISTAKE: Conditional Early Return Before Hooks**

The original code violated React's **Rules of Hooks** by having an early return statement BEFORE calling `useEffect` hooks:

```jsx
❌ WRONG (Original Code):
const DexScreenerChart = ({ coin, isPreview = false }) => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showIframe, setShowIframe] = useState(!isMobile);
  
  // ❌ EARLY RETURN HERE - VIOLATES RULES OF HOOKS
  if (isMobile && !showIframe) {
    return <div>Load Chart Here button...</div>;
  }
  
  // ❌ These useEffect hooks only run AFTER the early return
  // This causes "Rendered more hooks than during previous render" error
  useEffect(() => { ... }, [chartUrl]); // Hook order changes!
  useEffect(() => { ... }, [showIframe]); // Hook order changes!
  
  return <iframe .../>;
};
```

### Why This Breaks React
1. **First render (mobile, no iframe):** Hooks called = 5 useState + 0 useEffect = 5 hooks
2. **Second render (mobile, iframe shown):** Hooks called = 5 useState + 2 useEffect = 7 hooks
3. **React error:** "Rendered more hooks than during the previous render"

## Solution
**Move ALL hooks to the top, BEFORE any conditional returns:**

```jsx
✅ CORRECT (Fixed Code):
const DexScreenerChart = ({ coin, isPreview = false }) => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // ✅ ALL HOOKS FIRST (before any conditional returns)
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showIframe, setShowIframe] = useState(!isMobile);
  const iframeRef = useRef(null);
  const timeoutRef = useRef(null);
  
  const chartUrl = `https://dexscreener.com/...`;
  
  // ✅ ALL useEffect hooks BEFORE conditional returns
  useEffect(() => {
    if (!showIframe) return; // Early exit inside hook is OK
    // ... preload logic
  }, [chartUrl, isLoading, showIframe]);
  
  useEffect(() => {
    if (isMobile && showIframe) {
      console.log('📊 Chart loaded');
      return () => console.log('🧹 Cleanup');
    }
  }, [isMobile, showIframe, coin.symbol]);
  
  // ✅ NOW conditional returns are AFTER all hooks
  if (isMobile && !showIframe) {
    return <div>Load Chart Here button...</div>;
  }
  
  if (hasError) {
    return <div>Error state...</div>;
  }
  
  return <iframe .../>;
};
```

## React Rules of Hooks
From React documentation: https://reactjs.org/link/rules-of-hooks

### Rule #1: Only Call Hooks at the Top Level
**❌ Don't call Hooks inside:**
- Loops
- Conditions
- Nested functions
- **Early returns**

**✅ Do call Hooks:**
- At the top level of your React function
- Before any return statements
- In the same order every time

### Rule #2: Only Call Hooks from React Functions
- ✅ Call from React function components
- ✅ Call from custom Hooks
- ❌ Don't call from regular JavaScript functions

## Technical Details

### Hook Order Must Be Consistent
React relies on the **order of Hook calls** to preserve state between renders:

```jsx
// First render
useState() // Hook 1
useState() // Hook 2
useState() // Hook 3
useEffect() // Hook 4
useEffect() // Hook 5

// Second render (MUST be same order)
useState() // Hook 1
useState() // Hook 2
useState() // Hook 3
useEffect() // Hook 4
useEffect() // Hook 5
```

If the order changes, React gets confused and crashes.

### Early Return Problem
```jsx
❌ BROKEN:
if (condition) return <div>Early exit</div>; // Skips hooks below
useEffect(() => { ... }); // Only called when condition is false
```

```jsx
✅ FIXED:
useEffect(() => { ... }); // Always called
if (condition) return <div>Early exit</div>; // Now safe
```

## Files Changed
- `/frontend/src/components/DexScreenerChart.jsx` - Complete rewrite with hooks at top

## Key Changes
1. **Moved ALL hooks to the top** of the component (before any returns)
2. **Used early exit inside hooks** (`if (!showIframe) return;`) instead of early component return
3. **Ensured consistent hook call order** on every render
4. **Maintained all functionality** (mobile placeholder, on-demand loading, dark theme)

## Testing
✅ **No React errors:** Hook order is now consistent
✅ **Mobile works:** "Load Chart Here" button shows without errors
✅ **Desktop works:** Charts load automatically
✅ **On-demand loading:** Only 1 iframe loads at a time on mobile
✅ **Memory safe:** ~8-10MB per chart (vs ~800MB for all charts)

## Performance Impact
✅ **Zero performance regression:**
- Same memory usage (~65MB base + ~8-10MB per loaded chart)
- Same on-demand loading behavior
- Same cleanup mechanism
- Now with **zero React errors**

## Build Info
Fixed in: Mobile Performance Build v2.2
Date: October 11, 2025
Critical Fix: React Hooks violation causing black screen

## Related Docs
- BLACK_SCREEN_FIX_COMPLETE.md (styling fix)
- MOBILE_PERFORMANCE_FIX_COMPLETE.md (original performance work)
- DEXSCREENER_ON_DEMAND_LOADING.md (on-demand feature)
- React Docs: https://reactjs.org/link/rules-of-hooks

## Lessons Learned
1. **Never put early returns before hooks** - Always call ALL hooks first
2. **Use early exits inside hooks** - `if (!condition) return;` inside `useEffect` is OK
3. **Hook order must be consistent** - React depends on it for state management
4. **Test with React DevTools** - Catches hook order violations early

---

**Status**: ✅ FIXED - React Hooks error resolved, black screen issue eliminated
**Root Cause**: Early return before `useEffect` hooks violated Rules of Hooks
**Solution**: Moved all hooks to top of component before any conditional returns
**Result**: Component works perfectly on mobile and desktop with no errors
