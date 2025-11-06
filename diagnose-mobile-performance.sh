#!/bin/bash

# 🚨 MOBILE FORCE RESTART DIAGNOSTIC SCRIPT
# This script helps diagnose why the mobile app is crashing/restarting

echo "🔍 MOONFEED MOBILE DIAGNOSTIC TOOL"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
  echo "❌ Error: Please run this script from the project root directory"
  exit 1
fi

echo "📱 Checking mobile-specific issues..."
echo ""

# 1. Check for RAF (requestAnimationFrame) usage
echo "1️⃣  Checking RAF usage..."
RAF_COUNT=$(grep -r "requestAnimationFrame" frontend/src --include="*.jsx" --include="*.js" | wc -l)
RAF_CANCEL_COUNT=$(grep -r "cancelAnimationFrame" frontend/src --include="*.jsx" --include="*.js" | wc -l)
echo "   - RAF calls found: $RAF_COUNT"
echo "   - RAF cancels found: $RAF_CANCEL_COUNT"
if [ $RAF_COUNT -gt $RAF_CANCEL_COUNT ]; then
  echo "   ⚠️  WARNING: More RAF calls than cancels - potential memory leak!"
else
  echo "   ✅ RAF usage looks balanced"
fi
echo ""

# 2. Check for event listeners
echo "2️⃣  Checking event listener cleanup..."
ADD_LISTENER_COUNT=$(grep -r "addEventListener" frontend/src --include="*.jsx" --include="*.js" | wc -l)
REMOVE_LISTENER_COUNT=$(grep -r "removeEventListener" frontend/src --include="*.jsx" --include="*.js" | wc -l)
echo "   - addEventListener calls: $ADD_LISTENER_COUNT"
echo "   - removeEventListener calls: $REMOVE_LISTENER_COUNT"
if [ $ADD_LISTENER_COUNT -gt $((REMOVE_LISTENER_COUNT + 10)) ]; then
  echo "   ⚠️  WARNING: More event listeners added than removed - potential memory leak!"
else
  echo "   ✅ Event listener cleanup looks good"
fi
echo ""

# 3. Check for useEffect cleanup
echo "3️⃣  Checking useEffect cleanup patterns..."
USEEFFECT_COUNT=$(grep -r "useEffect" frontend/src --include="*.jsx" --include="*.js" | wc -l)
RETURN_CLEANUP_COUNT=$(grep -r "return () =>" frontend/src --include="*.jsx" --include="*.js" | wc -l)
echo "   - useEffect hooks: $USEEFFECT_COUNT"
echo "   - Cleanup functions: $RETURN_CLEANUP_COUNT"
if [ $RETURN_CLEANUP_COUNT -lt $((USEEFFECT_COUNT / 2)) ]; then
  echo "   ⚠️  WARNING: Low cleanup function ratio - many effects may not clean up!"
else
  echo "   ✅ Good cleanup function coverage"
fi
echo ""

# 4. Check for large dependencies
echo "4️⃣  Checking for heavy dependencies..."
if [ -f "frontend/package.json" ]; then
  DEPS=$(cat frontend/package.json | grep -A 100 '"dependencies"' | grep -c '"')
  echo "   - Total dependencies: $DEPS"
  
  # Check for particularly heavy ones
  HEAVY_DEPS=$(cat frontend/package.json | grep -E 'chart|three|canvas|video' | wc -l)
  if [ $HEAVY_DEPS -gt 0 ]; then
    echo "   ⚠️  Found $HEAVY_DEPS potentially heavy dependencies"
    cat frontend/package.json | grep -E 'chart|three|canvas|video'
  else
    echo "   ✅ No obviously heavy dependencies found"
  fi
fi
echo ""

# 5. Check for image optimization
echo "5️⃣  Checking image handling..."
LAZY_LOADING=$(grep -r "loading=\"lazy\"" frontend/src --include="*.jsx" --include="*.js" | wc -l)
IMG_TAGS=$(grep -r "<img" frontend/src --include="*.jsx" --include="*.js" | wc -l)
echo "   - Total <img> tags: $IMG_TAGS"
echo "   - Lazy-loaded images: $LAZY_LOADING"
if [ $LAZY_LOADING -lt $((IMG_TAGS / 2)) ]; then
  echo "   ⚠️  WARNING: Less than 50% of images are lazy-loaded!"
