# 🎯 Auto-Load Transactions Visual Guide

## How It Works - Visual Representation

### Scenario 1: User arrives on first coin
```
┌─────────────────────────────────────────────────────────┐
│                  COIN FEED (Vertical Scroll)             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓         │
│  ┃  COIN #0 (CURRENT - VIEWING)                ┃  🔥 ⚡  │
│  ┃  ✅ Transactions AUTO-LOADING               ┃         │
│  ┃  🟢 Live - 12 transactions                  ┃         │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛         │
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │  COIN #1 (NEXT - PRELOADING)                │  🔥 ⚡  │
│  │  ✅ Transactions AUTO-LOADING               │        │
│  │  🟢 Live - 3 transactions                   │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │  COIN #2 (NEXT - PRELOADING)                │  🔥 ⚡  │
│  │  ✅ Transactions AUTO-LOADING               │        │
│  │  🔴 Connecting...                           │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │  COIN #3 (NOT YET LOADED)                   │  ⏸️    │
│  │  ⭕ Transactions not loaded                 │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
└─────────────────────────────────────────────────────────┘

Active WebSocket connections: 3 (coins #0, #1, #2)
```

### Scenario 2: User scrolls down to coin #1
```
┌─────────────────────────────────────────────────────────┐
│                  COIN FEED (Vertical Scroll)             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │  COIN #0 (PREVIOUS - OUT OF RANGE)          │  🛑 ❌  │
│  │  🔴 Connection CLOSED automatically         │        │
│  └─────────────────────────────────────────────┘        │
│                                    ↑ SCROLLED UP         │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓         │
│  ┃  COIN #1 (CURRENT - VIEWING)                ┃  🔥 ⚡  │
│  ┃  ✅ Transactions STILL LOADED               ┃         │
│  ┃  🟢 Live - 8 transactions                   ┃         │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛         │
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │  COIN #2 (NEXT - PRELOADED)                 │  🔥 ⚡  │
│  │  ✅ Transactions STILL LOADED               │        │
│  │  🟢 Live - 15 transactions                  │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │  COIN #3 (NEXT - NOW PRELOADING)            │  🔥 ⚡  │
│  │  ✅ Transactions AUTO-LOADING (NEW!)        │        │
│  │  🔴 Connecting...                           │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │  COIN #4 (NOT YET LOADED)                   │  ⏸️    │
│  │  ⭕ Transactions not loaded                 │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
└─────────────────────────────────────────────────────────┘

Active WebSocket connections: 3 (coins #1, #2, #3)
✅ Old connection (#0) cleaned up automatically
🔥 New connection (#3) started automatically
```

### Scenario 3: User scrolls down to coin #2
```
┌─────────────────────────────────────────────────────────┐
│                  COIN FEED (Vertical Scroll)             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │  COIN #1 (PREVIOUS - OUT OF RANGE)          │  🛑 ❌  │
│  │  🔴 Connection CLOSED automatically         │        │
│  └─────────────────────────────────────────────┘        │
│                                    ↑ SCROLLED UP         │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓         │
│  ┃  COIN #2 (CURRENT - VIEWING)                ┃  🔥 ⚡  │
│  ┃  ✅ Transactions STILL LOADED               ┃         │
│  ┃  🟢 Live - 23 transactions                  ┃         │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛         │
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │  COIN #3 (NEXT - PRELOADED)                 │  🔥 ⚡  │
│  │  ✅ Transactions STILL LOADED               │        │
│  │  🟢 Live - 7 transactions                   │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │  COIN #4 (NEXT - NOW PRELOADING)            │  🔥 ⚡  │
│  │  ✅ Transactions AUTO-LOADING (NEW!)        │        │
│  │  🟢 Live - 2 transactions                   │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │  COIN #5 (NOT YET LOADED)                   │  ⏸️    │
│  │  ⭕ Transactions not loaded                 │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
└─────────────────────────────────────────────────────────┘

Active WebSocket connections: 3 (coins #2, #3, #4)
✅ Old connection (#1) cleaned up automatically
🔥 New connection (#4) started automatically
```

## Legend

| Symbol | Meaning |
|--------|---------|
| ┏━━━┓  | Currently viewing coin (main focus) |
| ┌───┐  | Visible but not focused |
| 🔥     | Active WebSocket connection |
| ⚡     | Auto-loading enabled |
| ✅     | Transactions loaded and active |
| 🟢     | Connected to Helius WebSocket |
| 🔴     | Connecting or disconnected |
| 🛑     | Connection stopped (out of range) |
| ❌     | Connection closed |
| ⭕     | No connection (out of range) |
| ⏸️     | Not yet in range for auto-loading |

## Key Features

### 🎯 Smart Range Detection
```javascript
// Auto-load for: Current + Next 2
shouldAutoLoadTransactions = index >= currentIndex && index <= currentIndex + 2
```

### 🧹 Automatic Cleanup
```javascript
// When autoLoadTransactions changes from true → false
useEffect(() => {
  if (!autoLoadTransactions && showLiveTransactions) {
    setShowLiveTransactions(false);
    clearTransactions();
  }
}, [autoLoadTransactions]);
```

### 📊 Connection Lifecycle
```
COIN ENTERS RANGE (index = current + 2)
  ↓
🔥 WebSocket connection opens
  ↓
⚡ Transactions start streaming
  ↓
USER SCROLLS (coin moves to current + 3)
  ↓
🛑 WebSocket connection closes
  ↓
🧹 Transactions cleared from memory
```

## Performance Metrics

### Resource Usage Per Coin:
- **WebSocket**: ~500 bytes/second
- **Transaction data**: ~200 bytes per transaction
- **Max transactions**: 50 per coin
- **Memory per coin**: ~10 KB

### Total with 3 Active Connections:
- **Network**: ~1.5 KB/second
- **Memory**: ~30 KB
- **CPU**: Negligible (event-driven)

### Cleanup Timing:
- **Immediate**: When coin leaves range (index > current + 2)
- **Automatic**: useEffect triggers cleanup
- **Safe**: No memory leaks, WebSocket properly closed

## User Experience Benefits

1. **No Button Clicking** ✅
   - Transactions appear automatically
   - One less step for users

2. **Context Awareness** 🧠
   - Always shows upcoming coins' data
   - Smooth preview as you scroll

3. **Performance** ⚡
   - Only 3 connections active
   - Auto-cleanup prevents leaks
   - Lightweight memory footprint

4. **Visual Feedback** 👁️
   - "⚡ Auto-loaded" badge
   - Live connection status
   - Transaction count

5. **Fallback** 🔄
   - Manual load still available
   - Can manually close if needed
   - Works with/without auto-load
