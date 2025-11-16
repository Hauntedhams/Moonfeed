# TwelveData Chart - Critical Fix: Using baseTokenMint! 🎯

## The Issue
We were subscribing with **`ammAccount`** (pool address) but according to the SolanaStream documentation for "stream a token price", we should use **`baseTokenMint`** (token mint address)!

## What Was Wrong

**Before (INCORRECT):**
```javascript
const subscribeMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'swapSubscribe',
  params: {
    include: {
      ammAccount: [poolAddress]  // ❌ Wrong for token price streaming!
    }
  }
};
```

**After (CORRECT):**
```javascript
const subscribeMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'swapSubscribe',
  params: {
    include: {
      baseTokenMint: [tokenMint]  // ✅ Correct for token price streaming!
    }
  }
};
```

## Key Differences

### ammAccount vs baseTokenMint

| Parameter | Purpose | What It Does |
|-----------|---------|--------------|
| `ammAccount` | Subscribe to specific pool | Only gets swaps for ONE liquidity pool |
| `baseTokenMint` | Subscribe to token price | Gets swaps across ALL pools for that token |

**Why this matters:**
- A token can trade on multiple DEXs (Raydium, Pumpfun, Orca, etc.)
- Using `ammAccount` = you only see swaps on ONE pool
- Using `baseTokenMint` = you see ALL swaps for the token (better price discovery!)

## Code Changes

### 1. Extract Token Mint Address
```javascript
// NEW: Extract both pairAddress (for historical data) and tokenMint (for real-time)
const pairAddress = coin?.pairAddress || coin?.poolAddress || coin?.address || coin?.ammAccount || null;

const tokenMint = coin?.mintAddress ||   // Most common field
                  coin?.address ||         // Fallback
                  coin?.baseToken?.address || // DexScreener format
                  null;
```

### 2. Use Correct Parameter in Subscription
```javascript
// Historical data: Use pairAddress (pool address)
const historicalData = await fetchHistoricalData(pairAddress);

// Real-time data: Use tokenMint (token mint address)
const wsConnected = await setupWebSocket(tokenMint, lineSeries);
```

### 3. Updated Subscription Message
```javascript
{
  jsonrpc: '2.0',
  id: 1,
  method: 'swapSubscribe',
  params: {
    include: {
      baseTokenMint: [tokenMint]  // Token mint, not pool address!
    }
  }
}
```

## Expected Behavior Now

### Console Output (Success):
```
📊 Initializing chart for: 3AHQjY9S9ddAg5SEXiHf3AKfb7gAVs3fchEJuB3wgQ42
✅ Chart created, fetching historical data...
✅ Chart initialized with 84 data points
🔌 Attempting WebSocket connection for token mint: EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm
🔌 SolanaStream WebSocket connected
📤 Sending subscription message: {params: {include: {baseTokenMint: ["EKpQ..."]}}}
📨 Received WebSocket message: {jsonrpc: "2.0", id: 1, result: {subscription_id: 1}}
✅ Subscription confirmed: {subscription_id: 1}

... wait for swap to happen ...

📨 Received WebSocket message: {slot: 315256016, blockTime: 1737393555, swap: {...}}
💱 Swap notification received: {quotePrice: "4.665456971e-06", ...}
💰 Extracted price: 0.000004665456971 timestamp: 1737393555
✅ Chart updated with live price: 0.000004665456971
```

### What This Means:
- ✅ Gets swaps from **ALL pools** for the token
- ✅ Better price discovery (not limited to one DEX)
- ✅ More frequent updates (all trading activity)
- ✅ Matches the documentation exactly

## Testing Checklist

1. **Check the logs:**
   - Should see `token mint:` instead of `pool:`
   - Should see `baseTokenMint` in subscription message
   
2. **Verify connection:**
   - Look for `✅ Subscription confirmed`
   - Should NOT see `Code 1006` error anymore
   
3. **Wait for swaps:**
   - When token is traded, you'll see swap notifications
   - Price updates in real-time
   - Chart extends with new data points

4. **Compare with old behavior:**
   - **Old:** Only showed swaps on ONE pool
   - **New:** Shows swaps across ALL pools for the token

## Why It Should Work Now

1. ✅ **API key in URL** - Correct authentication
2. ✅ **baseTokenMint parameter** - Correct subscription type for token price streaming
3. ✅ **Token mint address** - Tracks the token across all pools
4. ✅ **Correct message format** - Matches SolanaStream documentation exactly

## Data Flow

```
1. User clicks "twelve" chart tab
   ↓
2. Chart fetches historical OHLCV from GeckoTerminal
   - Uses: pairAddress (pool address)
   - Gets: Last 100 5-minute candles
   ↓
3. Chart subscribes to real-time swaps from SolanaStream
   - Uses: tokenMint (token mint address)
   - Gets: ALL swaps for this token across ALL DEXs
   ↓
4. As swaps happen on-chain:
   - Swap notification arrives
   - Price extracted from quotePrice
   - Chart updated with new data point
   - Price badge updated
   ↓
5. Chart shows live, real-time price movement!
```

## Important Notes

### Token Mint vs Pool Address

**Token Mint Address:**
- Identifies the SPL token itself
- Example: `EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm`
- Used for: Real-time price streaming across all pools

**Pool Address:**
- Identifies a specific liquidity pool on a DEX
- Example: `3AHQjY9S9ddAg5SEXiHf3AKfb7gAVs3fchEJuB3wgQ42`
- Used for: Historical data for that specific pool

### Why We Need Both

- **Historical data** = Specific pool (GeckoTerminal has pool-specific OHLCV)
- **Real-time data** = Token mint (SolanaStream tracks token across all pools)

## Status: ✅ SHOULD BE WORKING NOW

The critical issue was using the wrong subscription parameter. Now we're:
- ✅ Using the correct API endpoint
- ✅ Using the correct authentication (API key in URL)
- ✅ Using the correct subscription parameter (`baseTokenMint`)
- ✅ Using the correct address type (token mint, not pool)
- ✅ Following the exact documentation format

**This should connect successfully and provide real-time price updates!** 🚀

Test it now and check the console for the updated logs showing `token mint:` and `baseTokenMint` in the subscription message.