else
  echo "   ✅ Good lazy loading coverage"
fi
echo ""

# 6. Check for WebSocket cleanup
echo "6️⃣  Checking WebSocket handling..."
WS_NEW=$(grep -r "new WebSocket" frontend/src --include="*.jsx" --include="*.js" | wc -l)
WS_CLOSE=$(grep -r ".close()" frontend/src --include="*.jsx" --include="*.js" | wc -l)
echo "   - WebSocket creations: $WS_NEW"
echo "   - Close calls: $WS_CLOSE"
if [ $WS_NEW -gt $WS_CLOSE ]; then
  echo "   ⚠️  WARNING: WebSockets may not be closing properly!"
else
  echo "   ✅ WebSocket cleanup looks good"
fi
echo ""

# 7. Check bundle size (if built)
echo "7️⃣  Checking bundle size..."
if [ -d "frontend/dist" ]; then
  BUNDLE_SIZE=$(du -sh frontend/dist | awk '{print $1}')
  echo "   - Build size: $BUNDLE_SIZE"
  
  # Check for large chunks
  find frontend/dist -name "*.js" -size +500k -exec ls -lh {} \; | awk '{print "   ⚠️  Large chunk: " $9 " (" $5 ")"}'
else
  echo "   ℹ️  No build found. Run 'npm run build' in frontend/"
fi
echo ""

# 8. Check for console.log statements (can cause memory issues)
echo "8️⃣  Checking for console.log statements..."
CONSOLE_LOGS=$(grep -r "console\\.log" frontend/src --include="*.jsx" --include="*.js" | grep -v "// console.log" | wc -l)
echo "   - console.log statements: $CONSOLE_LOGS"
if [ $CONSOLE_LOGS -gt 100 ]; then
  echo "   ⚠️  WARNING: Excessive console logging can cause memory issues on mobile!"
else
  echo "   ✅ Reasonable amount of logging"
fi
echo ""

# 9. Summary
echo "📊 DIAGNOSTIC SUMMARY"
echo "===================="

WARNINGS=0

if [ $RAF_COUNT -gt $RAF_CANCEL_COUNT ]; then
  echo "🚨 RAF memory leak risk"
  WARNINGS=$((WARNINGS + 1))
fi

if [ $ADD_LISTENER_COUNT -gt $((REMOVE_LISTENER_COUNT + 10)) ]; then
  echo "🚨 Event listener memory leak risk"
  WARNINGS=$((WARNINGS + 1))
fi

if [ $RETURN_CLEANUP_COUNT -lt $((USEEFFECT_COUNT / 2)) ]; then
  echo "🚨 Insufficient useEffect cleanup"
  WARNINGS=$((WARNINGS + 1))
fi

if [ $LAZY_LOADING -lt $((IMG_TAGS / 2)) ]; then
  echo "⚠️  Poor image lazy loading"
  WARNINGS=$((WARNINGS + 1))
fi

if [ $WS_NEW -gt $WS_CLOSE ]; then
  echo "⚠️  WebSocket cleanup issue"
  WARNINGS=$((WARNINGS + 1))
fi

if [ $CONSOLE_LOGS -gt 100 ]; then
  echo "⚠️  Excessive console logging"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
if [ $WARNINGS -eq 0 ]; then
  echo "✅ No critical issues found!"
else
  echo "⚠️  Found $WARNINGS potential issue(s)"
fi

echo ""
echo "💡 RECOMMENDATIONS:"
echo "==================="
echo "1. Use the performance monitor: Open DevTools and run 'perfMonitor.start()'"
echo "2. Check memory: Run 'perfMonitor.report()' after using the app"
echo "3. Look for leaks: Run 'perfMonitor.findMemoryHogs()'"
echo "4. Test on device: Use Chrome Remote Debugging for iOS/Android"
echo ""
echo "🔧 QUICK FIXES:"
echo "==============="
echo "• Ensure all useEffect hooks return cleanup functions"
echo "• Use the RAF manager for all requestAnimationFrame calls"
echo "• Add loading=\"lazy\" to all images"
echo "• Remove excessive console.log statements in production"
echo "• Test with Chrome DevTools Performance tab"
echo ""

