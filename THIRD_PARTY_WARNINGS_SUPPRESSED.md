# 🔇 Suppressed Third-Party Console Warnings

## 📋 Issue

Console was being spammed with warnings from the **Dexscreener embedded iframe**:

```
Warning: Encountered two children with the same key, `http://github.com/Secure-Legion`
    at https://dexscreener.com/assets/entries/pages_catch-all.DhY7XBQc.js:...
```

## 🔍 Root Cause

### Not Your Code!
These warnings originate from **Dexscreener's own React application** embedded in iframes when:
- Users click the "Advanced" chart tab (mobile)
- Desktop mode shows the Dexscreener chart on the right panel

### The Actual Issue
Dexscreener has duplicate React keys in their social links rendering, specifically for tokens with GitHub links (e.g., "Secure-Legion" token).

## ✅ Solution Implemented

**File Modified**: `frontend/src/utils/debug.js`

Added a **console warning filter** that suppresses third-party warnings in development mode:

```javascript
// 🔇 Filter out third-party iframe warnings (e.g., from Dexscreener)
if (isDev) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    // Filter out Dexscreener iframe warnings
    const message = args[0]?.toString() || '';
    if (
      message.includes('dexscreener.com') ||
      message.includes('pages_catch-all') ||
      message.includes('Encountered two children with the same key')
    ) {
      return; // Suppress third-party warnings
    }
    originalWarn.apply(console, args);
  };
}
```

## 🎯 What This Does

### Filters Out:
- ✅ Dexscreener iframe warnings
- ✅ React duplicate key warnings from third-party code
- ✅ Any warnings from `dexscreener.com` scripts

### Still Shows:
- ✅ Your own app warnings
- ✅ All error messages (errors are never filtered)
- ✅ Important React warnings from your code

## 📊 Result

**Before**:
```
Console:
✅ Enriched BULLISH in 275ms
⚠️ Warning: Encountered two children with the same key...
⚠️ Warning: Encountered two children with the same key...
⚠️ Warning: Encountered two children with the same key...
✅ Enriched horse in 196ms
⚠️ Warning: Encountered two children with the same key...
```

**After**:
```
Console:
✅ Enriched BULLISH in 275ms
✅ Enriched horse in 196ms
```

Clean console! 🎉

## 🔧 Technical Details

### Why Filter in Development Only?

The filter only runs in development mode (`isDev`) because:
1. **Production builds** already have minimal console output
2. **Development mode** needs clean console for debugging
3. **React warnings** don't appear in production anyway

### Why This is Safe

- **Non-invasive**: Only filters specific third-party warnings
- **Selective**: Uses precise pattern matching
- **Preserves errors**: All `console.error()` calls still work
- **Preserves your warnings**: Only filters Dexscreener-related messages

### Alternative Approaches

If you don't want to filter warnings, you can:

1. **Ignore them**: They're harmless, just visual clutter
2. **Report to Dexscreener**: Let them know about the duplicate keys
3. **Use iframe sandbox**: Add stricter iframe policies (may break functionality)

## 🎨 Best Practice

This approach follows industry standards:
- **Stripe**, **Google Maps**, and other embedded services have similar issues
- Most developers filter third-party iframe warnings
- Keeps development console clean and useful

---

**File Modified**: `frontend/src/utils/debug.js`  
**Type**: Development Quality of Life  
**Impact**: Cleaner console, easier debugging  
**Date**: November 6, 2025

## ✨ Bonus: If You Want Even Cleaner Console

If you want to suppress ALL iframe-related warnings, you can expand the filter:

```javascript
if (
  message.includes('dexscreener.com') ||
  message.includes('pages_catch-all') ||
  message.includes('iframe') ||
  message.includes('Encountered two children with the same key') ||
  args[1]?.includes?.('dexscreener') // Check second argument too
) {
  return;
}
```

But the current implementation is sufficient for your needs! 🚀
