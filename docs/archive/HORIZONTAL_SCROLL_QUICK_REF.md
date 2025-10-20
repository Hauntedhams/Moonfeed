# 🎯 Horizontal Chart Scroll - Quick Reference

## 📍 Where is the code?

### Main File: `frontend/src/components/CoinCard.jsx`

**Core Functions:**
- **handleChartScroll()** (Lines 581-590) - Tracks scroll position
- **navigateToChartPage()** (Lines 593-608) - Programmatic navigation
- **Touch handlers** (Lines 622-670) - Mobile swipe detection
- **Mouse handlers** (Lines 672-698) - Desktop drag functionality

**Key Elements:**
- **chartsContainerRef** (Line 44) - The scrollable container
- **chartNavRef** (Line 44) - The nav dots/draggable area
- **Charts container** (Lines 1389-1450) - Two pages side-by-side
- **Nav dots area** (Lines 1276-1388) - Clickable/draggable controls

---

## 🎨 How it works

### 1. **Container Setup**
```jsx
<div className="charts-horizontal-container" ref={chartsContainerRef}>
  <div className="chart-page">Clean Chart</div>
  <div className="chart-page">Advanced Chart</div>
</div>
```

### 2. **CSS Magic**
```css
.charts-horizontal-container {
  overflow-x: auto;              /* Enable horizontal scroll */
  scroll-snap-type: x mandatory; /* Snap to pages */
  scroll-behavior: smooth;       /* Smooth animations */
}
```

### 3. **Interaction Methods**

#### A. Click Nav Dots
User clicks dot → `navigateToChartPage(index)` → smooth scroll animation

#### B. Mobile Swipe
Touch start → detect horizontal movement → update `scrollLeft` → snap to page

#### C. Desktop Drag
Mouse down → drag → update `scrollLeft` → snap to page

---

## 🔑 Key Features

✅ **Scroll Speed**: 1.5x multiplier for responsive feel  
✅ **Smart Detection**: Only scrolls horizontally if `deltaX > (deltaY × 2)`  
✅ **Visual Feedback**: Cursor changes, hover states, active dots  
✅ **Performance**: Conditional rendering, hardware acceleration  
✅ **No Conflicts**: Doesn't interfere with vertical feed scrolling  

---

## 🧪 Quick Test

### Browser Console Test:
```javascript
// 1. Open DevTools console
// 2. Find the charts container
const charts = document.querySelector('.charts-horizontal-container');

// 3. Test scroll to page 1
charts.scrollTo({ left: charts.clientWidth, behavior: 'smooth' });

// 4. Test scroll back to page 0
setTimeout(() => {
  charts.scrollTo({ left: 0, behavior: 'smooth' });
}, 2000);
```

### Or use the diagnostic script:
```javascript
// Copy/paste contents of test-chart-scroll.js into console
// Then run:
testChartScroll();
```

---

## 📊 Scroll Position Math

```javascript
containerWidth = 400px (example)
scrollLeft = 0px     → Page 0 (Clean Chart)
scrollLeft = 400px   → Page 1 (Advanced Chart)

currentPage = Math.round(scrollLeft / containerWidth);
```

---

## 🎯 File Locations

| Feature | File | Lines |
|---------|------|-------|
| Scroll tracking | CoinCard.jsx | 581-590 |
| Navigation | CoinCard.jsx | 593-608 |
| Touch/Mouse | CoinCard.jsx | 622-698 |
| Container JSX | CoinCard.jsx | 1389-1450 |
| Nav dots JSX | CoinCard.jsx | 1276-1388 |
| Container CSS | CoinCard.css | 982-1030 |
| Nav dots CSS | CoinCard.css | 895-980 |

---

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| Doesn't scroll | Check `overflow-x: auto` in CSS |
| Doesn't snap | Check `scroll-snap-type: x mandatory` |
| Dots don't update | Check scroll event listener |
| Breaks vertical scroll | Check `deltaX > (deltaY × 2)` logic |

---

## 📚 Full Documentation

For complete details, see:
- **HORIZONTAL_SCROLL_DIAGNOSTIC.md** - Full technical breakdown
- **HORIZONTAL_SCROLL_VISUAL_GUIDE.md** - Visual diagrams and flows
- **test-chart-scroll.js** - Automated testing script

---

**Created**: October 19, 2025  
**Status**: ✅ Production Ready
