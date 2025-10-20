# 🔧 BLACK SCREEN FIX - React Hooks Order Violation

## 🐛 Problem

**Black screen** with error in console:
```
Uncaught ReferenceError: Cannot access 'enrichmentCompleted' before initialization
```

---

## 🔍 Root Cause

**React Hooks Order Violation** in `CoinCard.jsx`:

The `enrichmentCompleted` state was being **used in a useEffect BEFORE it was declared**, which violates the Rules of Hooks:

```javascript
// ❌ WRONG ORDER (causes error):

// Line 63: useEffect uses enrichmentCompleted
useEffect(() => {
  if (isEnriched && !enrichmentCompleted) { // ❌ Used here
    setEnrichmentCompleted(true);
  }
}, [enrichmentCompleted]);

// Line 87: enrichmentCompleted declared LATER
const [enrichmentCompleted, setEnrichmentCompleted] = useState(false); // ❌ Declared after use!
```

**Why this breaks:**
- React processes hooks in order from top to bottom
- When the `useEffect` runs, `enrichmentCompleted` doesn't exist yet
- This causes a `ReferenceError` and crashes the app
- Black screen appears because React can't render the component

---

## ✅ Solution

**Move the state declaration BEFORE the useEffect that uses it:**

```javascript
// ✅ CORRECT ORDER:

// Line 85: Declare enrichmentCompleted state FIRST
const [enrichmentRequested, setEnrichmentRequested] = useState(false);
const [enrichmentCompleted, setEnrichmentCompleted] = useState(false); // ✅ Declared first

// Line 89: THEN use it in useEffect
useEffect(() => {
  if (isEnriched && !enrichmentCompleted) { // ✅ Now it exists!
    setEnrichmentCompleted(true);
  }
}, [isEnriched, enrichmentCompleted, coin.symbol]);
```

---

## 🛠️ What Changed

**File**: `frontend/src/components/CoinCard.jsx`

**Before** (lines 49-90):
```javascript
const isEnriched = !!(/* ... */);

// ❌ useEffect using enrichmentCompleted BEFORE it's declared
useEffect(() => {
  if (isEnriched && !enrichmentCompleted) {
    setEnrichmentCompleted(true);
  }
}, [isEnriched, enrichmentCompleted]);

const isMobile = useRef(/* ... */).current;
// ... other hooks ...

// ❌ enrichmentCompleted declared TOO LATE
const [enrichmentCompleted, setEnrichmentCompleted] = useState(false);
```

**After** (fixed order):
```javascript
const isEnriched = !!(/* ... */);

const isMobile = useRef(/* ... */).current;
// ... other hooks ...

// ✅ State declared FIRST
const [enrichmentRequested, setEnrichmentRequested] = useState(false);
const [enrichmentCompleted, setEnrichmentCompleted] = useState(false);

// ✅ useEffect using enrichmentCompleted AFTER it's declared
useEffect(() => {
  if (isEnriched && !enrichmentCompleted) {
    setEnrichmentCompleted(true);
  }
}, [isEnriched, enrichmentCompleted, coin.symbol]);
```

---

## 📚 React Rules of Hooks

### Rule 1: Only Call Hooks at the Top Level
✅ Don't call hooks inside loops, conditions, or nested functions  
✅ Call hooks in the **same order** on every render

### Rule 2: Only Call Hooks from React Functions
✅ Call hooks from React function components  
✅ Call hooks from custom hooks

### Rule 3: Declare State Before Using It
✅ **Always declare `useState` BEFORE using the state in other hooks**  
❌ **Never reference a state variable before it's declared**

---

## 🧪 Testing

1. **Refresh the app** - Should now load normally
2. **Check console** - No more `ReferenceError`
3. **Verify UI** - Feed should display coins
4. **Test enrichment** - Charts should auto-load on mobile after enrichment

---

## 🎯 Key Takeaway

**Always declare `useState` hooks BEFORE using them in other hooks or effects.**

This is why React has the **Rules of Hooks** - to ensure consistent hook order on every render.

---

**Status**: ✅ FIXED  
**Impact**: Critical - App was completely broken (black screen)  
**Lesson**: Always respect Rules of Hooks order
