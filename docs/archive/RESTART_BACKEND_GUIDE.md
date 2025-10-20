# 🚀 Quick Restart Guide - Apply Limit Orders Fix

## ✅ Changes Are Ready!

All code changes have been saved to:
- ✅ `/backend/services/jupiterTriggerService.js` (enhanced enrichment)
- ✅ `/frontend/src/components/ProfileView.jsx` (improved display)

## 🔄 How to Apply Changes

### Option 1: Kill & Restart Backend (Recommended)

1. **Find the backend process**:
   ```bash
   lsof -ti:3001
   ```

2. **Kill it**:
   ```bash
   kill -9 $(lsof -ti:3001)
   ```

3. **Start fresh**:
   ```bash
   cd backend && npm run dev
   ```

### Option 2: Use VS Code Tasks

1. Stop the "Start Backend" task
2. Run it again

### Option 3: Terminal Shortcut

In the terminal where backend is running:
1. Press `Ctrl+C` to stop
2. Run `npm run dev` again

## 🧪 Testing After Restart

### 1. Open Profile Page
- Click the Profile icon in bottom navigation

### 2. View Active Orders
- You should see your existing orders with **ALL fields populated**:
  - ✅ Token symbol (BONK, TRUMP, etc.)
  - ✅ Current price (live from Jupiter)
  - ✅ Trigger price (your set price)
  - ✅ Amount (e.g., 1,000,000 BONK)
  - ✅ Created time (e.g., 20m ago)
  - ✅ Expires in (e.g., 23h 40m)
  - ✅ Est. Value (e.g., 0.6700 SOL)

### 3. Check Backend Logs
You should see:
```
[Jupiter Trigger] Found X orders
[Jupiter Trigger] Sample order structure: {...}
[Jupiter Trigger] Enriched order: BONK (Bonk) - BUY 1000000.00 @ $0.00000067 | Current: $0.00000071
```

## 🎯 What Will Change

### Before (Current):
```
Token: Unknown
Amount: 0.00 Unknown
Created: 0m ago
Expires: No expiry
Est. Value: (blank)
Current Price: $0.000031
Trigger Price: $0.000031
```

### After (With Fix):
```
Token: BONK
Amount: 1,000,000.00 BONK
Created: 20m ago
Expires: 23h 40m
Est. Value: 0.6700 SOL
Current Price: $0.00000071
Trigger Price: $0.00000067
5.97% above target
```

## ⚡ Quick Kill Command

If backend won't stop:
```bash
kill -9 $(lsof -ti:3001) && cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3/backend && npm run dev
```

## 📊 Monitoring

### Watch for successful enrichment:
```bash
# In backend terminal, you'll see:
[Jupiter Trigger] Fetching active orders for {wallet}
[Jupiter Trigger] Found 1 orders
[Jupiter Trigger] Sample order structure: {...}
[Jupiter Trigger] Enriched order: BONK (Bonk) - BUY 1000000.000000 @ $0.00000067 | Current: $0.00000071
```

### Frontend will automatically:
1. Fetch enriched orders from backend
2. Display all fields with real data
3. Show accurate price comparisons
4. Calculate time differences
5. Format amounts nicely

## ✨ No Frontend Restart Needed

The frontend will automatically:
- Use new backend data on next order fetch
- React will re-render with new data
- All values will populate immediately

Just **restart the backend** and reload the Profile page!
