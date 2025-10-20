# 🔥 DEXtrending Feed - Feature Documentation

**Date**: October 20, 2025  
**Feature**: New feed using Dexscreener Trending API  
**Status**: ✅ Implemented and Ready to Test

---

## 📋 Overview

Added a new **DEXtrending** feed that displays the most boosted and trending tokens from Dexscreener across all Solana DEXes. This feed complements the existing feeds:

- **Graduating** - Pump.fun tokens close to graduating
- **Trending** - High-potential tokens from Solana Tracker
- **New** - Recently launched tokens
- **DEXtrending** ⭐ NEW - Top trending tokens from Dexscreener
- **Custom** - User-defined filters

---

## 🎯 What is DEXtrending?

The DEXtrending feed uses Dexscreener's token boosts API endpoint to show tokens that are:

- Most actively promoted and boosted by their communities
- Getting significant attention across Solana DEXes
- Trending based on Dexscreener's proprietary metrics
- Typically returns ~30 Solana tokens

These tokens represent what's "hot" in the Dexscreener ecosystem and often have strong community backing.

---

## 🔧 Technical Implementation

### Backend Changes

#### 1. New API Endpoint (`/api/coins/dextrending`)

**File**: `backend/server.js`

```javascript
app.get('/api/coins/dextrending', async (req, res) => {
  // Fetches trending coins from Dexscreener
  // Returns formatted coin data compatible with existing UI
  // Includes 15-minute caching for performance
});
```

**Features**:
- 15-minute cache to reduce API calls
- Auto-enrichment for top 20 coins (holders, age, etc.)
- Jupiter live price integration
- Limit parameter support (default: 30, max: 100)

#### 2. New Helper Function

**Function**: `fetchDexscreenerTrendingBatch()`

```javascript
// Fetches from: https://api.dexscreener.com/token-boosts/top/v1
// Filters for Solana tokens only
// Formats data to match existing coin structure
```

**Data Mapping**:
- `tokenAddress` → `mintAddress`
- `token.icon` → `image`, `profileImage`, `logo`
- `pairs[0]` → Price, market cap, volume, liquidity data
- Includes boost amount and links

#### 3. Caching System

**Variables**:
```javascript
let dextrendingCoins = [];           // Cache array
let dextrendingLastFetch = 0;        // Last fetch timestamp
const DEXTRENDING_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
```

**Benefits**:
- Reduces API load on Dexscreener
- Faster response times
- Fallback to stale cache on API errors

### Frontend Changes

#### 1. New Tab in TopTabs Component

**File**: `frontend/src/components/TopTabs.jsx`

```javascript
const tabs = [
  { id: 'graduating', label: 'Graduating', icon: 'graduation-cap' },
  { id: 'trending', label: 'Trending', icon: 'fire' },
  { id: 'new', label: 'New', icon: 'sparkles' },
  { id: 'dextrending', label: 'DEXtrending', icon: 'trending-up' }, // NEW
  { id: 'custom', label: 'Custom', icon: 'filter' }
];
```

**Icon**: Uses `trending-up` icon (chart with upward trend)

#### 2. ModernTokenScroller Integration

**File**: `frontend/src/components/ModernTokenScroller.jsx`

Added handling for `dextrending` filter type:

```javascript
else if (filters.type === 'dextrending') {
  endpoint = `${API_BASE}/dextrending`;
  console.log(`🔥 Using DEXTRENDING endpoint...`);
}
```

#### 3. CoinListModal Support

**File**: `frontend/src/components/CoinListModal.jsx`

**Title**: "DEXtrending Coins"

**Description**: "Top trending tokens from Dexscreener - the most boosted and actively promoted tokens across all Solana DEXes. These tokens are getting significant community attention and promotional activity."

---

## 🚀 Usage

### Starting the App

1. **Backend**:
```bash
cd backend
npm run dev
```

2. **Frontend**:
```bash
cd frontend
npm run dev
```

### Testing the New Feed

1. Open the app in your browser
2. Swipe or click to the **DEXtrending** tab
3. You should see ~30 trending tokens from Dexscreener
4. Tokens will have all standard features (expand, chart, trade, etc.)

### API Testing

**Direct API Call**:
```bash
curl http://localhost:3001/api/coins/dextrending | jq .
```

**With Limit**:
```bash
curl http://localhost:3001/api/coins/dextrending?limit=10 | jq .
```

**Test Script**:
```bash
node test-dexscreener-trending.js
```

---

## 📊 API Response Format

### Dexscreener Raw Response

```json
[
  {
    "chainId": "solana",
    "tokenAddress": "ABC123...",
    "amount": 15000,
    "totalAmount": 50000,
    "icon": "https://...",
    "links": { "twitter": "...", "website": "..." },
    "token": {
      "address": "ABC123...",
      "name": "Token Name",
      "symbol": "TKN",
      "icon": "https://..."
    },
    "pairs": [
      {
        "chainId": "solana",
        "dexId": "raydium",
        "pairAddress": "DEF456...",
        "priceUsd": "0.0123",
        "marketCap": "5000000",
        "liquidity": { "usd": 150000 },
        "volume": { "h24": 1200000 },
        "priceChange": { "h24": 15.5 },
        "pairCreatedAt": 1697234567000
      }
    ]
  }
]
```

### Formatted Response (API)

