#!/bin/bash

# Test script for verifying live price display updates
# This script helps verify that the CoinCard price display updates in real-time

echo "🧪 Testing Live Price Display Fix"
echo "=================================="
echo ""

# Check if backend is running
echo "1️⃣ Checking backend status..."
if lsof -ti:3001 > /dev/null 2>&1; then
    echo "   ✅ Backend is running on port 3001"
else
    echo "   ❌ Backend is NOT running on port 3001"
    echo "   → Start backend with: cd backend && npm run dev"
    exit 1
fi

# Check if frontend is running
echo ""
echo "2️⃣ Checking frontend status..."
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "   ✅ Frontend is running on port 5173"
else
    echo "   ❌ Frontend is NOT running on port 5173"
    echo "   → Start frontend with: cd frontend && npm run dev"
    exit 1
fi

echo ""
echo "3️⃣ Testing CoinCard.jsx syntax..."
cd "$(dirname "$0")/frontend"
npx eslint src/components/CoinCard.jsx --quiet 2>&1 | head -20
if [ $? -eq 0 ]; then
    echo "   ✅ No syntax errors in CoinCard.jsx"
else
    echo "   ⚠️  Some linting warnings (check above)"
fi

echo ""
echo "4️⃣ Verification checklist:"
echo ""
echo "   Manual testing steps:"
echo "   ---------------------"
echo "   □ Open http://localhost:5173 in browser"
echo "   □ Open DevTools Console (F12 or Cmd+Option+I)"
echo "   □ Look for: '💰 [WebSocket] Jupiter price update received'"
echo "   □ Look for: '💰 [WebSocket] Coins Map updated'"
echo "   □ Watch a coin card's price - should update every ~1 second"
echo "   □ Price should flash green (up) or red (down) on change"
echo "   □ NO page refresh should be needed"
echo ""
echo "   Expected console output:"
echo "   -----------------------"
echo "   💰 [WebSocket] Jupiter price update received: X coins"
echo "   💰 [WebSocket] Sample price: SYMBOL = \$0.XXXXX"
echo "   💰 [WebSocket] Updated Map for SYMBOL : 0.XXXXX"
echo "   💰 [WebSocket] Coins Map updated, new size: X"
echo ""
echo "5️⃣ Code changes verification:"
echo ""
echo "   Checking CoinCard.jsx for correct implementation..."

COINCARD_PATH="$(dirname "$0")/frontend/src/components/CoinCard.jsx"

# Check for useMemo on displayPrice
if grep -q "const displayPrice = useMemo" "$COINCARD_PATH"; then
    echo "   ✅ displayPrice is using useMemo (not useState)"
else
    echo "   ❌ displayPrice should be using useMemo"
fi

# Check for direct Map access in liveData
if grep -q "coins?.get(address)" "$COINCARD_PATH"; then
    echo "   ✅ liveData is directly accessing coins Map"
else
    echo "   ❌ liveData should directly access coins.get(address)"
fi

# Check that coins is a dependency
if grep -A 5 "const liveData = useMemo" "$COINCARD_PATH" | grep -q "coins"; then
    echo "   ✅ coins Map is in liveData dependencies"
else
    echo "   ❌ coins Map should be in liveData dependencies"
fi

echo ""
echo "✅ Automated checks complete!"
echo ""
echo "📖 For detailed information, see: test-live-price-display-fix.md"
echo ""
echo "🚀 If all checks passed, the price display should now update in real-time."
echo "   If you still see issues, check the troubleshooting section in the markdown file."
