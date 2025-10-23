#!/bin/bash

echo "🔬 Live Price Update Diagnostic Check"
echo "======================================"
echo ""

# Check if backend is running
echo "1️⃣  Checking backend server..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "   ✅ Backend is running on localhost:3001"
else
  echo "   ❌ Backend is NOT running"
  echo "   👉 Run: cd backend && npm run dev"
fi

echo ""

# Check if frontend is running
echo "2️⃣  Checking frontend server..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo "   ✅ Frontend is running on localhost:5173"
elif curl -s http://localhost:5174 > /dev/null 2>&1; then
  echo "   ✅ Frontend is running on localhost:5174"
else
  echo "   ❌ Frontend is NOT running"
  echo "   👉 Run: cd frontend && npm run dev"
fi

echo ""

# Check Jupiter service status
echo "3️⃣  Checking Jupiter price service..."
JUPITER_STATUS=$(curl -s http://localhost:3001/api/debug/jupiter-status 2>/dev/null)
if [ -n "$JUPITER_STATUS" ]; then
  echo "   ✅ Jupiter service status:"
  echo "$JUPITER_STATUS" | jq '.' 2>/dev/null || echo "$JUPITER_STATUS"
else
  echo "   ❌ Could not fetch Jupiter service status"
fi

echo ""
echo "======================================"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Open http://localhost:5173 in your browser"
echo "2. Open DevTools Console (Cmd+Option+I on Mac, F12 on Windows/Linux)"
echo "3. Open live-price-diagnostic.html for detailed troubleshooting guide"
echo "4. Watch for these logs in the console:"
echo ""
echo "   💰 [WebSocket] Jupiter price update received"
echo "   🔢 [LiveDataContext] updateCount incremented"
echo "   🔄 [CoinCard] liveData computed"
echo "   💰 [CoinCard] displayPrice computed"
echo ""
echo "5. If you see all 4 logs, prices should update live!"
echo "   If not, check live-price-diagnostic.html for troubleshooting"
echo ""
