# Jupiter Ultra Search - Quick Testing Guide

## 🚀 Start the Application

### Terminal 1: Backend
```bash
cd backend
npm run dev
```
Backend should start on `http://localhost:3001`

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```
Frontend should start on `http://localhost:5173`

---

## 🧪 Test Cases

### 1. Search by Symbol
**Test**: Search for "SOL"
- Open search modal (click search button in bottom nav)
- Type "SOL"
- **Expected**: Multiple SOL-related tokens appear (Wrapped SOL, etc.)
- **Verify**: Price, market cap, liquidity shown correctly

### 2. Search by Token Name
**Test**: Search for "Dogwifhat"
- Type "Dogwifhat" or "dog"
- **Expected**: WIF token appears with image
- **Verify**: Token name, symbol, stats displayed

### 3. Search by Mint Address
**Test**: Search for wrapped SOL address
```
So11111111111111111111111111111111111111112
```
- Paste full mint address
- **Expected**: Exact match for Wrapped SOL
- **Verify**: All metadata loads

### 4. Filter - Verified Only
**Test**: Enable verified filter
- Toggle filter panel (filter icon in header)
- Check "Verified Only"
- Search "SOL"
- **Expected**: Only verified tokens in results
- **Verify**: All results have ✓ badge

### 5. Filter - Exclude Suspicious
**Test**: Enable suspicious filter
- Check "Exclude Suspicious"
- Search for random tokens
- **Expected**: No ⚠️ warning badges appear
- **Verify**: Results are clean

### 6. Filter - Min Liquidity
**Test**: Set minimum liquidity
- Enter "10000" in Min Liquidity field
- Search "meme"
- **Expected**: Only tokens with $10K+ liquidity
- **Verify**: All Liq values > $10K

### 7. Sort Options
**Test**: Try different sorting
- **Liquidity**: Highest liquidity tokens first
- **Market Cap**: Highest market cap first
- **Holders**: Most holders first
- **Price**: Highest price first
- **Verify**: Results reorder correctly

### 8. Empty State
**Test**: No search query
- Clear search input
- **Expected**: Help text with examples shown
- **Verify**: Instructions visible

### 9. No Results
**Test**: Search for non-existent token
- Type "qwertyuiop123456789"
- **Expected**: "No tokens found" error message
- **Verify**: Error is user-friendly

### 10. Select Token
**Test**: Click a result
- Search "BONK"
- Click any result
- **Expected**: Modal closes, token added to feed
- **Verify**: Token appears in main feed

### 11. Real-Time Search
**Test**: Debounced search
- Slowly type "S-O-L"
- **Expected**: Search triggers 300ms after last keystroke
- **Verify**: Loading spinner appears during search

### 12. Mobile Responsive
**Test**: Resize browser
- Open DevTools, toggle device mode
- Try search on mobile view
- **Expected**: Layout adapts, filters stack vertically
- **Verify**: Touch-friendly buttons, readable text

---

## 🐛 Common Issues & Fixes

### Issue: "Search failed" error
**Cause**: Backend not running or route not mounted  
**Fix**: Check backend console, ensure `npm run dev` running

### Issue: No results for valid token
**Cause**: Jupiter API rate limit or downtime  
**Fix**: Wait a moment and try again

### Issue: Filters don't apply
**Cause**: Filter state not triggering re-search  
**Fix**: Check browser console for errors

### Issue: Images not loading
**Cause**: CORS or invalid image URLs  
**Fix**: Check default-coin.png fallback works

### Issue: Modal won't open
**Cause**: SearchModal not mounted in App.jsx  
**Fix**: Verify `<CoinSearchModal visible={...} />` in App.jsx

---

## 📊 Expected Console Output

### Backend Console
```
🔍 Searching Jupiter Ultra for: "SOL"
✅ Found 15 tokens
```

### Frontend Console
```
🔍 Searching Jupiter Ultra for: SOL
✅ Found 15 tokens
```

### Network Tab
```
GET /api/search?query=SOL
Status: 200 OK
Response: { success: true, results: [...], count: 15 }
```

---

## ✅ Success Criteria

- [x] Search triggers on 2+ characters
- [x] Results load in < 1 second
- [x] All badges display correctly
- [x] Filters apply and persist
- [x] Clicking result adds to feed
- [x] Error states are clear
- [x] Mobile layout works
- [x] No console errors

---

## 🎯 Quick Test Script

Run this in browser console after searching:
```javascript
// Check if results loaded
console.log('Results:', document.querySelectorAll('.search-result-card').length);

// Check if filters work
console.log('Verified tokens:', document.querySelectorAll('.verified-badge').length);

// Check if stats display
console.log('Price elements:', document.querySelectorAll('.stat-value').length);
```

---

## 📝 Test Report Template

```markdown
## Test Results

**Date**: [DATE]
**Tester**: [NAME]
**Environment**: Desktop/Mobile

| Test Case | Status | Notes |
|-----------|--------|-------|
| Search by Symbol | ✅/❌ | |
| Search by Name | ✅/❌ | |
| Search by Address | ✅/❌ | |
| Verified Filter | ✅/❌ | |
| Suspicious Filter | ✅/❌ | |
| Min Liquidity | ✅/❌ | |
| Sort Options | ✅/❌ | |
| Empty State | ✅/❌ | |
| No Results | ✅/❌ | |
| Select Token | ✅/❌ | |
| Real-Time Search | ✅/❌ | |
| Mobile Responsive | ✅/❌ | |

**Overall**: ✅ Pass / ❌ Fail
**Notes**: [Any issues or observations]
```

---

## 🚀 Ready to Test!

1. Start backend server
2. Start frontend dev server
3. Open `http://localhost:5173`
4. Click search button in bottom nav
5. Try test cases above

**Good luck!** 🎉
