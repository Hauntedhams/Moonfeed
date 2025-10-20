# 📱 Chart Horizontal Scroll - Visual Guide

## 🎯 Overview
This visual guide explains how users interact with the horizontal chart scroll feature.

---

## 📐 Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  COIN CARD                                              │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 🎯 Nav Dots Area (Draggable/Swipeable)           │ │
│  │                                                   │ │
│  │  ⚫ ⚪  [═══════════════ 85% ════] ❓            │ │
│  │  ^  ^   Graduation Progress Bar   Info          │ │
│  │  │  │                                             │ │
│  │  │  └── Advanced Chart (Page 1)                  │ │
│  │  └───── Clean Chart (Page 0) - ACTIVE            │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 📊 Charts Container (Horizontal Scroll)          │ │
│  │                                                   │ │
│  │  ╔════════════════╗╔════════════════╗            │ │
│  │  ║  Page 0        ║║  Page 1        ║            │ │
│  │  ║  (Clean Chart) ║║ (Advanced)     ║            │ │
│  │  ║                ║║                ║            │ │
│  │  ║  [Line Chart]  ║║ [Dexscreener]  ║            │ │
│  │  ║                ║║                ║            │ │
│  │  ╚════════════════╝╚════════════════╝            │ │
│  │   ^                                               │ │
│  │   └── Currently visible (Page 0)                 │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 🎮 Interaction Methods

### Method 1: Click/Tap Nav Dots
```
User Action:
┌──────┐
│ Tap  │ ⚫ ⚪  →  ⚪ ⚫
└──────┘

Result: Smooth scroll animation to selected page
```

### Method 2: Swipe on Nav Area (Mobile)
```
Touch Start:
┌─────────────────────────┐
│ 👆 [Finger touches]     │
│  ⚫ ⚪                   │
└─────────────────────────┘

Swipe Left:
┌─────────────────────────┐
│ 👆 ← [Swipe direction]  │
│  ⚫ ⚪                   │
└─────────────────────────┘

Result:
┌─────────────────────────┐
│  ⚪ ⚫  [Chart scrolls]  │
└─────────────────────────┘
```

### Method 3: Drag on Nav Area (Desktop)
```
Mouse Down:
┌─────────────────────────┐
│ 🖱️ [Cursor: grab]      │
│  ⚫ ⚪                   │
└─────────────────────────┘

Drag Left:
┌─────────────────────────┐
│ 🖱️ ← [Cursor: grabbing]│
│  ⚫ ⚪                   │
└─────────────────────────┘

Result:
┌─────────────────────────┐
│  ⚪ ⚫  [Chart scrolls]  │
└─────────────────────────┘
```

---

## 🔄 State Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│              USER INTERACTION                       │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐    ┌────────────────┐
│ Click Nav Dot │    │ Swipe/Drag     │
└───────┬───────┘    │ on Nav Area    │
        │            └────────┬───────┘
        │                     │
        │            ┌────────▼─────────────┐
        │            │ Touch/Mouse Handler  │
        │            │ Calculates deltaX    │
        │            │ Updates scrollLeft   │
        │            └────────┬─────────────┘
        │                     │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────────┐
        │ Container.scrollTo()    │
        │ or scrollLeft = value   │
        └──────────┬──────────────┘
                   │
        ┌──────────▼──────────────┐
        │ CSS Scroll Snap         │
        │ Snaps to nearest page   │
        └──────────┬──────────────┘
                   │
        ┌──────────▼──────────────┐
        │ 'scroll' Event Fires    │
        └──────────┬──────────────┘
                   │
        ┌──────────▼──────────────┐
        │ handleChartScroll()     │
        │ Calculates current page │
        └──────────┬──────────────┘
                   │
        ┌──────────▼──────────────┐
        │ setCurrentChartPage()   │
        │ Updates active dot      │
        └──────────┬──────────────┘
                   │
        ┌──────────▼──────────────┐
        │ UI Updates Complete     │
        │ ⚪ ⚫ Active dot shown  │
        └─────────────────────────┘
```

---

## 📊 Scroll Position Calculation

```
Container Width: 400px
Scroll Width: 800px (2 pages × 400px)

Page 0 (Clean Chart):
┌────────────────┐
│ scrollLeft: 0px│ ← Current position
└────────────────┘
currentPage = Math.round(0 / 400) = 0 ✅

Page 1 (Advanced):
┌────────────────┐
│scrollLeft:400px│ ← After scroll
└────────────────┘
currentPage = Math.round(400 / 400) = 1 ✅

During Scroll (transitioning):
┌────────────────┐
│scrollLeft:200px│ ← Mid-transition
└────────────────┘
currentPage = Math.round(200 / 400) = 1
(Snaps to nearest page)
```

---

## 🎨 Visual Feedback States

### Nav Dots Area States
```
Default (Idle):
┌──────────────────────────────┐
│ background: rgba(255,255,255,0.02)
│ cursor: grab 👆               │
│  ⚫ ⚪                         │
└──────────────────────────────┘

Hover:
┌──────────────────────────────┐
│ background: rgba(255,255,255,0.04)
│ cursor: grab 👆               │
│  ⚫ ⚪                         │
└──────────────────────────────┘

Active (Dragging):
┌──────────────────────────────┐
│ background: rgba(255,255,255,0.06)
│ cursor: grabbing 🖐           │
│  ⚫ ⚪                         │
└──────────────────────────────┘
```

### Active Dot Indicators
```
Clean Chart Active:
⚫ ⚪
│
└── Dark dot = Active
    Light dot = Inactive

