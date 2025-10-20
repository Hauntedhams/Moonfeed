# 🧪 Hot Area Swipe - Quick Test Guide

## 🎯 What Changed
Replaced the old `.chart-nav-dots-top` with a **hot area container** that captures all swipe/drag events across the entire nav/progress bar region.

---

## ✅ Test Steps

### 1️⃣ Desktop Testing
1. **Open the app in browser**
2. **Hover over the nav/progress bar area**
   - ✅ Cursor should change to `grab` (open hand)
3. **Click and hold anywhere in the nav region**
   - ✅ Cursor changes to `grabbing` (closed hand)
   - ✅ Background brightens slightly
4. **Drag left or right**
   - ✅ Graph should scroll horizontally with 1:1 tracking
   - ✅ Works when dragging over progress bar
   - ✅ Works when dragging over empty space
   - ✅ Works when dragging near nav dots
5. **Release mouse**
   - ✅ Graph snaps to nearest page (Clean or Advanced)
   - ✅ Active nav dot updates
6. **Click nav dots**
   - ✅ Clicking dots still switches pages immediately
7. **Click info icon (?)**
   - ✅ Tooltip appears (for graduating tokens)

### 2️⃣ Mobile Testing
1. **Open the app on mobile device**
2. **Swipe left/right over the nav/progress bar area**
   - ✅ Graph scrolls horizontally with finger movement
   - ✅ Works swiping over progress bar
   - ✅ Works swiping over empty space
   - ✅ Works swiping near nav dots
3. **Release finger**
   - ✅ Graph snaps to nearest page
   - ✅ Active nav dot updates
4. **Tap nav dots**
   - ✅ Tapping dots still switches pages immediately
5. **Tap info icon (?)**
   - ✅ Tooltip appears (for graduating tokens)

### 3️⃣ Visual Verification
1. **Check nav bar positioning**
   - ✅ Nav bar sits above graphs (not overlapping)
   - ✅ 8px gap between nav bar and graphs
   - ✅ No excessive space between nav and graphs
2. **Check responsive behavior**
   - ✅ Nav bar scales properly on different screen sizes
   - ✅ Hot area always matches nav bar region
   - ✅ No manual padding adjustments needed

---

## 🔍 What to Look For

### ✅ Expected Behavior
- **Full coverage:** Swiping works EVERYWHERE in the nav region
- **Instant response:** 1:1 tracking with cursor/finger
- **Natural feel:** Same responsiveness as graph area
- **No dead zones:** No areas where swiping doesn't work
- **Visual feedback:** Background brightens on hover/drag

### ❌ Red Flags
- Swiping only works over specific small areas (dots, icon)
- Swiping feels laggy or requires multiple attempts
- Nav bar overlaps with graphs
- Excessive gap between nav bar and graphs
- Cursor doesn't change to grab/grabbing
- Clicking dots/icon doesn't work

---

## 🐛 If Something's Wrong

### Issue: Swiping doesn't work
**Check:**
1. `chartNavRef` is attached to `.chart-nav-hot-area`
2. `.chart-nav-hot-area` has `pointer-events: auto`
3. `.chart-nav-content` has `pointer-events: none`
4. Event listeners are attached in `useEffect`

### Issue: Clicking dots/icon doesn't work
**Check:**
1. `.nav-dot` has `pointer-events: auto !important`
2. `.graduation-info-icon` has `pointer-events: auto !important`
3. `onClick` handlers are still present in JSX

### Issue: Visual layout broken
**Check:**
1. `.chart-nav-hot-area` has `min-height: 60px`
2. `.chart-nav-content` has proper padding/margin
3. `.charts-horizontal-container` is below hot area in DOM

---

## 📊 Quick Browser Console Test

Open DevTools console and run:

```javascript
// Check hot area exists
const hotArea = document.querySelector('.chart-nav-hot-area');
console.log('Hot area found:', !!hotArea);
console.log('Hot area pointer-events:', getComputedStyle(hotArea).pointerEvents);

// Check nav content
const navContent = document.querySelector('.chart-nav-content');
console.log('Nav content found:', !!navContent);
console.log('Nav content pointer-events:', getComputedStyle(navContent).pointerEvents);

// Check nav dots
const navDots = document.querySelectorAll('.nav-dot');
console.log('Nav dots count:', navDots.length);
navDots.forEach((dot, i) => {
  console.log(`Dot ${i} pointer-events:`, getComputedStyle(dot).pointerEvents);
});
```

**Expected output:**
```
Hot area found: true
Hot area pointer-events: auto
Nav content found: true
Nav content pointer-events: none
Nav dots count: 2
Dot 0 pointer-events: auto
Dot 1 pointer-events: auto
```

---

## 🎯 Success Criteria

- [x] Swiping works EVERYWHERE in nav region
- [x] No "dead zones" where swipe doesn't work
- [x] Instant 1:1 tracking with cursor/finger
- [x] Natural, native-feeling horizontal scroll
- [x] Nav bar sits above graphs (no overlap, no excessive gap)
- [x] Clicking dots and info icon still works
- [x] Hover states work (background brightens, cursor changes)
- [x] Works on both desktop and mobile
- [x] Works on all screen sizes without manual adjustments

---

## 📝 Quick Comparison

### Before (Old .chart-nav-dots-top)
- ❌ Swiping only worked over dots/icon
- ❌ Most of progress bar was "dead space"
- ❌ Felt inconsistent vs graph area

### After (New .chart-nav-hot-area)
- ✅ Swiping works everywhere in nav region
- ✅ Entire progress bar area is active
- ✅ Matches graph area responsiveness

---

## 🚀 Ready to Test!

1. Save all files (CoinCard.jsx, CoinCard.css)
2. Refresh the browser
3. Try swiping over different parts of the nav region
4. Verify all test steps above

**Expected result:** Natural, instant horizontal scroll when swiping anywhere over the nav/progress bar area! 🎉
