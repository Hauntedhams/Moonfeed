# 🧪 Auto-Load Transactions Testing Guide

## Quick Test Steps

### 1. Start the Application
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 2. Open Browser Console
- Press `F12` or `Cmd+Option+I` (Mac)
- Go to Console tab
- Look for these log messages:

```javascript
// When landing on a coin
"🔄 Auto-loading transactions for coin: [COIN_NAME]"

// When scrolling away
"🛑 Stopping auto-loaded transactions for coin: [COIN_NAME]"
```

### 3. Basic Functionality Test

#### Test A: Initial Load
1. Open the app
2. Wait for coins to load
3. **Expected**: 
   - Current coin shows transactions section
   - Badge says "⚡ Auto-loaded"
   - Status shows "🟢 Live"
   - Transactions start appearing

#### Test B: Scroll Down
1. Scroll to next coin
2. **Expected**:
   - Previous coin's transactions stop (out of console)
   - Current coin's transactions continue
   - Next coin's transactions start loading
   - Always 3 active connections

#### Test C: Rapid Scrolling
1. Scroll quickly through 5-10 coins
2. **Expected**:
   - No lag or freezing
   - Connections open/close smoothly
   - No memory spike in DevTools

### 4. Network Tab Verification

#### Check WebSocket Connections
1. Open DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. **Expected**:
   - See 3-4 WebSocket connections to Helius
   - Old connections close (status: closed)
   - New connections open as you scroll

#### Monitor Data Transfer
1. Look at WebSocket frames
2. **Expected**:
   - Receiving messages every 1-2 seconds
   - ~500 bytes per message
   - No excessive data transfer

### 5. Performance Testing

#### Memory Leak Check
1. Open DevTools → Memory tab
2. Take heap snapshot
3. Scroll through 20 coins
4. Take another heap snapshot
5. **Expected**:
   - Memory increase < 5 MB
   - No retained WebSocket objects from old coins

#### CPU Usage
1. Open DevTools → Performance tab
2. Start recording
3. Scroll through 10 coins
4. Stop recording
5. **Expected**:
   - CPU spikes only during scrolling
   - Idle CPU < 5%
   - No long tasks (> 50ms)

### 6. Edge Cases

#### Test 1: No Internet
1. Disconnect network
2. **Expected**:
   - Status shows "🔴 Connecting..."
   - Error message appears (if applicable)
   - No crash or freeze

#### Test 2: Invalid Token
1. Find coin with no transactions
2. **Expected**:
   - Shows "Waiting for transactions..."
   - Status shows "🟢 Live"
   - No errors in console

#### Test 3: Manual Load Override
1. Scroll to coin with auto-load
2. Click close button (if visible)
3. **Expected**:
   - Transactions stay open (auto-load overrides)
   - Close button should be hidden

### 7. Visual Verification Checklist

- [ ] Green "⚡ Auto-loaded" badge visible
- [ ] Badge has pulsing glow animation
- [ ] Transaction count updates in real-time
- [ ] "🟢 Live" indicator shows when connected
- [ ] "🔴 Connecting..." shows during connection
- [ ] Transaction list updates without lag
- [ ] No close button on auto-loaded transactions
- [ ] Smooth scroll between coins

## Console Logs to Watch For

### ✅ Good Logs (Expected)
```
🔄 Auto-loading transactions for coin: BONK
✅ Helius WebSocket connected
📡 Subscribed to logs for: [TOKEN_ADDRESS]
⚡ New transaction detected: 8d5f2a3b
```

### ⚠️ Warning Logs (Check but OK)
```
🔴 Connecting...
Waiting for transactions...
```

### ❌ Error Logs (Should NOT See)
```
❌ WebSocket error: [error]
Memory leak detected
Uncaught TypeError: [error]
```

## WebSocket Connection Verification

### Check Active Connections
Open browser console and run:
```javascript
// Count active WebSocket connections
console.log('WebSocket connections:', 
  performance.getEntriesByType('resource')
    .filter(r => r.name.includes('helius'))
    .length
);
```

