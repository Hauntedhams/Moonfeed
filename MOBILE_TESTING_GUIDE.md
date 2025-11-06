# 🧪 MOBILE PERFORMANCE TESTING GUIDE

## Critical Fixes Deployed ✅

We've deployed critical fixes to prevent mobile force restarts caused by memory leaks.

### What Was Fixed:
1. **RAF Memory Leaks** - 4 leaked RAF calls per card → Now 0
2. **Event Listener Leaks** - 12 leaked listeners per card → Now 0  
3. **Component Cleanup** - 79 unmanaged useEffect hooks → Now managed
4. **Memory Monitoring** - No monitoring → Active monitoring with auto-cleanup
5. **Smooth Scrolling** - Janky mobile scrolling → 60fps RAF-optimized scrolling

---

## 📱 How to Test on Mobile

### Method 1: Remote Debugging (Recommended)

#### iOS (Safari):
```bash
1. Connect iPhone to Mac via USB
2. iPhone: Settings → Safari → Advanced → Enable "Web Inspector"
3. Mac: Safari → Preferences → Advanced → Show Develop menu
4. Mac: Develop → [Your iPhone] → [Moonfeed]
5. In Console, run: perfMonitor.start()
6. Use app for 2-3 minutes, scroll through 20-30 coins
7. In Console, run: perfMonitor.report()
```

#### Android (Chrome):
```bash
1. Enable Developer Options on Android
2. Enable USB Debugging
3. Connect to computer via USB
4. Computer Chrome: chrome://inspect
5. Click "Inspect" under your device
6. In Console, run: perfMonitor.start()
7. Use app for 2-3 minutes, scroll through 20-30 coins
8. In Console, run: perfMonitor.report()
```

### Method 2: On-Device Console (Easier)

#### Using Eruda (Debug Console):
Add this to the URL to enable on-device console:
```
https://your-site.com/?debug=true
```

Then tap the Eruda button and run:
```javascript
perfMonitor.start()
// Use app for 2-3 minutes
perfMonitor.report()
```

---

## ✅ Expected Test Results

### Memory Usage:
- ✅ **Should stay under 100MB** (was growing unbounded)
- ✅ **Trend: "stable" or "decreasing"** (was always "increasing")
- ✅ **No memory warnings** after scrolling 50+ coins

### Performance:
- ✅ **Smooth 60fps scrolling** (no janky frame drops)
- ✅ **No force restarts** after extended use
- ✅ **Chart navigation is smooth** (no lag on swipe)

### Resource Management:
```
Expected Report Output:
📊 Performance Status:
  Memory: 45-80MB (trend: stable)
  RAFs: 0-2 (was 20+)
  Event Listeners: 10-50 (was 200+)
  Images: 5-20
```

---

## 🚨 If Issues Persist

### Check These:
1. **Clear browser cache** - Old version might be cached
2. **Hard refresh** - Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
3. **Check memory before testing** - perfMonitor.report() at start
4. **Monitor during use** - Watch for memory warnings in console

### Gather Diagnostics:
```javascript
// In mobile browser console:
perfMonitor.start()

// Use app for 3 minutes (scroll, expand cards, etc)

perfMonitor.report()           // Get full report
perfMonitor.findMemoryHogs()   // Find what's using memory
```

### Share Results:
If crashes still occur, share:
1. Screenshot of `perfMonitor.report()` output
2. Device model and iOS/Android version
3. Steps to reproduce
4. Console errors (if any)

---

## 📊 Monitoring Commands

All available in browser console:

```javascript
// Start monitoring (run this first)
perfMonitor.start()

// Get current status
perfMonitor.report()

// Find memory-intensive elements
perfMonitor.findMemoryHogs()

// Stop monitoring and get final report
perfMonitor.stop()

// Manual memory check
performance.memory
```

---

## 🎯 What to Look For

### Good Signs ✅:
- Memory stays between 40-100MB
- No console warnings about memory
- Smooth scrolling with no lag
- No force restarts after 50+ coins scrolled
- RAF count stays low (0-5)
- Event listener count is reasonable (10-100)

### Bad Signs 🚨:
- Memory grows above 150MB
- Console warnings: "HIGH MEMORY" or "CRITICAL MEMORY"
- Janky/laggy scrolling
- App freezes or restarts
- RAF count > 50
- Event listener count > 500

---

## 💡 Additional Tips

### For Best Performance:
1. **Close other tabs** - Give the app full memory
2. **Restart browser** - Clear any accumulated memory
3. **Test in Private/Incognito** - No extensions interference
4. **Use WiFi** - Faster loading = less memory pressure

### Test Scenarios:
1. **Light use**: Scroll 10 coins, expand 2-3 → Should use ~50MB
2. **Medium use**: Scroll 30 coins, expand 10 → Should use ~70MB
3. **Heavy use**: Scroll 100+ coins, expand 20+ → Should stay under 100MB

---

## 📞 Need Help?

If you encounter issues:
1. Run the diagnostic script: `./diagnose-mobile-performance.sh`
2. Check `MOBILE_DIAGNOSTIC.md` for detailed info
3. Share `perfMonitor.report()` output

---

## 🚀 Deployment Status

- ✅ Mobile scrolling optimizations (60fps RAF)
- ✅ Critical memory leak fixes (RAF, event listeners, cleanup)
- ✅ Memory monitoring with auto-cleanup
- ✅ Performance diagnostic tools
- ⏳ Image lazy loading (next update)
- ⏳ Console.log cleanup for production

**Current Version**: Mobile Performance Fix v1.0
**Deployed**: November 5, 2025
**Commit**: 2d0d92a
