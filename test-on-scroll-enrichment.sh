#!/bin/bash

echo "🧪 On-Scroll Enrichment Test"
echo "============================"
echo ""
echo "Testing the enrichment system fix for coins that get stuck loading"
echo ""

# Check if servers are running
echo "📡 Checking servers..."
FRONTEND_RUNNING=$(lsof -ti:5173 >/dev/null 2>&1 && echo "yes" || echo "no")
BACKEND_RUNNING=$(lsof -ti:3001 >/dev/null 2>&1 && echo "yes" || echo "no")

if [ "$FRONTEND_RUNNING" = "yes" ]; then
  echo "✅ Frontend running on http://localhost:5173"
else
  echo "❌ Frontend NOT running - start with: cd frontend && npm run dev"
fi

if [ "$BACKEND_RUNNING" = "yes" ]; then
  echo "✅ Backend running on http://localhost:3001"
else
  echo "❌ Backend NOT running - start with: cd backend && npm run dev"
fi

echo ""
echo "📋 Test Steps:"
echo "=============="
echo ""
echo "1. Open http://localhost:5173 in your browser"
echo ""
echo "2. Open browser console (F12 or Cmd+Option+I)"
echo ""
echo "3. Go to Trending feed (default view)"
echo ""
echo "4. Scroll down through coins (swipe up on mobile)"
echo ""
echo "5. Watch the console for these logs:"
echo "   ✅ '🔄 Enriching current coin + 2 ahead...'"
echo "   ✅ '🎨 On-demand enriching 3 coin(s)...'"
echo "   ✅ '✅ Enriched SYMBOL in XXXms'"
echo ""
echo "6. Verify NO stuck loading states:"
echo "   ❌ Coins should NOT stay in 'Loading...' state"
echo "   ✅ Banners should appear"
echo "   ✅ Charts should show curves (not flat)"
echo "   ✅ Social links should work"
echo ""
echo "7. Scroll to coin #15-20 and verify:"
echo "   ✅ Still enriching properly"
echo "   ✅ No stuck loading screens"
echo "   ✅ Charts display correctly"
echo ""
echo "Expected Behavior:"
echo "=================="
echo "• Each coin enriches as you scroll to it (~700-900ms)"
echo "• Next 2 coins pre-fetch for smooth scrolling"
echo "• Once enriched, coin stays enriched (cached)"
echo "• NO coins stuck in loading state"
echo "• ALL coins show complete data (banner, chart, rugcheck)"
echo ""
echo "If you see issues:"
echo "=================="
echo "• Check console for error messages"
echo "• Look for '❌ Enrichment failed' messages"
echo "• Verify backend is responding: curl http://localhost:3001/api/health"
echo "• Check if enrichment endpoint works:"
echo "  curl -X POST http://localhost:3001/api/coins/enrich-single \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"coin\": {\"mintAddress\": \"7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr\", \"symbol\": \"WIF\"}}'"
echo ""
echo "🚀 Ready to test! Open http://localhost:5173"
