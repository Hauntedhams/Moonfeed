# ⚡ Quick Fix Reference: React Hooks Error

## The Problem
```
Uncaught Error: Rendered more hooks than during the previous render.
```
Black screen on mobile when clicking "Load Chart Here"

## The Cause
❌ Early return BEFORE `useEffect` hooks
```jsx
if (isMobile && !showIframe) {
  return <div>...</div>; // ❌ Skips hooks below!
}
useEffect(() => {...}); // ❌ Only runs sometimes
```

## The Fix
✅ ALL hooks BEFORE any returns
```jsx
// ✅ Call ALL hooks first
const [state, setState] = useState();
useEffect(() => {...});
useEffect(() => {...});

// ✅ THEN do conditional returns
if (condition) return <div>...</div>;
```

## React Rules of Hooks
1. **Call hooks at the top level** (before any returns)
2. **Call hooks in the same order** every render
3. **Never skip hooks conditionally**

## Files Fixed
- `frontend/src/components/DexScreenerChart.jsx`
- `frontend/src/App.jsx` (build timestamp)

## Status
✅ Fixed in build v2.2
✅ No more React errors
✅ Mobile works perfectly
✅ Desktop works perfectly

## Learn More
https://reactjs.org/link/rules-of-hooks