**Expected**: Should show 3-4 connections

### Monitor Connection Status
```javascript
// Watch for connection changes
window.addEventListener('beforeunload', () => {
  console.log('Cleaning up connections before page unload');
});
```

**Expected**: Connections should close cleanly

## Performance Benchmarks

### Acceptable Ranges:
| Metric | Target | Max Acceptable |
|--------|--------|----------------|
| Memory per coin | 10 KB | 20 KB |
| Total memory (3 coins) | 30 KB | 100 KB |
| Network per second | 1.5 KB/s | 5 KB/s |
| Connection time | < 1 second | < 3 seconds |
| Transaction render | < 50ms | < 100ms |
| Scroll FPS | 60 FPS | 30 FPS |

### How to Measure:
1. **Memory**: DevTools → Memory → Heap Snapshot
2. **Network**: DevTools → Network → WS filter
3. **FPS**: DevTools → Performance → FPS meter
4. **Timing**: DevTools → Console timestamps

## Troubleshooting

### Issue: Transactions not loading
**Check**:
1. Is WebSocket URL correct? (`wss://mainnet.helius-rpc.com`)
2. Is API key valid?
3. Is token address valid?
4. Check browser console for errors

### Issue: Too many connections
**Check**:
1. Is cleanup happening? (check console logs)
2. Are old connections closing?
3. Network tab shows closed connections?

### Issue: Slow performance
**Check**:
1. Memory usage (should be < 100 MB total)
2. CPU usage (should be < 10% idle)
3. Network speed (should be < 5 KB/s)
4. Transaction limit (50 max per coin)

### Issue: Missing visual indicators
**Check**:
1. CSS loaded properly?
2. Badge visible in DOM?
3. Animation playing?
4. Browser supports CSS animations?

## Success Criteria

### Must Have ✅
- [x] Auto-loads 3 coins at a time
- [x] Closes old connections automatically
- [x] Shows "⚡ Auto-loaded" badge
- [x] No memory leaks after scrolling
- [x] Performance stays smooth (60 FPS)

### Nice to Have 🎯
- [ ] Loading skeleton while connecting
- [ ] Toast notification for new transactions
- [ ] Settings to disable auto-load
- [ ] Transaction count badge on card

## Test Results Template

```markdown
## Test Results - [Date]

### Environment
- Browser: [Chrome/Firefox/Safari]
- OS: [macOS/Windows/Linux]
- Screen: [Mobile/Desktop]

### Functionality Tests
- [ ] Initial load works
- [ ] Scrolling triggers auto-load
- [ ] Old connections close
- [ ] Badge appears correctly
- [ ] Transactions update live

### Performance Tests
- Memory usage: [X] KB (target: < 100 KB)
- Network usage: [X] KB/s (target: < 5 KB/s)
- Scroll FPS: [X] (target: 60 FPS)
- Connection time: [X] seconds (target: < 1s)

### Issues Found
1. [Issue description]
2. [Issue description]

### Screenshots
[Attach relevant screenshots]

### Overall Status
✅ Pass / ⚠️ Pass with issues / ❌ Fail
```

## Quick Debug Commands

### Check WebSocket State
```javascript
// In browser console
console.log('Active WebSockets:', 
  Object.values(window)
    .filter(v => v instanceof WebSocket)
);
```

### Force Connection Close
```javascript
// In browser console
const ws = /* find your WebSocket */;
ws.close();
console.log('Connection closed manually');
```

### Monitor Transaction Count
```javascript
// In browser console
setInterval(() => {
  const count = document.querySelectorAll('.transaction-item').length;
  console.log('Total transactions visible:', count);
}, 2000);
```

## Final Checklist Before Deploy

- [ ] All tests pass
- [ ] No console errors
- [ ] Memory usage acceptable
- [ ] Network usage acceptable
- [ ] Visual indicators working
- [ ] Mobile tested
- [ ] Desktop tested
- [ ] Edge cases handled
- [ ] Documentation updated
- [ ] Code reviewed

---

**Status**: Ready for testing
**Next Steps**: Run through all test scenarios and report results