Advanced Chart Active:
⚪ ⚫
   │
   └── Dark dot = Active
       Light dot = Inactive
```

---

## 📱 Touch Detection Logic

```
Touch Start → Track Initial Position
         │
         ▼
Touch Move → Calculate Movement
         │
         ├─── deltaX (horizontal)
         └─── deltaY (vertical)
         │
         ▼
   Is deltaX > 10px ?
   Is deltaX > (deltaY × 2) ?
         │
    YES  │  NO
    ▼    │   ▼
Enable   │  Allow
Horiz.   │  Vertical
Scroll   │  Scroll
    │    │   │
    ▼    │   ▼
Update   │  Pass event
scrollLeft   to feed
    │    │
    ▼    ▼
Prevent  Keep
vertical scrolling
scroll   feed
```

**Key Insight**: 
- Horizontal movement must be **>10px** AND **>2× vertical movement**
- This prevents accidental horizontal scrolls during vertical feed scrolling

---

## 🚀 Performance Optimizations

### 1. Scroll Speed Multiplier
```javascript
// User swipes 100px → Chart scrolls 150px
const scrollDelta = 100;
const newScroll = scrollLeft + (scrollDelta × 1.5);
//                                            ^^^^
//                                         1.5x speed!
```

**Why?** Makes interaction feel more responsive and less "sticky"

### 2. Conditional Chart Rendering
```jsx
Page 0 (Visible):
┌───────────────────┐
│ ✅ Render chart   │
│ <PriceHistory />  │
└───────────────────┘

Page 1 (Hidden):
┌───────────────────┐
│ ⏸️ Placeholder    │
│ "Chart will load" │
└───────────────────┘
```

**Why?** Saves CPU/GPU by not rendering charts that aren't visible

### 3. CSS Hardware Acceleration
```css
scroll-behavior: smooth;  /* Uses GPU */
-webkit-overflow-scrolling: touch; /* iOS optimization */
scroll-snap-type: x mandatory; /* Native browser snapping */
```

**Why?** Leverages browser's native scroll performance

---

## 🧪 Testing Scenarios

### ✅ Scenario 1: Quick Swipe (Mobile)
```
Start: Page 0 ⚫ ⚪
Action: Quick left swipe (300ms duration)
Expected: Smooth scroll to Page 1 ⚪ ⚫
Verify: Charts snap exactly, no overshoot
```

### ✅ Scenario 2: Slow Drag (Desktop)
```
Start: Page 0 ⚫ ⚪
Action: Slow mouse drag 50px left
Expected: Partial scroll, then snap to Page 1 ⚪ ⚫
Verify: Cursor changes grab → grabbing → grab
```

### ✅ Scenario 3: Dot Navigation
```
Start: Page 0 ⚫ ⚪
Action: Click right dot
Expected: Smooth animated scroll to Page 1 ⚪ ⚫
Duration: ~500ms animation
```

### ✅ Scenario 4: Vertical Scroll (No Interference)
```
Start: Scrolling feed vertically
Action: Touch moves mostly vertical (deltaY > deltaX)
Expected: Charts do NOT scroll horizontally
Verify: Only feed scrolls, charts stay put
```

### ✅ Scenario 5: Rapid Page Switching
```
Start: Page 0 ⚫ ⚪
Action: Quickly click right dot → left dot → right dot
Expected: Smooth animations queue correctly
Verify: No jank, ends on correct page
```

---

## 🐛 Troubleshooting Guide

### Issue: Charts don't scroll at all
```
Check:
1. Container has overflow-x: auto ✓
2. Scroll width > container width ✓
3. Chart pages have flex: 0 0 100% ✓
4. Event listeners attached ✓
```

### Issue: Scrolls but doesn't snap
```
Check:
1. scroll-snap-type: x mandatory ✓
2. Chart pages have scroll-snap-align: start ✓
3. No conflicting scroll-snap-stop ✓
```

### Issue: Active dot doesn't update
```
Check:
1. Scroll event listener attached ✓
2. handleChartScroll() is firing ✓
3. currentChartPage state updating ✓
4. Nav dots reading state correctly ✓
```

### Issue: Vertical scroll breaks
```
Check:
1. Touch direction detection working ✓
2. preventDefault() only for horizontal ✓
3. deltaX > (deltaY × 2) condition ✓
4. touch-action: none on nav area ✓
```

---

## 🎯 Key Files Reference

```
📁 frontend/src/components/
   ├── 📄 CoinCard.jsx
   │   ├── Lines 44: Refs (chartsContainerRef, chartNavRef)
   │   ├── Lines 581-590: handleChartScroll()
   │   ├── Lines 593-608: navigateToChartPage()
   │   ├── Lines 622-670: Touch handlers
   │   ├── Lines 672-698: Mouse handlers
   │   ├── Lines 611-708: Event listeners
   │   ├── Lines 1276-1388: Nav dots JSX
   │   └── Lines 1389-1450: Charts container JSX
   │
   └── 📄 CoinCard.css
       ├── Lines 895-980: Nav dots styles
       └── Lines 982-1030: Charts container styles
```

---

## 💡 Pro Tips

1. **For best swipe feel**: Keep 1.5x scroll multiplier
2. **For accessibility**: Nav dots should be at least 32×32px touch target
3. **For performance**: Use `will-change: scroll-position` sparingly
4. **For debugging**: Use `monitorScroll()` function from test script
5. **For UX**: Always provide visual feedback (cursor, hover states)

---

**Visual Guide Version**: 1.0  
**Last Updated**: October 19, 2025  
**Created for**: Moonfeed Alpha Chart Navigation
