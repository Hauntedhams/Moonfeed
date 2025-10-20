# Changelog

All notable changes to the Moonfeed project will be documented in this file.

## [Latest] - 2025-10-20

### 🎯 Performance Optimizations
- Organized documentation: moved 2,774+ markdown files to `docs/archive/`
- Mobile animations disabled for 60fps smooth scrolling
- Debug utility implemented - console.logs only in development mode
- CSS animation overhead reduced on mobile devices
- Bundle size optimization in progress

### ✨ Features
- TikTok-style vertical scroll interface
- Real-time price updates via WebSocket (desktop only)
- Auto-enrichment system for banners, socials, and token data
- Multi-chart views: 1s, 10-point, 24h blended, DexScreener
- Live transaction feed with Helius integration
- Jupiter swap integration with limit orders
- Advanced filtering system
- Top traders and wallet analytics
- Favorites system

### 🐛 Bug Fixes
- Fixed mobile force quit issues by disabling WebSocket on mobile
- Fixed chart auto-load timing issues
- Fixed enrichment status tracking
- Fixed banner modal click detection
- Fixed age/holders display uniformity

### 🔧 Technical Improvements
- Implemented debug utility for production-safe logging
- Added mobile detection and performance optimizations
- Improved chart rendering performance
- Optimized React component re-renders with React.memo
- Enhanced error handling and loading states

### 📚 Documentation
- Created comprehensive README.md
- Organized all documentation into `docs/` structure
- Archived historical documentation

## Previous Changes

See `docs/archive/` for detailed historical documentation of all features, fixes, and improvements.
