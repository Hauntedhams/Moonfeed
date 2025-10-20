# 🔧 Progress Bar Scroll Fix - Debugging Guide

## 🐛 Issue
User reports that swiping over the graduation progress bar does NOT scroll the charts, even though swiping over the nav dots area works perfectly.

## 🔍 Current Setup

### Event Listener Attachment
```javascript
// Line ~620
const chartNavRef = useRef(null); // Ref to parent container

// Lines ~720-728
navContainer.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
navContainer.addEventListener('mousedown', handleMouseDown);
```

### HTML Structure
```jsx
<div className="chart-nav-dots-top" ref={chartNavRef}> {/* <-- Event listeners here */}
  <div className="nav-dot">...</div>  {/* Dots work ✅ */}
  <div className="nav-dot">...</div>
  
  <div className="graduation-progress-bar-container">  {/* <-- Should work but doesn't ❌ */}
    <div>85%</div>
    <div className="graduation-progress-track">
      <div className="graduation-progress-fill"></div>
    </div>
    <div className="graduation-info-icon">?</div>
  </div>
</div>
```

## 🧪 Debugging Steps

### Step 1: Test if Events Are Reaching the Container
Run this in browser console:

```javascript
// Find the nav container
const navContainer = document.querySelector('.chart-nav-dots-top');

// Add debug listener
navContainer.addEventListener('mousedown', (e) => {
  console.log('🔵 MOUSEDOWN on nav container');
  console.log('Target:', e.target.className);
  console.log('CurrentTarget:', e.currentTarget.className);
}, { capture: true });

navContainer.addEventListener('touchstart', (e) => {
  console.log('📱 TOUCHSTART on nav container');
  console.log('Target:', e.target.className);
}, { capture: true });
```

**Try this:**
1. Click on nav dots → Should log "MOUSEDOWN"
2. Click on progress bar → Should also log "MOUSEDOWN"
3. If #2 doesn't log, something is blocking the event

### Step 2: Check if Child Elements Are Stopping Propagation
```javascript
// Check all children
const allChildren = document.querySelectorAll('.chart-nav-dots-top *');
allChildren.forEach(child => {
  child.addEventListener('mousedown', (e) => {
    console.log('Child mousedown:', child.className);
    console.log('stopPropagation called?', e.defaultPrevented);
  }, { capture: true });
});
```

### Step 3: Check Computed Styles
```javascript
const progressBar = document.querySelector('.graduation-progress-bar-container');
const styles = window.getComputedStyle(progressBar);

console.log('Progress Bar Styles:');
console.log('  pointer-events:', styles.pointerEvents);
console.log('  cursor:', styles.cursor);
console.log('  position:', styles.position);
console.log('  z-index:', styles.zIndex);
```

Expected:
- `pointer-events`: "auto" (not "none")
- `cursor`: "grab" or "inherit"

## 🔧 Potential Fixes

### Fix Option 1: Remove `pointerEvents` (Already Done)
We removed all `pointerEvents: 'none'` from progress bar elements.

### Fix Option 2: Add `cursor: inherit` to CSS (Already Done)
Added to `.graduation-progress-bar-container`, `.graduation-progress-track`, and `.graduation-progress-fill`.

### Fix Option 3: Ensure Event Bubbling
The events use `capture: true` which should work. If not, try removing capture:

```javascript
// Change from:
navContainer.addEventListener('mousedown', handleMouseDown, { capture: true });

// To:
navContainer.addEventListener('mousedown', handleMouseDown);  // Bubble phase
```

### Fix Option 4: Add Explicit Handlers to Progress Bar
If nothing else works, attach handlers directly to progress bar:

```javascript
const progressBar = document.querySelector('.graduation-progress-bar-container');
if (progressBar) {
  progressBar.addEventListener('mousedown', handleMouseDown);
  progressBar.addEventListener('touchstart', handleTouchStart, { passive: false });
}
```

## 🎯 Expected Behavior

### Working Areas (Current):
- ✅ Nav dot #1
- ✅ Nav dot #2
- ✅ Empty space between/around dots
- ❌ Graduation progress bar percentage text
- ❌ Graduation progress bar track
- ❌ Graduation progress bar fill
- ✅ Graduation info icon (clickable, not draggable)

### After Fix (Target):
- ✅ Nav dot #1
- ✅ Nav dot #2  
- ✅ Empty space between/around dots
- ✅ Graduation progress bar percentage text
- ✅ Graduation progress bar track
- ✅ Graduation progress bar fill
- ✅ Graduation info icon (clickable, not draggable)

## 📝 Manual Testing Procedure

1. **Open app in browser**
2. **Find a coin with graduation progress bar**
3. **Test nav dots (baseline)**:
   - Hover over left nav dot
   - Cursor should show "grab" 👆
   - Click and drag left/right
   - Charts should scroll ✅
   
4. **Test progress bar (issue)**:
   - Hover over progress bar (the colored bar itself)
   - Cursor should show "grab" 👆
   - Click and drag left/right
   - **Expected**: Charts should scroll
   - **Actual**: ???

5. **Test mobile (if on device/simulator)**:
   - Touch progress bar
   - Swipe left/right
   - **Expected**: Charts should scroll
   - **Actual**: ???

## 🚨 If Still Not Working

### Nuclear Option: Recreate Event Listeners
Move the `chartNavRef` to wrap ONLY the interactive area, or create a second ref specifically for the progress bar.

### Alternative: CSS Only Solution
Use `pointer-events: none` on everything EXCEPT the parent container, forcing all events to the parent:

```css
.chart-nav-dots-top * {
  pointer-events: none !important;
}

.chart-nav-dots-top {
  pointer-events: auto !important;
}

.graduation-info-icon {
  pointer-events: auto !important;  /* Exception for clickable icon */
}
```

## 📊 Current Status

- ✅ Cursor inheritance added to CSS
- ✅ pointerEvents removed from progress bar
- ✅ Wheel event handler added
- ❓ Touch/Mouse events on progress bar - NEEDS TESTING

## 🔄 Next Steps

1. Test with the browser debug console commands above
2. Identify which event is not firing (mousedown, touchstart, both)
3. Check if events are being blocked or not bubbling
4. Apply appropriate fix based on findings

---

**Created**: October 19, 2025  
**Issue**: Progress bar not scrollable  
**Status**: 🔄 In Progress - Awaiting Test Results
