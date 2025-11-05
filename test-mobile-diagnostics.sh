#!/bin/bash

echo "📱 MOBILE PERFORMANCE DIAGNOSTIC TOOL"
echo "======================================"
echo ""

echo "🔍 Running diagnostics..."
echo ""

# Check if app is running
if ! curl -s http://localhost:5173 > /dev/null; then
  echo "❌ Frontend not running on localhost:5173"
  echo "   Start with: cd frontend && npm run dev"
  exit 1
fi

if ! curl -s http://localhost:3001/api/version > /dev/null; then
  echo "❌ Backend not running on localhost:3001"
  echo "   Start with: cd backend && npm run dev"
  exit 1
fi

echo "✅ Frontend running on http://localhost:5173"
echo "✅ Backend running on http://localhost:3001"
echo ""

echo "📊 Testing Mobile Optimizations..."
echo ""

# Test 1: Check MobileOptimizer exists
echo "Test 1: MobileOptimizer utility"
if grep -q "MobileOptimizer" frontend/src/utils/mobileOptimizer.js; then
  echo "  ✅ MobileOptimizer.js exists"
else
  echo "  ❌ MobileOptimizer.js missing"
fi

# Test 2: Check Performance Monitor exists
echo ""
echo "Test 2: Performance Monitor"
if grep -q "PerformanceMonitor" frontend/src/utils/performanceMonitor.js; then
  echo "  ✅ performanceMonitor.js exists"
else
  echo "  ❌ performanceMonitor.js missing"
fi

# Test 3: Check if compression is enabled
echo ""
echo "Test 3: Backend Compression"
if grep -q "compression" backend/server.js; then
  echo "  ✅ Compression middleware enabled"
else
  echo "  ❌ Compression not found"
fi

# Test 4: Check lazy loading
echo ""
echo "Test 4: Lazy Loading"
if grep -q "lazy(() => import" frontend/src/App.jsx; then
  echo "  ✅ Lazy loading implemented"
else
  echo "  ❌ Lazy loading not found"
fi

# Test 5: Check service worker
echo ""
echo "Test 5: Service Worker"
if [ -f "frontend/public/sw.js" ]; then
  echo "  ✅ Service worker exists"
else
  echo "  ❌ Service worker missing"
fi

# Test 6: Check mobile optimization in DexScreenerChart
echo ""
echo "Test 6: Chart Cleanup"
if grep -q "MobileOptimizer.destroyIframe" frontend/src/components/DexScreenerChart.jsx; then
  echo "  ✅ Aggressive chart cleanup enabled"
else
  echo "  ⚠️  Chart cleanup not optimized"
fi

echo ""
echo "======================================"
echo "📋 HOW TO TEST MOBILE PERFORMANCE"
echo "======================================"
echo ""

echo "1. Open http://localhost:5173 in Chrome"
echo ""
echo "2. Open DevTools (F12) > Console"
echo ""
echo "3. Run: MobileOptimizer.getMemoryStats()"
echo ""
echo "4. Use app for 10 minutes, then check again"
echo ""
echo "5. Memory should stay <100MB on mobile"
echo ""

echo "✅ Diagnostic complete!"
