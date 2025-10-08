#!/bin/bash

# Test Expand Button Functionality
# This script tests the expand button clickability and interaction

echo "🔍 Testing Expand Button Functionality..."
echo "=================================="

# Start the frontend development server
cd frontend
npm run dev &
FRONTEND_PID=$!

# Wait for the server to start
echo "⏳ Waiting for frontend server to start..."
sleep 10

echo "🌐 Frontend should be running at http://localhost:5173"
echo ""
echo "Manual Testing Checklist:"
echo "========================"
echo "1. ✅ Open http://localhost:5173 in browser"
echo "2. ✅ Scroll through coins and locate expand buttons"
echo "3. ✅ Click on expand buttons to verify they work"
echo "4. ✅ Test on mobile viewport (DevTools mobile mode)"
echo "5. ✅ Test touch interactions on expand buttons"
echo "6. ✅ Verify expand animation works smoothly"
echo "7. ✅ Check that expanded state shows coin details"
echo "8. ✅ Test clicking expand button again to collapse"
echo ""
echo "Expected Behavior:"
echo "=================="
echo "- Expand button should be clearly visible and clickable"
echo "- Hover effects should work (background + scale animation)"
echo "- Click should expand/collapse the coin info layer"
echo "- Arrow should rotate when expanded/collapsed"
echo "- Touch interactions should work on mobile"
echo "- No invisible overlays should block the button"
echo ""
echo "Debug Steps if Button Not Working:"
echo "=================================="
echo "1. Open DevTools and check console for errors"
echo "2. Check if 'Expand toggle clicked' logs appear when clicking"
echo "3. Inspect element to verify z-index and pointer-events"
echo "4. Test with different screen sizes and zoom levels"
echo "5. Check for any overlapping elements covering the button"
echo ""

# Check if browser can be opened automatically
if command -v open >/dev/null 2>&1; then
    echo "🚀 Opening browser automatically..."
    open http://localhost:5173
elif command -v xdg-open >/dev/null 2>&1; then
    echo "🚀 Opening browser automatically..."
    xdg-open http://localhost:5173
else
    echo "📋 Please manually open: http://localhost:5173"
fi

echo ""
echo "Press any key to stop the test server..."
read -n 1 -s

# Clean up
kill $FRONTEND_PID 2>/dev/null
echo ""
echo "✅ Test server stopped."
