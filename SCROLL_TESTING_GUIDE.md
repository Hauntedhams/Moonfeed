# 🧪 Scroll Testing Guide - Quick Validation

## How to Test the New Scroll Behavior

The app is now running at **http://localhost:5174** with the new direction-aware hybrid scroll snap system.

---

## 🎯 Quick Tests (Do These First)

### Test 1: Basic Swipe Down
**Action:** Slowly swipe down with your finger (or trackpad)  
**Expected:** Smoothly snaps to the next coin below  
**Pass:** ✅ Lands perfectly on next coin  
**Fail:** ❌ Skips coins or snaps backwards

---

### Test 2: Basic Swipe Up
**Action:** Slowly swipe up with your finger (or trackpad)  
**Expected:** Smoothly snaps to the previous coin above  
**Pass:** ✅ Lands perfectly on previous coin  
**Fail:** ❌ Skips coins or snaps backwards

---

### Test 3: Fast Momentum Swipe
**Action:** Quickly swipe down with momentum (like TikTok)  
**Expected:** Momentum carries the scroll, then snaps to the next coin in the direction you swiped  
**Pass:** ✅ Completes in the swipe direction (no backwards snap)  
**Fail:** ❌ Snaps backwards to previous coin or skips multiple coins

---

### Test 4: Halfway Swipe and Release
**Action:** Start swiping down, stop halfway between two coins, release  
**Expected:** Completes the swipe to the next coin (doesn't go backwards)  
**Pass:** ✅ Snaps forward to complete the swipe direction  
**Fail:** ❌ Snaps backwards or gets stuck between coins

---

## 🔬 Advanced Tests (If Basic Tests Pass)

### Test 5: Tiny Scroll
**Action:** Barely scroll (like 5-10% of the screen)  
**Expected:** Stays on current coin or snaps to nearest (stable)  
**Pass:** ✅ Doesn't cause unexpected jumps  
**Fail:** ❌ Jumps to different coin unexpectedly

---

### Test 6: Mouse Wheel (Desktop Only)
**Action:** Use mouse wheel to scroll down a few notches  
**Expected:** Snaps to next coin after wheel stops  
**Pass:** ✅ Clean snap to intended coin  
**Fail:** ❌ Skips or behaves erratically

---

### Test 7: Expanded Card Lock
**Action:** 
1. Tap a coin to expand it
2. Try scrolling while expanded
3. Close the expanded card

**Expected:** Scroll is locked while expanded, unlocks after closing  
**Pass:** ✅ Can't scroll while expanded  
**Fail:** ❌ Can scroll or card moves while expanded

---

## 📱 Device-Specific Tests

### Mobile (Safari on iPhone)
- [ ] Smooth momentum scrolling with finger
- [ ] Snaps correctly after momentum stops
- [ ] No jittery or jumpy behavior
- [ ] One swipe = one coin consistently

### Mobile (Chrome on Android)
- [ ] Same smooth momentum as Safari
- [ ] Consistent snap behavior
- [ ] No browser-specific issues

### Desktop (Trackpad)
- [ ] Two-finger swipe feels natural
- [ ] Momentum handled correctly
- [ ] Snaps to correct coin after inertia

### Desktop (Mouse Wheel)
- [ ] Wheel scroll increments work
- [ ] Snaps to correct coin
- [ ] No excessive sensitivity

---

## 🐛 Common Issues and What They Mean

### Issue: "It still skips coins sometimes"
**Possible cause:** CSS snap not loading or JS logic has timing issue  
**Check:** 
- Open browser dev tools → Elements → Check if `.modern-scroller-container` has `scroll-snap-type: y proximity`
- Console logs should show "📱 Coin X/Y (direction: ↓ or ↑)"

### Issue: "It snaps backwards during momentum"
**Possible cause:** Direction tracking not working correctly  
**Check:**
- Look for console logs showing direction (↓ = down, ↑ = up)
- If direction is always "•", tracking is broken

### Issue: "It's too slow to respond"
**Possible cause:** 150ms debounce might be too long for your preference  
**Fix:** In `ModernTokenScroller.jsx` line ~709, change `150` to `100`

### Issue: "It's too aggressive on mobile"
**Possible cause:** CSS snap might need to be tuned  
**Fix:** In `ModernTokenScroller.css` line ~107, try `scroll-snap-type: y mandatory` instead of `proximity`

---

## 📊 Console Output to Look For

When scrolling, you should see logs like:
```
📱 Coin 2/20 (direction: ↓)
📱 Coin 3/20 (direction: ↓)
📱 Coin 2/20 (direction: ↑)
```

The direction indicator shows:
- `↓` = Scrolled down (to next coin)
- `↑` = Scrolled up (to previous coin)
- `•` = Direction unknown (fallback to nearest)

---

## ✅ Success Criteria

**The scroll system is working correctly if:**

1. ✅ Every swipe moves exactly **one coin** (no skipping)
2. ✅ Momentum scrolls **never snap backwards**
3. ✅ The view **always lands perfectly** on a full coin (no partial views)
4. ✅ Behavior is **consistent** on mobile and desktop
5. ✅ Scrolling feels **smooth and natural** (like TikTok)
6. ✅ Expanded cards **lock scrolling** correctly
7. ✅ **No jank or stuttering** during scroll

---

## 🎯 How to Provide Feedback

If you encounter any issues:

1. **Note which test failed** (Test 1, 2, 3, etc.)
2. **Describe the behavior** (what actually happened)
3. **Check console logs** (any errors or unexpected output?)
4. **Note your device** (iPhone Safari, Chrome Desktop, etc.)
5. **Try multiple times** (consistent issue or one-time glitch?)

Example feedback:
> "Test 3 (Fast Momentum Swipe) fails on iPhone Safari. When I swipe down quickly, it sometimes snaps back to the previous coin instead of continuing forward. Console shows direction as '↓' correctly."

---

## 🚀 Ready to Test!

1. Open **http://localhost:5174** in your browser
2. Run through **Tests 1-4** (the quick tests)
3. If those pass, try the **Advanced Tests**
4. Test on **different devices** if available
5. Report back with results! 🎉

---

**Remember:** The goal is **one swipe = one coin, every time, no matter what.**

If that works consistently, we're done! ✅