```json
{
  "success": true,
  "coins": [
    {
      "mintAddress": "ABC123...",
      "name": "Token Name",
      "symbol": "TKN",
      "image": "https://...",
      "price_usd": 0.0123,
      "market_cap_usd": 5000000,
      "volume_24h_usd": 1200000,
      "liquidity_usd": 150000,
      "price_change_24h": 15.5,
      "boostAmount": 15000,
      "totalAmount": 50000,
      "dexId": "raydium",
      "pairAddress": "DEF456...",
      "priority": 1,
      "source": "dexscreener-trending"
    }
  ],
  "count": 30,
  "total": 30,
  "timestamp": "2025-10-20T..."
}
```

---

## 🎨 UI/UX Features

### Tab Navigation

- **Swipe Support**: Users can swipe between tabs including DEXtrending
- **Mobile Optimized**: Touch-friendly with large tap targets
- **Visual Indicator**: Active tab highlighted with icon

### Coin Display

- **Standard Layout**: Same vertical scroll as other feeds
- **Expand/Collapse**: Full details, charts, and trade buttons
- **Enrichment**: Auto-enriches top 20 coins with holders, age, etc.
- **Live Prices**: Jupiter integration for real-time prices

### Modal Support

- **Coin List Modal**: Shows full list when tapping active DEXtrending tab
- **Search Integration**: DEXtrending coins included in search results
- **Trade Modal**: Jupiter swap interface for all tokens

---

## ⚡ Performance Optimizations

### Backend

1. **Caching**: 15-minute cache reduces API calls
2. **Fallback**: Returns stale cache on API errors
3. **Filtering**: Only Solana tokens processed
4. **Limit Support**: Configurable result count

### Frontend

1. **Lazy Loading**: Only loads visible coins
2. **Virtual Scroll**: Smooth performance with many tokens
3. **Background Enrichment**: Doesn't block initial render
4. **WebSocket Updates**: Live price updates (desktop only)

---

## 🧪 Testing Checklist

### Backend Tests

- [ ] API endpoint responds: `GET /api/coins/dextrending`
- [ ] Returns valid JSON with `success: true`
- [ ] Contains Solana tokens only
- [ ] Caching works (second request is faster)
- [ ] Limit parameter works (`?limit=10`)
- [ ] Enrichment applied to top coins
- [ ] Error handling (API down, rate limits)

### Frontend Tests

- [ ] DEXtrending tab appears in navigation
- [ ] Tab icon renders correctly (`trending-up`)
- [ ] Clicking tab switches to DEXtrending feed
- [ ] Coins display in vertical scroll
- [ ] Expand/collapse works
- [ ] Charts load on expand
- [ ] Trade button opens Jupiter modal
- [ ] Swiping works between tabs
- [ ] Coin list modal opens on active tab tap
- [ ] Mobile performance is smooth

### Integration Tests

- [ ] WebSocket connects and updates prices
- [ ] Favorites work with DEXtrending coins
- [ ] Search includes DEXtrending coins
- [ ] Filters work (if applicable)
- [ ] No console errors
- [ ] No memory leaks on tab switch

---

## 🐛 Known Issues / Notes

### API Limitations

1. **Rate Limits**: Dexscreener may have rate limits (not documented)
   - **Mitigation**: 15-minute cache reduces requests
   
2. **Token Count**: Returns ~30 Solana tokens (varies)
   - **Mitigation**: No hardcoded limits, handles any count

3. **Data Quality**: Some tokens may have missing fields
   - **Mitigation**: Fallback placeholders for missing data

### Future Enhancements

1. **Auto-Refresh**: Add periodic refresh (every 15 min)
2. **Notification**: Alert when new tokens appear
3. **Boost Indicator**: Show boost amount in UI
4. **Sorting**: Allow sorting by boost amount
5. **History**: Track trending history over time

---

## 📝 Code Locations

### Backend Files Modified

- `backend/server.js` - Main endpoint and logic
  - Line ~810: `/api/coins/dextrending` endpoint
  - Line ~520: `fetchDexscreenerTrendingBatch()` function
  - Line ~170: Cache variables

### Frontend Files Modified

- `frontend/src/components/TopTabs.jsx`
  - Line ~11: Added `dextrending` tab
  - Line ~130: Added swipe support
  
- `frontend/src/components/ModernTokenScroller.jsx`
  - Line ~365: Added endpoint handling
  
- `frontend/src/components/CoinListModal.jsx`
  - Line ~14: Added API URL mapping
  - Line ~65: Added title and description

### Test Files Created

- `test-dexscreener-trending.js` - API and endpoint test script

---

## 🎉 Summary

The DEXtrending feed is now fully integrated into Moonfeed! Users can discover the most boosted and promoted tokens from Dexscreener, giving them insight into what the community is excited about across all Solana DEXes.

### Key Benefits

✅ **New Discovery Channel**: Access to Dexscreener's trending algorithm  
✅ **Community Focus**: See what communities are promoting  
✅ **Full Integration**: Same features as other feeds  
✅ **Performance**: Cached and optimized  
✅ **Mobile Ready**: Touch-friendly navigation  

### Next Steps

1. Test the new feed thoroughly
2. Monitor API performance and rate limits
3. Gather user feedback
4. Consider adding boost indicators to UI
5. Implement auto-refresh if needed

---

**Ready to go live!** 🚀
