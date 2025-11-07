# 🐛 Fixed: Temporal Dead Zone Error in PriceHistoryChart

## ❌ The Problem

**Error in Console**:
```
PriceHistoryChart.jsx:486 Uncaught ReferenceError: Cannot access 'chartWidth2' before initialization
    at drawChart (PriceHistoryChart.jsx:486:35)
```

## 🔍 Root Cause

**Variable Shadowing + Temporal Dead Zone (TDZ)**

The component had a **naming conflict** between two `chartWidth` variables:

1. **Component-level** `chartWidth` (line 15):
   ```javascript
   const chartWidth = width === "100%" ? "100%" : (width || 280);
   ```

2. **Function-level** `chartWidth` (line 535):
   ```javascript
   const chartWidth = containerWidth - padding.left - padding.right;
   ```

### The Issue:
On **line 486**, the code tried to access the component-level `chartWidth`:
```javascript
const containerWidth = canvas.parentElement?.offsetWidth || 
  (typeof chartWidth === 'number' ? chartWidth : 280);
  //                  ^ Trying to access chartWidth here
```

But because JavaScript hoists the `const chartWidth` declaration from line 535, it created a **Temporal Dead Zone (TDZ)** — the local `chartWidth` exists but cannot be accessed before its declaration.

## ✅ The Solution

**Renamed the local variable** to avoid shadowing:

```javascript
// OLD (line 535):
const chartWidth = containerWidth - padding.left - padding.right;

// NEW (line 535):
const drawableWidth = containerWidth - padding.left - padding.right;
```

### Changes Made:

1. **Line 535**: Renamed `chartWidth` → `drawableWidth`
2. **Line 610**: Updated reference `chartWidth` → `drawableWidth`
3. **Line 621**: Updated reference `chartWidth` → `drawableWidth`
4. **Line 628**: Updated debug log `chartWidth` → `drawableWidth`

## 🎯 Result

- ✅ No more `ReferenceError`
- ✅ Component-level `chartWidth` is accessible throughout
- ✅ Local `drawableWidth` is clearly named and doesn't shadow
- ✅ Chart renders correctly without errors

## 📚 Technical Details

### What is Temporal Dead Zone (TDZ)?

When you declare a variable with `const` or `let` in a scope, JavaScript hoists that declaration to the top of the scope, but **you cannot access it before the actual line where it's declared**. This creates a "dead zone" from the start of the scope until the declaration line.

```javascript
function example() {
  // TDZ starts here for 'x'
  console.log(x); // ❌ ReferenceError: Cannot access 'x' before initialization
  const x = 10;   // TDZ ends here
  console.log(x); // ✅ Works fine: 10
}
```

### Why This Happened:

```javascript
function drawChart() {
  // ...
  // Line 486: Try to use 'chartWidth' (component-level)
  const containerWidth = ... chartWidth ...;
  //                          ^ But wait! There's a local 'chartWidth' declared below!
  
  // ...
  // Line 535: Declare local 'chartWidth'
  const chartWidth = containerWidth - padding.left - padding.right;
  //    ^ This declaration shadows the component-level chartWidth
  //      and creates a TDZ from function start to here
}
```

## 🎨 Best Practice

**Always use unique variable names** to avoid shadowing, especially when:
- You have component-level props/variables
- You need to create derived values in functions
- You're working with similar concepts (width, height, etc.)

Good naming examples:
- `chartWidth` (total chart area)
- `drawableWidth` (width minus padding)
- `containerWidth` (parent container width)
- `visibleWidth` (viewport width)

---

**File Modified**: `frontend/src/components/PriceHistoryChart.jsx`  
**Lines Changed**: 535, 610, 621, 628  
**Date**: November 6, 2025
