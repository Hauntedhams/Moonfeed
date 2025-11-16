# Twelve Data Live Chart Integration

## Overview

We've successfully added a third chart tab called "Twelve" that displays live price data using the Twelve Data WebSocket API with historical price charts.

## What Was Implemented

### 1. **TwelveDataChart Component** (`frontend/src/components/TwelveDataChart.jsx`)
   - Real-time WebSocket price updates
   - Historical price data (1-minute intervals, ~6.5 hours)
   - Uses `lightweight-charts` library for smooth, performant charting
   - Automatic symbol mapping (most meme coins aren't on Twelve Data, so it fallbacks to SOL/USD)
   - Connection status indicators (Loading, Live, Error)
   - Price change percentage tracking
   - Only loads when the tab is active (saves API credits)

### 2. **WebSocket Connection Manager** (`frontend/src/utils/twelveWebSocketManager.js`)
   - **CRITICAL**: Manages single WebSocket connection (free plan limit: 1 connection)
   - Prevents multiple simultaneous connections
   - Automatically switches between symbols when different coins are viewed
   - Broadcasts price updates to all active subscribers
   - Automatic cleanup when no subscribers remain

### 3. **Updated CoinCard** (`frontend/src/components/CoinCard.jsx`)
   - Added "Twelve" as third chart tab
   - Tab navigation updated (Clean → Advanced → Twelve)
   - Lazy loading: Chart only initializes when tab is active
   - Proper cleanup on tab switch

### 4. **Styling** (`frontend/src/components/TwelveDataChart.css`, `CoinCard.css`)
   - Professional chart header with status indicator
   - Live connection pulse animation
   - Dark mode support
   - Mobile responsive design
   - Error state messaging

## API Usage & Limits

### Free Plan Constraints:
- **8 WebSocket credits** (unclear what this means, but we're being conservative)
- **1 active WebSocket connection** at a time
- REST API calls for historical data

### How We Minimize Usage:
1. ✅ **Single Connection Manager**: Only 1 WebSocket connection across entire app
2. ✅ **Lazy Loading**: Chart only connects when "Twelve" tab is active
3. ✅ **Automatic Cleanup**: Connection closes when tab is switched away
4. ✅ **Historical Data Caching**: Chart data persists in component state
5. ✅ **Smart Reconnection**: 5-second delay before reconnecting on disconnect

## Symbol Mapping

Most Solana meme coins are **not available** on Twelve Data. The component handles this intelligently:

```javascript
Supported tokens: SOL, BTC, ETH, USDT, USDC, BNB, ADA, DOGE, MATIC
Unsupported tokens: Fallback to SOL/USD

Example:
- Viewing "BONK" → Shows SOL/USD
- Viewing "SOL" → Shows SOL/USD  
- Viewing "BTC" → Shows BTC/USD
```

This ensures the chart always displays something relevant, even if the specific meme coin isn't supported.

## User Experience

### When User Opens "Twelve" Tab:
1. Chart shows "Loading..." status
2. Fetches 6.5 hours of historical 1-minute price data
3. Renders price chart with smooth area gradient
4. Connects WebSocket for live updates
5. Status changes to "Live" with pulse indicator
6. Price updates in real-time on chart

### When User Switches Away:
1. WebSocket connection gracefully closes
2. Chart data remains in memory (no re-fetch needed)
3. If user returns, reconnects WebSocket instantly

### Error Handling:
- API errors show user-friendly messages
- Explains that most meme coins use SOL/USD fallback
- Connection errors trigger automatic retry after 5 seconds

## Technical Details

### Chart Configuration:
- **Library**: `lightweight-charts` (already in dependencies)
- **Data Format**: Time-series candlestick-style data
- **Update Frequency**: Real-time via WebSocket
- **Historical Range**: ~390 data points (6.5 hours)
- **Chart Height**: 250px

### WebSocket Protocol:
```json
// Subscribe
{
  "action": "subscribe",
  "params": {
    "symbols": "SOL/USD"
  }
}

// Price Update
{
  "event": "price",
  "symbol": "SOL/USD", 
  "price": "145.23",
  "timestamp": 1731234567
}
```

## Files Modified

1. **Created**:
   - `frontend/src/components/TwelveDataChart.jsx`
   - `frontend/src/components/TwelveDataChart.css`
   - `frontend/src/utils/twelveWebSocketManager.js`

2. **Modified**:
   - `frontend/src/components/CoinCard.jsx` - Added third tab and import
   - `frontend/src/components/CoinCard.css` - Added twelve-chart-wrapper styles

## Testing the Integration

### Step 1: Start the frontend
```bash
cd frontend
npm run dev
```

### Step 2: Open a coin card
- Scroll through the feed
- Click on any coin to expand

### Step 3: Navigate to "Twelve" tab
- Click the "Twelve" button in the chart navigation
- Watch the chart load historical data
- Verify "Live" status appears
- Observe real-time price updates

### Step 4: Test connection manager
- Open multiple coins
- Switch to "Twelve" tab on different coins
- Verify only ONE WebSocket connection is active
  - Open browser console
  - Look for: "Creating new Twelve Data WebSocket connection"
  - Should only see ONE at a time

### Debug Mode:
```javascript
// In browser console:
window.__TWELVE_WS_MANAGER__.getStatus()

// Returns:
// {
//   connected: true,
//   symbol: "SOL/USD",
//   subscriberCount: 1
// }
```

## Future Enhancements

### If You Upgrade to Paid Plan:
1. **Multiple Connections**: Remove singleton manager, allow multiple symbols
2. **More Symbols**: Support more crypto pairs
3. **Longer History**: Fetch more historical data (days/weeks)
4. **Custom Intervals**: Let users choose 1min, 5min, 15min, 1h
5. **Technical Indicators**: Add RSI, MACD, Bollinger Bands

### Alternative Solutions:
- If Twelve Data doesn't work well, consider:
  - CoinGecko API (free tier)
  - Binance WebSocket (free)
  - Helius for on-chain Solana data

## Troubleshooting

### Issue: Chart shows "Error" status
**Solution**: Most likely the meme coin isn't on Twelve Data. It should fallback to SOL/USD automatically. Check console for errors.

### Issue: "Only 1 WebSocket connection available" error
**Solution**: This is handled automatically. The manager closes old connections before opening new ones.

### Issue: Chart not updating in real-time
**Solution**: 
1. Check browser console for WebSocket errors
2. Verify API key is correct: `5bbbe353245a4b0795eed57ad93e72cc`
3. Check Twelve Data API status

### Issue: Historical data won't load
**Solution**: 
1. Check REST API response in Network tab
2. Verify API key hasn't expired
3. Check if you hit rate limits

## API Key Security Note

⚠️ **Important**: The API key is currently hardcoded in the frontend. For production:
1. Move API key to environment variables
2. Proxy requests through your backend
3. Add rate limiting on backend
4. Monitor usage via Twelve Data dashboard

## Monitoring Usage

Track your Twelve Data usage at:
https://twelvedata.com/account/usage

Watch for:
- WebSocket connection count (max 1)
- WebSocket credits remaining (you have 8)
- REST API calls for historical data

---

**Implementation Complete** ✅

The Twelve tab is now live and ready to use. It will show real-time price updates with historical context, all while respecting your free plan API limits.
