# Transaction Duplicate Key Fix

## Issue
React was displaying a warning:
```
Warning: Encountered two children with the same key
```

This occurred in the transaction list rendering where transaction signatures were used as React keys.

## Root Cause
Some transactions had duplicate signatures, causing React to encounter multiple children with the same key, which violates React's key uniqueness requirement.

## Solution
Changed the key from using only the signature to a combination of signature and index:

### Before:
```jsx
transactions.map((tx, index) => (
  <div key={tx.signature} className="transaction-item">
```

### After:
```jsx
transactions.map((tx, index) => (
  <div key={`${tx.signature}-${index}`} className="transaction-item">
```

## Files Modified
- `/frontend/src/components/CoinCard.jsx` - Line 1483

## Result
✅ No more duplicate key warnings
✅ Unique keys for all transaction items
✅ Transaction rendering works correctly with duplicates

## Testing
1. Open the app and view coins with transactions
2. Check the browser console - no duplicate key warnings
3. Verify transactions render properly
4. Multiple transactions with same signature now render without warnings

## Date
December 2024
