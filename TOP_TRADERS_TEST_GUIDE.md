# Testing Top Traders Rate Limit Fix

## Quick Test Steps

### 1. **Start the App**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 2. **Test Scenario 1: Feed with Multiple Cards (Collapsed)**
1. Open the app
2. Scroll through the feed
3. **Expected**: No API calls to `/api/top-traders/*` in Network tab
4. **Expected**: No 429 errors in console

### 3. **Test Scenario 2: Expand Single Card**
1. Click to expand one coin card
2. **Expected**: 
   - Loading spinner appears in Top Traders section
   - Single API call to `/api/top-traders/{address}`
   - Top traders load successfully
   - No 429 errors

### 4. **Test Scenario 3: Expand Multiple Cards Sequentially**
1. Expand Card 1 → Top traders load ✅
2. Expand Card 2 → Top traders load ✅
3. **Expected**: Both load without conflicts

### 5. **Test Scenario 4: Rapid Expand/Collapse**
1. Quickly expand and collapse cards
2. **Expected**: API calls only when fully expanded
3. **Expected**: No duplicate calls

### 6. **Test Scenario 5: Rate Limit Handling (If It Happens)**
1. If you DO hit a rate limit:
   - **Expected**: User-friendly error message: "Rate limit reached. Please wait a moment and try again."
   - **Expected**: "Try Again" button appears
   - Click "Try Again" after waiting
   - **Expected**: Data loads successfully

## Console Logs to Watch

### ✅ Good Logs (Success)
```
🔄 TopTradersList useEffect triggered: { isActive: true, loaded: false, ... }
✅ Card is active - loading top traders
🔍 Loading top traders for: {address}
📊 Response status: 200 OK
✅ Successfully loaded X top traders
```

### ❌ Old Logs (Should NOT appear anymore)
```
📊 Response status: 500 Internal Server Error
📦 Response data: {success: false, error: 'Failed to fetch top traders', details: 'API error: 429...'}
❌ Response not OK: 500
```

### ℹ️ Inactive Card Logs (Normal)
```
🔄 TopTradersList useEffect triggered: { isActive: false, ... }
⚠️ Card not active (not expanded or not visible)
```

## Network Tab Check

### Before Fix
- Multiple simultaneous calls to `/api/top-traders/*`
- Many 500 status codes
- High error rate

### After Fix
- Only ONE call at a time
- All 200 status codes
- Zero errors

## What Changed?

### TopTradersList.jsx
- Now requires `isActive={true}` to load
- Shows placeholder when `isActive={false}`
- Better rate limit error messages

### CoinCard.jsx
- Passes `isActive={isExpanded && isVisible}`
- Only active/visible cards trigger loading

---

**Expected Result**: ✅ No more 429 rate limit errors, top traders only load when you expand a card!
