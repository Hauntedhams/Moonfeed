#!/usr/bin/env node

/**
 * 🔬 DIAGNOSTIC: Test Live Price Rendering
 * 
 * This diagnostic checks if:
 * 1. The backend is broadcasting Jupiter price updates
 * 2. The frontend WebSocket is receiving them
 * 3. The coins Map is being updated
 * 4. The updateCount is incrementing
 * 5. The CoinCard component is re-rendering
 * 
 * Run this while the app is running and watch for price updates.
 */

console.log('🔬 Live Price Rendering Diagnostic');
console.log('='.repeat(80));
console.log('');
console.log('📋 CHECKLIST:');
console.log('1. ✅ Backend is running (npm run dev in /backend)');
console.log('2. ✅ Frontend is running (npm run dev in /frontend)');
console.log('3. 🌐 Open http://localhost:5173 in your browser');
console.log('4. 🔧 Open DevTools Console (Cmd+Option+I on Mac)');
console.log('');
console.log('🔍 WHAT TO LOOK FOR IN CONSOLE:');
console.log('');
console.log('Backend logs (terminal):');
console.log('  💰 [Jupiter] Fetching prices for X coins...');
console.log('  🚀 [Jupiter] Broadcasting prices to Y clients');
console.log('');
console.log('Frontend logs (browser console):');
console.log('  💰 [WebSocket] Jupiter price update received: X coins');
console.log('  💰 [WebSocket] Sample price: SYMBOL = $X.XXXXXX');
console.log('  💰 [WebSocket] Updated Map for SYMBOL : X.XXXXXX');
console.log('  💰 [WebSocket] Coins Map updated, new size: XXX');
console.log('  🔄 [CoinCard] liveData updated for SYMBOL: {...}');
console.log('  💰 [CoinCard] Price compute for SYMBOL: {...}');
console.log('');
console.log('🚨 PROBLEM INDICATORS:');
console.log('');
console.log('❌ If you see "Jupiter price update received" but NO "CoinCard" logs:');
console.log('   → The coins Map is updating but CoinCard is not re-rendering');
console.log('   → Check that updateCount is in the useMemo dependencies');
console.log('');
console.log('❌ If you see "CoinCard liveData updated" but price doesn\'t change on screen:');
console.log('   → React is re-rendering but displayPrice calculation is wrong');
console.log('   → Check the displayPrice useMemo logic');
console.log('');
console.log('❌ If you see NO "Jupiter price update received":');
console.log('   → WebSocket is not receiving broadcasts from backend');
console.log('   → Check backend logs and WebSocket connection');
console.log('');
console.log('🔧 MANUAL TESTS:');
console.log('');
console.log('Test 1: Check updateCount is incrementing');
console.log('  1. Open browser console');
console.log('  2. Type: window.__updateCount = 0');
console.log('  3. Find this code in useLiveDataContext.jsx and add:');
console.log('     setUpdateCount(prev => {');
console.log('       const next = prev + 1;');
console.log('       window.__updateCount = next;');
console.log('       console.log("🔢 updateCount incremented:", next);');
console.log('       return next;');
console.log('     });');
console.log('  4. Watch for "🔢 updateCount incremented" logs');
console.log('');
console.log('Test 2: Force re-render of CoinCard');
console.log('  1. In browser console, type:');
console.log('     window.dispatchEvent(new Event("resize"))');
console.log('  2. This forces React to re-check components');
console.log('  3. See if prices update after this');
console.log('');
console.log('Test 3: Check if liveData object reference is changing');
console.log('  1. Add to CoinCard.jsx after const liveData = useMemo(...):');
console.log('     useEffect(() => {');
console.log('       console.log("🔄 liveData reference changed for", coin.symbol, liveData);');
console.log('     }, [liveData]);');
console.log('  2. Watch for "🔄 liveData reference changed" logs');
console.log('');
console.log('='.repeat(80));
console.log('');
console.log('💡 TIP: The issue is likely that:');
console.log('   - The coins Map IS being updated (new Map reference created)');
console.log('   - The updateCount IS being incremented');
console.log('   - But CoinCard useMemo is NOT re-computing because the dependencies');
console.log('     are not triggering properly, OR the component is not re-rendering');
console.log('     even though useMemo should return a new value.');
console.log('');
console.log('🎯 SOLUTION: We need to ensure that when coins Map changes,');
console.log('   the liveData useMemo re-executes AND the component re-renders.');
console.log('');
