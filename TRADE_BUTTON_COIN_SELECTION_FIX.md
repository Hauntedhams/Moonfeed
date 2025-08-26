# Trade Button Fix - Coin Selection Issue

## Problem
When users opened a coin from the favorites tab and then pressed the trade button, the pre-loaded coin in the Jupiter trading modal was showing an incorrect coin (usually the last coin that was in view during scrolling).

## Root Cause
The issue was in the App.jsx component's state management:

1. When a user clicked on a coin from favorites (`handleCoinClick`), it only set `selectedCoin` but didn't update `currentViewedCoin`
2. The trading modal uses `currentViewedCoin` as the `selectedCoin` prop
3. So when trading modal opened, it would show the old `currentViewedCoin` instead of the coin the user was actually viewing

## Solution
Made two key changes in `/frontend/src/App.jsx`:

### 1. Updated `handleCoinClick` function
```jsx
// Handle coin click from favorites grid
const handleCoinClick = (coin) => {
  setSelectedCoin(coin);
  setCurrentViewedCoin(coin); // ✅ Added this line
  setActiveTab('coin-detail');
};
```

### 2. Added useEffect to ensure consistency
```jsx
// Ensure the current viewed coin is set when viewing a specific coin detail
React.useEffect(() => {
  if (activeTab === 'coin-detail' && selectedCoin) {
    setCurrentViewedCoin(selectedCoin);
  }
}, [activeTab, selectedCoin]);
```

## How It Works Now
1. User opens a coin from favorites → both `selectedCoin` and `currentViewedCoin` are set to the same coin
2. User clicks trade button → `currentViewedCoin` is passed to Jupiter trading modal as `selectedCoin`
3. Trading modal correctly shows the coin the user was viewing

## Testing
- ✅ Open any coin from favorites tab
- ✅ Click the trade button
- ✅ Verify the Jupiter trading modal shows the correct coin for trading
- ✅ The toToken should match the coin symbol you were viewing

## Files Changed
- `/frontend/src/App.jsx` - Fixed coin selection state management

The fix ensures that the trade button always works for the coin the user is currently viewing, regardless of how they navigated to that coin.
