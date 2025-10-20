# Jupiter Ultra Search - System Architecture

## 🏗️ Complete Integration Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                    (React + Vite Frontend)                      │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BOTTOM NAVIGATION BAR                        │
│  [Home] [Chart] [🔍 Search] [Filter] [Settings]                │
│                      └──┐                                       │
│                         │ onClick                               │
│                         ▼                                       │
│              ┌──────────────────────┐                          │
│              │ CoinSearchModal.jsx  │                          │
│              └──────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ User types "SOL"
                                 │ (debounce 300ms)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND COMPONENT                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CoinSearchModal                                        │   │
│  │  ├─ Search Input                                        │   │
│  │  ├─ Filter Panel (collapsible)                         │   │
│  │  │  ├─ Verified Only ☐                                 │   │
│  │  │  ├─ Exclude Suspicious ☐                            │   │
│  │  │  ├─ Min Liquidity: [____]                           │   │
│  │  │  └─ Sort By: [Liquidity ▼]                          │   │
│  │  └─ Results List                                        │   │
│  │     ├─ Result Card 1 (Wrapped SOL)                     │   │
│  │     ├─ Result Card 2 (Solana)                          │   │
│  │     └─ Result Card 3 (...)                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    API Request: GET /api/search
                    ?query=SOL
                    &verifiedOnly=false
                    &minLiquidity=0
                    &sort=liquidity
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND SERVER                            │
│                    (Express.js on :3001)                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  server.js                                              │   │
│  │  app.use('/api/search', searchRoutes)                  │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                    │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  routes/search.js                                       │   │
│  │  router.get('/', async (req, res) => {                 │   │
│  │    const { query, sort, verifiedOnly, ... } = req.query│   │
│  │    const result = await jupiterUltraSearchService      │   │
│  │                        .searchTokens(query)             │   │
│  │    // Apply filters & sorting                          │   │
│  │    res.json({ success: true, results })                │   │
│  │  })                                                     │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                    │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  services/jupiterUltraSearchService.js                  │   │
│  │  async searchTokens(query) {                            │   │
│  │    const response = await fetch(                        │   │
│  │      `${JUPITER_ULTRA_API}/search?query=${query}`      │   │
│  │    )                                                    │   │
│  │    return transformTokenData(results)                   │   │
│  │  }                                                      │   │
│  └────────────────────────┬────────────────────────────────┘   │
└──────────────────────────┼─────────────────────────────────────┘
                           │
           External API Call: GET https://lite-api.jup.ag/ultra/v1/search
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    JUPITER ULTRA API                            │
│                https://lite-api.jup.ag/ultra/v1                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  GET /search?query=SOL                                  │   │
│  │                                                         │   │
│  │  Returns:                                               │   │
│  │  {                                                      │   │
│  │    "id": "So11111111111111111111111111111111111111112",│   │
│  │    "symbol": "SOL",                                     │   │
│  │    "name": "Wrapped SOL",                               │   │
│  │    "icon": "https://...",                               │   │
│  │    "decimals": 9,                                       │   │
│  │    "usdPrice": 145.32,                                  │   │
│  │    "mcap": 68500000000,                                 │   │
│  │    "liquidity": 45000000,                               │   │
│  │    "holderCount": 1234567,                              │   │
│  │    "stats24h": {                                        │   │
│  │      "priceChange": 5.23,                               │   │
│  │      "volumeChange": 1234567,                           │   │
│  │      ...                                                │   │
│  │    },                                                   │   │
│  │    "audit": {                                           │   │
│  │      "isSus": false,                                    │   │
│  │      "mintAuthorityDisabled": true,                     │   │
│  │      ...                                                │   │
│  │    },                                                   │   │
│  │    "organicScore": 85,                                  │   │
│  │    "organicScoreLabel": "high",                         │   │
│  │    "isVerified": true                                   │   │
│  │  }                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ Response data
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATA TRANSFORMATION                           │
│                                                                 │
│  Jupiter Format → Moonfeed Format                              │
│                                                                 │
│  {                              {                               │
│    id → mintAddress             mintAddress: "So111...",       │
│    symbol → symbol              symbol: "SOL",                 │
│    name → name                  name: "Wrapped SOL",           │
│    icon → image                 image: "https://...",          │
│    usdPrice → price             price: 145.32,                 │
│    mcap → marketCap             marketCap: 68500000000,        │
│    stats24h.priceChange →       change24h: 5.23,               │
│         change24h               organicScore: "High",          │
│    organicScoreLabel →          verified: true,                │
│         organicScore            suspicious: false,             │
│    isVerified → verified        ...                            │
│    audit.isSus → suspicious     }                              │
│    ...                                                          │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ Transformed data
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FILTERING & SORTING                          │
│                                                                 │
│  if (verifiedOnly) {                                            │
│    results = results.filter(t => t.verified === true)          │
│  }                                                              │
│                                                                 │
│  if (excludeSuspicious) {                                       │
│    results = results.filter(t => t.suspicious === false)       │
│  }                                                              │
│                                                                 │
│  if (minLiquidity) {                                            │
│    results = results.filter(t => t.liquidity >= minLiquidity)  │
│  }                                                              │
│                                                                 │
│  if (sort === 'liquidity') {                                    │
│    results.sort((a, b) => b.liquidity - a.liquidity)           │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ Filtered & sorted results
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RESPONSE TO FRONTEND                       │
│                                                                 │
│  {                                                              │
│    success: true,                                               │
│    results: [                                                   │
│      {                                                          │
│        mint: "So11111...",                                      │
│        symbol: "SOL",                                           │
│        name: "Wrapped SOL",                                     │
│        image: "https://...",                                    │
│        price: 145.32,                                           │
│        marketCap: 68500000000,                                  │
│        liquidity: 45000000,                                     │
│        holderCount: 1234567,                                    │
│        change24h: 5.23,                                         │
│        organicScore: "High",                                    │
│        verified: true,                                          │
│        suspicious: false                                        │
│      },                                                         │
│      { ... },                                                   │
│      { ... }                                                    │
│    ],                                                           │
│    count: 15                                                    │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ JSON response
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND RENDERING                           │
│                                                                 │
│  searchResults.map(token => (                                   │
│    <div className="search-result-card">                         │
│      <img src={token.image} />                                  │
│      <div className="info">                                     │
│        <h4>{token.name} {token.verified && ✓}</h4>             │
│        <span>${token.symbol}</span>                             │
│        <div className="stats">                                  │
│          <span>Price: ${token.price}</span>                     │
│          <span>MC: {formatNumber(token.marketCap)}</span>       │
│          <span>Liq: {formatNumber(token.liquidity)}</span>      │
│        </div>                                                   │
│        <div className="badges">                                 │
│          <span className={token.change24h > 0 ? "up" : "down"}>│
│            {token.change24h >= 0 ? "↑" : "↓"} {token.change24h}%│
│          </span>                                                │
│          <span className={getOrganicScoreColor(...)}>          │
│            {token.organicScore}                                 │
│          </span>                                                │
│          <span>👥 {token.holderCount.toLocaleString()}</span>  │
│        </div>                                                   │
│      </div>                                                     │
│    </div>                                                       │
│  ))                                                             │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ User clicks result
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     USER ACTION FLOW                            │
│                                                                 │
│  1. User clicks search result                                   │
│  2. handleResultClick(tokenData) triggered                      │
│  3. Token data transformed to Moonfeed format                   │
│  4. onCoinSelect(coinData) callback fired                       │
│  5. Modal closes                                                │
│  6. Token added to feed                                         │
│  7. User sees token in main feed                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Sequence

```
1. User Input
   └─> "SOL" typed in search input
       └─> 300ms debounce timer starts
           └─> Timer completes, search triggered

2. API Request
   └─> Frontend → Backend: GET /api/search?query=SOL
       └─> Backend → Jupiter: GET /ultra/v1/search?query=SOL

3. Data Processing
   └─> Jupiter returns raw data
       └─> Backend transforms to Moonfeed format
           └─> Backend applies filters (verified, suspicious, liquidity)
               └─> Backend sorts results (by liquidity, market cap, etc.)

4. Response
   └─> Backend → Frontend: JSON with results array
       └─> Frontend updates state: setSearchResults(results)
           └─> React re-renders result cards

5. User Interaction
   └─> User clicks result card
       └─> Token data passed to onCoinSelect
           └─> Token added to feed
               └─> Modal closes
```

---

## 📊 File Structure

```
moonfeed-alpha-copy-3/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── CoinSearchModal.jsx      ← Search component
│       │   ├── CoinSearchModal.css      ← Search styles
│       │   └── BottomNavBar.jsx         ← Search button
│       └── App.jsx                      ← Modal mount point
│
├── backend/
│   ├── services/
│   │   └── jupiterUltraSearchService.js ← Search service
│   ├── routes/
│   │   └── search.js                    ← Search routes
│   └── server.js                        ← Route mounting
│
└── docs/
    ├── SEARCH_INTEGRATION_COMPLETE.md   ← Full docs
    ├── JUPITER_ULTRA_SEARCH_INTEGRATION.md
    ├── SEARCH_TESTING_GUIDE.md
    ├── SEARCH_BEFORE_AFTER.md
    └── SEARCH_QUICK_REFERENCE.md        ← This file
```

---

## 🎯 Integration Points

### 1. User Interface
- **Component**: `CoinSearchModal.jsx`
- **Trigger**: Search button in `BottomNavBar.jsx`
- **State**: `searchModalOpen` in `App.jsx`

### 2. API Layer
- **Endpoint**: `/api/search`
- **Method**: `GET`
- **Server**: `localhost:3001`

### 3. External Service
- **Provider**: Jupiter Ultra API
- **Endpoint**: `https://lite-api.jup.ag/ultra/v1/search`
- **Tier**: Free (with rate limits)

---

## ✅ Complete Integration Checklist

- [x] Backend service created
- [x] Backend routes created
- [x] Routes mounted in server
- [x] Frontend component rewritten
- [x] Frontend CSS redesigned
- [x] Debounce implemented
- [x] Filters implemented
- [x] Sorting implemented
- [x] Badges implemented
- [x] Mobile responsive
- [x] Error handling
- [x] Loading states
- [x] Image fallbacks
- [x] Documentation
- [x] Testing

**Status**: ✅ COMPLETE & PRODUCTION READY

---

This diagram shows the complete end-to-end flow of the Jupiter Ultra Search integration, from user interaction to data display.
