# 🧪 Testing Guide: Real-Time Price Updates

## Quick Test Checklist

### ✅ Backend Test (5 minutes)

1. **Start the backend:**
   ```bash
   cd backend && npm run dev
   ```

2. **Watch for these log messages:**
   ```
   🚀 [PureRpcMonitor] Initialized - 100% Solana Native RPC
   💰 [Monitor] SOL price updated: $XXX
   ```

3. **When a user opens a chart, you should see:**
   ```
   📡 [Monitor] Subscribing to token: ABC123...
   🔍 [Monitor] Finding pool for ABC123...
   ✅ [Monitor] Found raydium pool: XYZ789...
   💰 [Monitor] Raydium vault balances:
   💰 [Monitor] Calculated price: $0.00123456
   📤 [Monitor] Broadcasted price to 1 client(s)
   ```

4. **On every trade, you should see:**
   ```
   🔄 [Monitor] Pool update detected for ABC123...
   💰 [Monitor] New price: $0.00123457
   📤 [Monitor] Broadcasted price to 1 client(s)
   ```

---

### ✅ Frontend Test (5 minutes)

1. **Start the frontend:**
   ```bash
   cd frontend && npm run dev
   ```

2. **Open a token chart:**
   - Navigate to any token
   - Open the chart modal
   - Check browser console

3. **Look for these console messages:**
   ```javascript
   [Chart] Token mint: ABC123...
   [Chart] poolAddress: XYZ789...
   [Chart] Pool type: raydium (or pumpfun, or orca)
   [Chart] WebSocket connecting to: ws://localhost:3001
   [Chart] WebSocket connected!
   [Chart] Subscribing to price updates
   ```

4. **When price updates arrive:**
   ```javascript
   [Chart] Received live price update: {
     type: 'price-update',
     price: 0.00123456,
     source: 'raydium-rpc',
     timestamp: 1234567890
   }
   [Chart] Chart data length: 120 -> 121 (growing in real-time!)
   ```

5. **Visual indicators:**
   - ✅ "LIVE" badge appears (green, pulsing)
   - ✅ Chart line extends to the right
   - ✅ Price updates smoothly

---

## 🎯 Test Scenarios

### Scenario 1: Pump.fun Token (Not Bonded)
**Example:** New token on Pump.fun that hasn't graduated yet

**Expected Behavior:**
```
Backend Logs:
✅ [Monitor] Found on Pump.fun API: bondingCurveAddress...
💰 [Monitor] Pump.fun bonding curve: 123456 tokens / 0.5 SOL
💰 [Monitor] Calculated price: $0.00123456

Frontend:
✅ poolType: "pumpfun"
✅ Updates every 1-2 seconds (very fast)
✅ LIVE indicator appears
```

**How to Test:**
1. Go to pump.fun
2. Find a new token (created in last hour)
3. Copy mint address
4. Paste into your app

---

### Scenario 2: Raydium Pool
**Example:** Graduated Pump.fun token or established token

**Expected Behavior:**
```
Backend Logs:
✅ [Monitor] Found raydium pool: poolAddress...
   Liquidity: $50,000
🔍 [Monitor] Reading Raydium vaults:
   Base vault: ABC123...
   Quote vault: XYZ789...
💰 [Monitor] Raydium vault balances:
   Base (token): 1000000000
   Quote (SOL): 100000000
💰 [Monitor] Calculated Raydium price: $0.00123456

Frontend:
✅ poolType: "raydium"
✅ poolAddress: "actual-pool-address"
✅ Updates every 2-5 seconds (depends on trade volume)
✅ LIVE indicator appears
```

**How to Test:**
1. Go to dexscreener.com
2. Find a token on Raydium with active trading
3. Copy mint address
4. Paste into your app

---

### Scenario 3: Orca Pool
**Example:** Token trading on Orca Whirlpool

**Expected Behavior:**
```
Backend Logs:
✅ [Monitor] Found orca pool: poolAddress...
   Liquidity: $25,000
🔍 [Monitor] Reading Orca vaults:
   Vault A: ABC123...
   Vault B: XYZ789...
💰 [Monitor] Orca vault balances:
   Vault A: 5000000000
   Vault B: 2000000000
💰 [Monitor] Calculated Orca price: $0.00123456

Frontend:
✅ poolType: "orca"
✅ Updates every 2-5 seconds
✅ LIVE indicator appears
```

**How to Test:**
1. Go to dexscreener.com
2. Filter by "Orca" DEX
3. Find an active token
4. Copy mint address
5. Paste into your app

---

## 🐛 Troubleshooting

### Problem: No Price Updates

**Check Backend Logs:**
```bash
# Look for errors:
❌ [Monitor] Error subscribing: ...
⚠️  [Monitor] No pool found for ...
⚠️  [Monitor] Zero balance in vault
```

