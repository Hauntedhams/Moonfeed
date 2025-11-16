# 🔍 DIAGNOSIS: Why Chart Shows "LIVE" But Doesn't Move

## ✅ **Progress So Far:**
- ✅ Chart renders successfully
- ✅ "LIVE" indicator shows
- ✅ WebSocket connects
- ✅ Subscription sent

## ❓ **The Issue:**
**Chart is static - line doesn't extend**

This means ONE of these is the problem:

---

## 🧪 **Diagnostic Steps:**

### Step 1: Are Price Updates Being Sent from Backend?

**Check backend console** - You should see (every few seconds):
```
🔄 [Monitor] Pool update detected for ABC123...
💰 [Monitor] New price: $0.00123456
📤 [Monitor] Broadcasted price $0.00123456 to 1 client(s)
```

**If you DON'T see these messages:**
- Token has very low volume (no trades = no updates)
- Pool subscription failed
- Pool not found

**Solution:** Try with a high-volume Pump.fun token

---

### Step 2: Is Frontend Receiving the Updates?

**Check browser console** - You should now see:
```
📨 Received price-update message: { price: 0.00123456, timestamp: 1234567890, lineSeries: true }
📊 Adding point to chart: { time: 1234567890, value: 0.00123456 }
✅ Chart updated successfully!
💰 LIVE RPC Price Update: $0.00123456 (📈)
```

**If you DON'T see "📨 Received price-update message":**
- Backend not sending updates (see Step 1)
- WebSocket message format wrong
- Message being filtered

**If you see "📨" but NOT "✅ Chart updated successfully":**
- Error updating lightweight-charts
- Check for error message

---

## 🚨 **Most Likely Issues:**

### Issue #1: Low Trading Volume (90% of cases)
```
Symptom: Everything connected but no updates
Cause: Token has no trades happening
Solution: THIS IS NORMAL for low-volume tokens!
```

**Test with high-volume token:**
- Go to pump.fun homepage
- Find a token with "Created: X minutes ago"
- These have LOTS of trades
- Copy mint address and test

### Issue #2: Backend Not Broadcasting
```
Symptom: Backend shows "Pool found" but no price updates
Cause: Pool subscription succeeded but no account changes detected
```

**Check backend logs:**
```bash
# Should see repeatedly:
🔄 [Monitor] Pool update detected
💰 [Monitor] New price
📤 [Monitor] Broadcasted price

# If NOT, subscription is silent (no trades)
```

### Issue #3: Price Updates Wrong Format
```
Symptom: Frontend receives messages but doesn't update chart
Cause: Timestamp or price format incorrect
```

**Check console for:**
```
📨 Received price-update message: { price: null, ... }  ❌
📨 Received price-update message: { price: 0.00123, timestamp: undefined }  ❌
📨 Received price-update message: { price: 0.00123, timestamp: 1234567890, lineSeries: true }  ✅
```

---

## 🎯 **Action Items:**

### 1. Open Browser Console
```
Right-click → Inspect → Console tab
```

### 2. Open Backend Terminal
```
Should already be running with:
cd backend && npm run dev
```

### 3. Open a Token Chart
**Preferably a NEW Pump.fun token** (high volume)

### 4. Watch BOTH Consoles for 30 Seconds

**Browser Console - Look for:**
```
✅ RPC Price WebSocket connected
📤 Subscribing to token: ABC123...
✅ Subscribed to token: ABC123...

Then wait for:
📨 Received price-update message: { ... }
📊 Adding point to chart: { ... }
✅ Chart updated successfully!
```

**Backend Console - Look for:**
```
[PriceWebSocketServer] Client connected
📡 [Monitor] Subscribing to token: ABC123...
✅ [Monitor] Found pumpfun pool: XYZ789...
✅ [Monitor] Subscribed to pool account

Then wait for (IMPORTANT!):
🔄 [Monitor] Pool update detected
💰 [Monitor] New price: $0.00123456
📤 [Monitor] Broadcasted price to 1 client(s)
```

---

## 📊 **Expected Timings:**

### For Active Pump.fun Token:
- Updates every **1-5 seconds**
- Chart extends smoothly
- Lots of trades happening

### For Medium Volume Token:
- Updates every **10-30 seconds**
- Chart extends on each trade
- Some trades happening

### For Low Volume Token:
- Updates every **1-10 minutes** (or never!)
- Chart appears static
- **This is normal!** No trades = no updates

---

## 💡 **Key Insight:**

**The chart ONLY updates when trades happen on-chain!**

If you're testing with a token that has:
- Low liquidity
- No recent trades
- Older/dead token

**You might wait minutes or hours for an update!**

This is NOT a bug - it's how real-time works. The chart updates when the pool changes, which happens when someone trades.

---

## 🧪 **Quick Test:**

### Test with Known Active Token:

1. **Go to pump.fun**
2. **Sort by "Created" → Show newest**
3. **Pick a token created < 5 minutes ago**
4. **Copy mint address**
5. **Open it in your app**
6. **Should see updates within seconds!**

---

## 🔧 **Manual Test WebSocket:**

If still not working, test backend directly:

```bash
cd backend
node test-price-websocket.js
```

This should:
1. Connect to WebSocket
2. Subscribe to a test token
3. Show any price updates

---

## 📝 **What to Report:**

After running these diagnostics, tell me:

1. **Backend Console:**
   - Do you see "🔄 Pool update detected"?
   - Do you see "📤 Broadcasted price"?
   - How often? (Every X seconds)

2. **Browser Console:**
   - Do you see "📨 Received price-update message"?
   - Do you see "✅ Chart updated successfully"?
   - Any errors?

3. **Token Info:**
   - What token are you testing?
   - Is it recently created?
   - High or low volume?

This will tell me exactly where the issue is!

---

## ✅ **If Everything Works But Chart Doesn't Extend:**

This would be very unusual, but possible causes:

1. **Lightweight-charts not re-rendering**
   - Chart frozen
   - Update called but visual doesn't change

2. **Time axis issue**
   - New points outside visible range
   - Need to call `chart.timeScale().scrollToRealTime()`

3. **Data format issue**
   - Points in wrong format
   - Time going backwards

**Let's diagnose first, then fix!** 🔍
