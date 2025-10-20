# 🌙 Moonfeed - TikTok-Style Meme Coin Discovery App

A modern, high-performance fullstack application for discovering and tracking Solana meme coins with a TikTok-style vertical scroll interface.

## 🚀 Features

- **TikTok-Style Vertical Scroll**: Swipe through coins with smooth, native-feeling scrolling
- **Real-Time Data**: Live price updates via WebSocket (desktop only for performance)
- **Advanced Enrichment**: Automatic fetching of banners, socials, rugcheck data, and token info
- **Interactive Charts**: Multiple chart views (1s, 10-point, 24h blended, DexScreener)
- **Live Transactions**: Real-time transaction feed powered by Helius
- **Smart Filters**: Custom filters for market cap, volume, age, holders, and more
- **Jupiter Integration**: Built-in swap functionality with limit orders
- **Mobile Optimized**: Animations disabled on mobile for smooth 60fps performance
- **Top Traders**: View top traders and wallet analytics

## 📦 Tech Stack

### Frontend
- **Framework**: React 18 + Vite
- **State Management**: React Hooks + Context API
- **Charts**: Lightweight Charts, Chart.js, Recharts
- **Blockchain**: Solana Web3.js + Wallet Adapter
- **Styling**: Custom CSS with modern animations

### Backend
- **Framework**: Express.js
- **APIs**: DexScreener, Pump.fun, Helius, Birdeye
- **Caching**: In-memory with TTL
- **WebSocket**: Real-time price/chart updates

## 🏃 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd moonfeed-alpha-copy-3

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### Environment Variables

Create `.env` files in both frontend and backend directories:

**Backend `.env`:**
```env
PORT=3001
HELIUS_API_KEY=your_helius_key
BIRDEYE_API_KEY=your_birdeye_key
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### Running the Application

```bash
# Terminal 1 - Start Backend
cd backend
npm run dev

# Terminal 2 - Start Frontend
cd frontend
npm run dev
```

The app will be available at:
- Frontend: http://localhost:5175
- Backend: http://localhost:3001

## 🎯 Usage

1. **Browse Coins**: Scroll vertically through the feed
2. **Expand Details**: Tap a coin to see full details, charts, and transactions
3. **Trade**: Click the trade button to open Jupiter swap modal
4. **Filter**: Use the filter button to apply custom filters
5. **Favorites**: Star coins to add them to your favorites list

## 🏗️ Project Structure

```
moonfeed-alpha-copy-3/
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Utility functions
│   │   ├── config/         # Configuration files
│   │   └── App.jsx         # Main app component
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── services/       # API services
│   │   ├── routes/         # Express routes
│   │   └── server.js       # Main server file
│   └── package.json
└── docs/                   # Documentation archive
```

## 🔧 Configuration

### Backend API Configuration
Edit `backend/src/config/api.js` to adjust:
- API endpoints
- Rate limits
- Cache TTL
- WebSocket settings

### Frontend Features
Edit `frontend/src/config/api.js` to toggle:
- Live data (desktop/mobile)
- Auto-enrichment
- Chart auto-load
- Transaction feeds

## 📊 Performance

- **Initial Load**: < 2s
- **Time to Interactive**: < 3s
- **Mobile Performance Score**: 85+
- **Bundle Size**: < 1.5MB (gzipped)

### Performance Features
- ✅ Mobile animations disabled
- ✅ Lazy loading for heavy components
- ✅ React.memo for optimized re-renders
- ✅ Virtual scrolling ready
- ✅ Debug logs disabled in production

## 🚀 Deployment

### Build for Production

```bash
# Build frontend
cd frontend
npm run build

# Build backend (if needed)
cd backend
npm run build
```

### Deploy
- Frontend: Deploy `frontend/dist` to Vercel, Netlify, or any static host
- Backend: Deploy to Railway, Render, or any Node.js host

## 📝 Documentation

Additional documentation is available in the `docs/` folder:
- `docs/features/` - Feature documentation
- `docs/fixes/` - Bug fix history
- `docs/deployment/` - Deployment guides
- `docs/archive/` - Historical documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

- DexScreener API
- Pump.fun API
- Helius RPC
- Birdeye API
- Solana Foundation
