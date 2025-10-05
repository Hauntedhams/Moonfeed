#!/bin/bash

# Test script for coin list modal feature
echo "🧪 Testing Coin List Modal Feature"
echo "=================================="
echo ""
echo "1. Open http://localhost:5175 in your browser"
echo "2. Look for the 'Trending' tab at the top (should be active by default)"
echo "3. Click on the 'Trending' tab (the one that's already selected)"
echo "4. A modal should appear showing a grid of trending coins with banners"
echo "5. Click on any coin in the modal to navigate to its detail view"
echo "6. Test the same with the 'Custom' tab"
echo ""
echo "Expected behavior:"
echo "- Active tab should have a subtle down arrow (▼) on hover"
echo "- Modal shows coins in a grid layout with banners and names"
echo "- Clicking a coin closes the modal and shows coin detail"
echo "- Modal can be closed by clicking outside or the X button"
echo ""

# Check if frontend is running
if curl -s http://localhost:5175 > /dev/null; then
    echo "✅ Frontend is running on port 5175"
else
    echo "❌ Frontend is not running. Please start it with: npm run dev"
    exit 1
fi

# Check if backend is running  
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend is running on port 3001"
else
    echo "❌ Backend is not running. Please start it with: npm run dev"
    exit 1
fi

echo ""
echo "🎉 Both servers are running! Ready to test the coin list modal feature."
echo "📝 Implementation complete:"
echo "   - CoinListModal component with grid layout"
echo "   - TopTabs component handles active tab clicks"  
echo "   - App component manages modal state"
echo "   - Visual hint (down arrow) on hoverable active tabs"