**Common Causes:**
1. Token has no liquidity (check Dexscreener)
2. Pool address is wrong
3. RPC endpoint is down

**Solutions:**
```javascript
// Test RPC connection
const { Connection } = require('@solana/web3.js');
const conn = new Connection('https://api.mainnet-beta.solana.com');
conn.getSlot().then(slot => console.log('RPC OK, slot:', slot));
```

---

### Problem: Wrong Price

**Check Backend Logs:**
```bash
# Look for:
💰 [Monitor] Calculated price: $99999999.00  # Way too high
💰 [Monitor] Calculated price: $0.00000001   # Way too low
```

**Common Causes:**
1. Wrong decimal assumption (6 vs 9)
2. Inverted base/quote tokens
3. Zero liquidity pool

**Your Code Already Handles This:**
```javascript
// Sanity check in getRaydiumPrice()
if (price < 0.00000001 || price > 1000000) {
  console.log(`⚠️ Unreasonable price, trying different decimals`);
  // Try 9 decimals instead of 6
  const baseAmountNum9 = Number(baseAmount) / 1e9;
  price = (quoteAmountNum / baseAmountNum9) * this.solPrice;
}
```

---

### Problem: Chart Not Updating

**Check Frontend Console:**
```javascript
// Look for:
[Chart] WebSocket error: ...
[Chart] WebSocket closed
[Chart] No poolAddress for this coin
```

**Common Causes:**
1. WebSocket connection failed
2. Token data missing `poolAddress` field
3. Backend not running

**Debug Steps:**
```javascript
// In TwelveDataChart.jsx, add:
console.log('Coin data:', coin);
console.log('Pool address:', coin.poolAddress);
console.log('WebSocket state:', ws.readyState);
// 0 = CONNECTING
// 1 = OPEN
// 2 = CLOSING
// 3 = CLOSED
```

---

## 📊 Performance Benchmarks

### Expected Latency:

| Pool Type | Detection | First Update | Subsequent Updates |
|-----------|-----------|--------------|-------------------|
| **Pump.fun** | <500ms | <1s | 1-2s (very fast) |
| **Raydium** | <1s | <2s | 2-5s (depends on volume) |
| **Orca** | <1s | <2s | 2-5s (depends on volume) |
| **Others** | <1s | <3s | 3-5s (polling fallback) |

### Expected Update Frequency:

| Token Volume | Updates Per Minute |
|--------------|-------------------|
| **High (>$100k/hr)** | 10-20 updates |
| **Medium ($10-100k/hr)** | 3-10 updates |
| **Low (<$10k/hr)** | 1-3 updates |
| **Pump.fun (active)** | 30+ updates |

---

## ✅ Success Indicators

### You Know It's Working When:

1. **Backend Console:**
   ```
   ✅ Multiple price broadcasts per minute
   ✅ No error messages
   ✅ "Broadcasted price to X client(s)" messages
   ```

2. **Frontend Console:**
   ```
   ✅ "Received live price update" messages
   ✅ "Chart data length: X -> Y" (growing)
   ✅ No WebSocket errors
   ```

3. **Visual:**
   ```
   ✅ Green "LIVE" badge visible
   ✅ Chart line extending to the right
   ✅ Price value updating
   ✅ Smooth animations
   ```

4. **User Experience:**
   ```
   ✅ Chart feels "alive"
   ✅ Updates happen within seconds of trades
   ✅ No lag or stuttering
   ✅ Professional quality
   ```

---

## 🎬 Quick Start Testing Script

```bash
#!/bin/bash

echo "🧪 Starting MoonFeed Real-Time Test..."
echo ""

# 1. Start backend
echo "📦 Starting backend..."
cd backend
npm run dev &
BACKEND_PID=$!
sleep 5

# 2. Start frontend
echo "🎨 Starting frontend..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!
sleep 5

# 3. Open browser
echo "🌐 Opening browser..."
open http://localhost:5173

echo ""
echo "✅ Test environment ready!"
echo ""
echo "📝 Test checklist:"
echo "  1. Open a token chart"
echo "  2. Check backend logs for price updates"
echo "  3. Check frontend console for WebSocket messages"
echo "  4. Verify LIVE indicator appears"
echo "  5. Watch chart extend in real-time"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
wait
```

Save as `test-realtime.sh` and run:
```bash
chmod +x test-realtime.sh
./test-realtime.sh
```

---

## 📚 Next Steps After Testing

### If Everything Works:
1. ✅ **Deploy to production**
2. ✅ **Monitor error rates**
3. ✅ **Add analytics tracking**
4. ✅ **Celebrate!** 🎉

### If You Find Issues:
1. 🐛 **Copy error logs**
2. 🔍 **Check this guide for solutions**
3. 💬 **Ask for help with specific error messages**
4. 📝 **Document edge cases**

---

**Happy Testing! 🚀**
