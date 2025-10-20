# Progress Bar Event Debug Guide

## 🎯 Goal
Add comprehensive debug logging to all event handlers (touch, mouse, wheel) to verify if events are firing when interacting with the progress bar area, and diagnose why the scroll functionality isn't working.

## 📊 Debug Logging Added

### 1. Touch Events
```javascript
handleTouchStart:
- Logs: 🔵 TouchStart fired on: [className], target: [element]
- Tracks: Which element received the touch

handleTouchMove:
- Logs: 🟢 TouchMove fired, isDragging: [bool], target: [className]
- Logs: 📊 Delta X: [value], Delta Y: [value], isHorizontalSwipe: [bool]
- Logs: ✅ Horizontal swipe detected! (when threshold met)
- Logs: 📈 Scrolling chart to: [scroll position]
```

### 2. Mouse Events
```javascript
handleMouseDown:
- Logs: 🖱️ MouseDown fired on: [className], target: [element]

handleMouseMove:
- Logs: 🖱️ MouseMove fired, isDown: [bool], target: [className]
- Logs: 📊 Mouse Delta X: [value], Current scroll: [position]
- Logs: 📈 Scrolling chart to: [new position]
```

### 3. Wheel Events
```javascript
handleWheel:
- Logs: 🎡 Wheel event fired, deltaX: [value], deltaY: [value], target: [className]
- Logs: 📊 isHorizontalScroll: [bool], abs(deltaX): [value]
- Logs: ✅ Horizontal scroll detected! Preventing default and scrolling chart.
- Logs: 📈 Scrolling chart to: [new position]
```

## 🧪 Testing Instructions

### Step 1: Open Browser Console
1. Start the frontend: `npm run dev` in `/frontend`
2. Open the app in your browser
3. Open DevTools Console (F12 or Cmd+Option+I)

### Step 2: Test Progress Bar Area
1. **Mouse Drag Test:**
   - Click and drag over the graduation progress bar
   - Expected logs:
     ```
     🖱️ MouseDown fired on: graduation-progress-container, target: [element]
     🖱️ MouseMove fired, isDown: true, target: [className]
     📊 Mouse Delta X: [value], Current scroll: [position]
     📈 Scrolling chart to: [new position]
     ```
   - If NO logs appear → Events aren't reaching the handler
   - If logs appear but scroll doesn't happen → Logic issue

2. **Touch Swipe Test (on mobile/trackpad):**
   - Swipe horizontally over the progress bar
   - Expected logs:
     ```
     🔵 TouchStart fired on: [className], target: [element]
     🟢 TouchMove fired, isDragging: true, target: [className]
     📊 Delta X: [value], Delta Y: [value], isHorizontalSwipe: [bool]
     ✅ Horizontal swipe detected!
     📈 Scrolling chart to: [position]
     ```

3. **Trackpad Horizontal Scroll Test:**
   - Use two-finger horizontal swipe on trackpad over progress bar
   - Expected logs:
     ```
     🎡 Wheel event fired, deltaX: [value], deltaY: [value], target: [className]
     📊 isHorizontalScroll: true, abs(deltaX): [value]
     ✅ Horizontal scroll detected! Preventing default and scrolling chart.
     📈 Scrolling chart to: [position]
     ```

### Step 3: Compare with Working Area
1. Test the same interactions over the **nav dots area** (known working)
2. Compare logs to identify differences
3. Test over the **chart graph area** itself
4. Note any differences in event targets or behavior

## 🔍 Diagnostic Questions

### If NO logs appear when interacting with progress bar:
- ❓ Are events being blocked by pointer-events CSS?
- ❓ Is there an overlay or higher z-index element blocking events?
- ❓ Is the progress bar outside the chartNavRef container?
- ❓ Are event listeners attached to the correct element?

### If logs appear but scroll doesn't work:
- ❓ Is `chartsContainerRef.current` null or undefined?
- ❓ Is the scroll position calculation correct?
- ❓ Is the charts container scrollable (overflow-x: scroll)?
- ❓ Is preventDefault() being called too early?

### If events work on nav dots but not progress bar:
- ❓ Is there a CSS difference (pointer-events, z-index, position)?
- ❓ Are child elements of progress bar blocking events?
- ❓ Is the progress bar's DOM structure different?

## 🛠️ Expected Findings

### Scenario A: Events Not Firing
**Symptoms:**
- No console logs when interacting with progress bar
- Grab cursor appears but nothing happens

**Likely Causes:**
1. Progress bar or children have `pointer-events: none`
2. Overlay element blocking events
3. Progress bar not inside `chartNavRef`
4. Event listeners not attached due to ref timing

**Solutions:**
- Add `pointer-events: auto` to progress bar
- Check for overlays with higher z-index
- Verify progress bar is child of chartNavRef
- Add null checks for refs

### Scenario B: Events Firing But Not Scrolling
**Symptoms:**
- Console logs appear
- No chart movement

**Likely Causes:**
1. `chartsContainerRef` is null
2. Charts container not scrollable
3. Logic preventing scroll (e.g., deltaX threshold too high)

**Solutions:**
- Add null check: `if (!chartsContainer) return;`
- Verify charts container has `overflow-x: scroll`
- Lower deltaX threshold or remove it

### Scenario C: Inconsistent Behavior
**Symptoms:**
- Works sometimes, not others
- Works on nav dots but not progress bar

**Likely Causes:**
1. Event bubbling stopped by child elements
2. Child elements capturing events
3. CSS specificity issues

**Solutions:**
- Use event capture: `{ capture: true }`
- Add `pointer-events: none` to non-interactive children
- Increase specificity of working CSS

## 📝 Next Steps After Testing

1. **Run all 3 tests** (mouse drag, touch swipe, trackpad scroll)
2. **Copy console output** for each test
3. **Document findings:**
   - Which events fire?
   - Which don't?
   - What are the target elements?
4. **Compare behavior** between progress bar and nav dots
5. **Identify root cause** from diagnostic questions
6. **Apply targeted fix** based on findings

## 🎯 Success Criteria
- All 3 event types log when interacting with progress bar
- Chart scrolls smoothly when dragging/swiping over progress bar
- Behavior matches nav dots area exactly
- No console errors or warnings

---

**File Modified:** `frontend/src/components/CoinCard.jsx`
**Lines Changed:** Event handler functions (~630-730)
**Commit Message:** "Add comprehensive debug logging to chart navigation event handlers for progress bar scroll diagnostics"
