# Limit Orders Testing Guide

## Quick Test Steps

### 1. Start the Application
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 2. Open Profile Page
1. Navigate to `http://localhost:5173`
2. Click the profile icon (bottom navigation)
3. Connect your wallet

### 3. Check Active Orders
Look for the "Limit Orders" section with "Active" tab selected.

#### Expected Results for Each Order:
```
📊 Token Symbol/Name (e.g., "BONK", "Aa4F...b8kL")
   - Should NEVER show "Unknown" or "TOKEN"
   - May show shortened mint if token not found in any API

🟢 BUY or 🔴 SELL indicator
   - Clearly shows order type

Current Price vs Trigger Price:
   - Current Price: $0.000123
   - Trigger Price: $0.000150
   - Percentage difference badge (e.g., "18% below target")

Order Details Grid:
💰 Amount: 1,234,567.89 [TOKEN_SYMBOL]
⏱️ Created: 2h 15m ago
⏰ Expires In: 24h 30m (or "No expiry")
💵 Est. Value: 0.1234 SOL

Additional Info:
📅 Created on: Jan 15, 3:45 PM
🔑 Order ID: 1a2b3c4d...5e6f7g
```

### 4. Check History Tab
Click "History" tab to see executed/cancelled orders.

#### Expected Results:
- Shows simplified order info
- Displays execution/cancellation status
- All fields populated correctly

### 5. Backend Logs to Check
In the backend terminal, look for these log messages:

```
[Jupiter Trigger] Fetching active orders for [wallet_address] (page 1)
[Jupiter Trigger] Found [N] orders
[Jupiter Trigger] Sample order structure: {...}
[Jupiter Trigger] Timestamp fields: { createdAt: ..., expiredAt: ... }
[Jupiter Trigger] Enriched order: BONK (Bonk) - BUY 1000000.000000 @ $0.00001234 | Current: $0.00001156
```

### 6. What to Test

#### Happy Path ✅
- [ ] Orders display with correct token symbols
- [ ] Current price shows a value (not null/undefined)
- [ ] Trigger price shows correctly
- [ ] Amount displays with token symbol
- [ ] Created time shows relative time (e.g., "2h 15m ago")
- [ ] Expiry shows time remaining or "No expiry"
- [ ] Estimated value shows SOL amount
- [ ] Order type (BUY/SELL) displays correctly
- [ ] Price difference percentage is accurate

#### Edge Cases 🔍
- [ ] **Unknown token**: Should use mint address as symbol (e.g., "Aa4F...b8kL")
- [ ] **No current price**: Should use trigger price as fallback
- [ ] **No expiry**: Should display "No expiry" instead of error
- [ ] **Old order**: Created time should show days/hours correctly
- [ ] **Near expiry**: Should show accurate time remaining

#### Error Cases ❌ (Should Not Occur)
- [ ] "Unknown" appearing anywhere
- [ ] "N/A" appearing (except for optional fields)
- [ ] "Invalid date" appearing
- [ ] Zero values where they shouldn't be
- [ ] Null/undefined errors in console

### 7. Network Tab Inspection (Browser DevTools)

#### Check Backend Response
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "orders"
4. Click on the request to `/api/trigger/orders`
5. Check the response JSON

Expected structure:
```json
{
  "success": true,
  "orders": [
    {
      "id": "...",
      "orderId": "...",
      "tokenSymbol": "BONK",
      "tokenName": "Bonk",
      "tokenMint": "DezXAZ8...",
      "type": "buy",
      "status": "active",
      "triggerPrice": 0.00001234,
      "amount": 1000000,
      "currentPrice": 0.00001156,
      "estimatedValue": 0.1234,
      "createdAt": "2025-01-15T15:30:00.000Z",
      "expiresAt": "2025-01-16T15:30:00.000Z",
      "executedAt": null,
      "inputMint": "So11111111...",
      "outputMint": "DezXAZ8...",
      "maker": "...",
      "tokenDecimals": 9
    }
  ],
  "page": 1,
  "totalPages": 1
}
```

#### Verify All Fields Are Present
- [ ] `tokenSymbol` is NOT "Unknown"
- [ ] `tokenName` has a value
- [ ] `currentPrice` has a number (not null)
- [ ] `triggerPrice` has a number
- [ ] `amount` has a number
- [ ] `createdAt` is a valid ISO timestamp
- [ ] `expiresAt` is null or valid ISO timestamp
- [ ] `estimatedValue` has a number

### 8. Console Logs to Check

#### Backend Console
Look for successful enrichment logs:
```
[Jupiter Trigger] Enriched order: BONK (Bonk) - BUY 1000000.000000 @ $0.00001234 | Current: $0.00001156
```

If you see fallback logs, that's OK:
```
[Jupiter Trigger] Could not fetch token metadata from Jupiter for [mint]
[Jupiter Trigger] Could not fetch token metadata from Solscan for [mint]
[Jupiter Trigger] Using mint address as fallback symbol: Aa4F...b8kL
```

Or:
```
[Jupiter Trigger] Could not fetch current price from Jupiter for [mint]
[Jupiter Trigger] Using trigger price as fallback current price: 0.00001234
```

#### Frontend Console
Should be clean with no errors. Occasional warnings are OK:
```
[ProfileView] Fetching orders for wallet: ...
[ProfileView] Loaded N orders
```

### 9. Common Issues and Solutions

#### Issue: Orders Not Loading
**Check**:
- Backend is running on port 3001
- Wallet is connected
- No CORS errors in console

**Solution**:
```bash
# Restart backend
cd backend
npm run dev
```

#### Issue: "Unknown" Still Appearing
**Check**:
- Backend logs show successful token metadata fetch
- Backend response has `tokenSymbol` field

**Solution**:
- Clear browser cache
- Restart backend
- Check that the token mint is valid

#### Issue: "Invalid date" Error
**Check**:
- Backend logs show timestamp conversion
- `createdAt` in response is ISO format

**Solution**:
- Already fixed with timestamp validation
- Restart backend if using old code

### 10. Success Criteria

✅ All orders display complete information
✅ No "Unknown" values appear
✅ Current price always shows a value
✅ Token symbols are meaningful (real symbols or shortened mints)
✅ Time displays correctly (created, expires)
✅ Amounts are formatted with correct decimals
✅ No console errors
✅ Backend enrichment logs show successful fetching
✅ Order cancellation works
✅ History tab shows past orders

## Quick Debugging Commands

### Check if Backend is Running
```bash
curl http://localhost:3001/health
```

### Test Orders Endpoint Directly
```bash
curl "http://localhost:3001/api/trigger/orders?wallet=YOUR_WALLET_ADDRESS&status=active"
```

### Kill Backend if Port is Busy
```bash
lsof -ti:3001 | xargs kill -9
```

### Restart Everything
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

## Need Help?
- Check backend console for enrichment logs
- Check browser console for errors
- Verify API responses in Network tab
- Ensure wallet is connected
- Restart both frontend and backend

## Status: Ready for Testing ✅
