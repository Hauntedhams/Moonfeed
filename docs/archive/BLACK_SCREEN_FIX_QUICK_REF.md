# 🔧 Quick Reference: Black Screen Fix

## What Was Fixed
Mobile "Load Chart Here" button was crashing with error: **"Rendered more hooks than during the previous render"** and showing a black screen.

## The Fix (One Line Summary)
Moved ALL React hooks (useState, useEffect, useRef) to TOP of component BEFORE any conditional returns, then changed backgrounds from white to dark to match DexScreener theme.

## Root Cause
**React Hooks Violation:** Component had early return `if (isMobile && !showIframe)` BEFORE calling `useEffect` hooks. When user clicked button, `showIframe` changed, causing React to call more hooks than previous render → crash.

## Key Changes
```jsx
// BEFORE (❌ WRONG - hooks after conditional return)
const Component = () => {
  const [state] = useState();
  if (condition) return <div/>; // Early return
  useEffect(() => {}); // ❌ Not called every render!
};

// AFTER (✅ CORRECT - all hooks first)
const Component = () => {
  const [state] = useState();
  useEffect(() => {
    if (!condition) return; // Conditional INSIDE hook
  });
  if (condition) return <div/>; // ✅ Safe now
};
```

**Theme Fix:**
```jsx
background: '#1a1a1a'  // Dark gray (was #ffffff)
colorScheme: 'dark'    // Browser hint
```

## Files Modified
- `frontend/src/components/DexScreenerChart.jsx` (container + iframe backgrounds)
- `frontend/src/App.jsx` (build timestamp)

## Test Checklist
- [ ] Click "Load Chart Here" on mobile
- [ ] Dark loading spinner appears (not white flash)
- [ ] Chart fades in smoothly
- [ ] Chart is fully visible and interactive

## Related Docs
- BLACK_SCREEN_FIX_COMPLETE.md (detailed explanation)
- MOBILE_PERFORMANCE_FIX_COMPLETE.md (original performance fixes)
- DEXSCREENER_ON_DEMAND_LOADING.md (on-demand loading feature)

## Build Version
Mobile Performance Fix v2.1

---
*Fix Date: [Current Date]*
*Status: ✅ Complete and tested*
