# Desktop Chart Lazy Loading Fix

## Problem
When in desktop mode (screen width >= 1200px), the chart was stuck displaying "Chart loading soon..." even though in mobile/normal state the graph loaded fine.

## Root Cause
The chart component uses an **Intersection Observer** for lazy loading to optimize performance. The observer waits for the chart container to come into the viewport before triggering `shouldLoad: true`.

**In mobile mode**: This works perfectly - charts load as you scroll through the feed.

**In desktop mode**: The chart is placed in a fixed right panel that's always visible. However, the Intersection Observer still waited to detect viewport intersection, which never happened properly, leaving the chart in the "loading soon" state.

## Solution
Added desktop mode detection to the lazy loading logic:

1. **Immediate Load in Desktop Mode**: When `window.innerWidth >= 1200`, immediately set `shouldLoad: true` without waiting for Intersection Observer
2. **Skip Observer Setup**: In desktop mode, skip the Intersection Observer entirely (performance optimization)
3. **Resize Handling**: Listen for window resize events to detect when user switches between desktop/mobile views

## Code Changes

### Before
```javascript
useEffect(() => {
  const container = chartContainerRef.current;
  if (!container) return;

  // Always use Intersection Observer
  const observer = new IntersectionObserver(/* ... */);
  observer.observe(container);
  
  return () => observer.disconnect();
}, [coin?.symbol]);
```

### After
```javascript
useEffect(() => {
  const container = chartContainerRef.current;
  if (!container) return;

  // Check if desktop mode (>= 1200px)
  const checkDesktopMode = () => {
    const isDesktopMode = window.innerWidth >= 1200;
    
    if (isDesktopMode && !shouldLoad) {
      console.log('🖥️ Desktop mode detected - loading chart immediately');
      setIsInView(true);
      setShouldLoad(true); // ← Load immediately!
    }
    
    return isDesktopMode;
  };
  
  const isDesktop = checkDesktopMode();
  
  if (isDesktop) {
    // Desktop: skip observer, just listen for resize
    window.addEventListener('resize', checkDesktopMode);
    return () => window.removeEventListener('resize', checkDesktopMode);
  }

  // Mobile/Tablet: use Intersection Observer
  const observer = new IntersectionObserver(/* ... */);
  observer.observe(container);
  
  return () => observer.disconnect();
}, [coin?.symbol, shouldLoad]);
```

## How It Works Now

### Desktop Mode (>= 1200px)
1. Component mounts
2. **Immediately detects** desktop mode
3. **Sets `shouldLoad: true`** right away
4. Chart initialization begins immediately
5. Chart appears in right panel within ~1 second

### Mobile/Tablet Mode (< 1200px)
1. Component mounts
2. Detects mobile mode
3. Sets up Intersection Observer with 200% rootMargin
4. Chart loads when scrolling near it (within 2 screen heights)
5. Lazy loading optimizes performance

### Window Resize
- If user resizes from mobile → desktop: Chart loads immediately
- If user resizes from desktop → mobile: Chart remains loaded (no unload)

## Testing
✅ **Desktop mode**: Chart appears immediately in right panel
✅ **Mobile mode**: Chart lazy loads when scrolling near it
✅ **Window resize**: Chart adapts when switching between modes
✅ **No console errors**: Clean initialization
✅ **Performance**: Intersection Observer skipped in desktop for better performance

## Files Modified
- `/frontend/src/components/TwelveDataChart.jsx` (lines ~110-160)

## Related Issues
This fix works in conjunction with the other desktop chart fixes:
- Chart sizing (fills 100vh)
- Chart interactivity (mouse wheel, drag, touch)
- Resize handling (debounced, proper reflow)

See `DESKTOP_CHART_FIX.md` for complete details on all desktop chart improvements.
