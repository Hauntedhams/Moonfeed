#!/bin/bash

# Mobile Diagnostic Test Script
# Run this to test the live production endpoints

echo "🔍 Testing Moonfeed Production API..."
echo ""

# Test 1: API Status
echo "1️⃣ Testing API Status..."
curl -s https://api.moonfeed.app/api/status | jq '.success, .uptime, .currentCoins' 2>/dev/null || echo "❌ Failed"
echo ""

# Test 2: Trending Coins
echo "2️⃣ Testing Trending Coins (first 5)..."
curl -s https://api.moonfeed.app/api/coins/trending?limit=5 | jq '.success, .count' 2>/dev/null || echo "❌ Failed"
echo ""

# Test 3: New Coins Feed
echo "3️⃣ Testing New Coins Feed (first 5)..."
curl -s https://api.moonfeed.app/api/coins/new?limit=5 | jq '.success, .count, .total' 2>/dev/null || echo "❌ Failed"
echo ""

# Test 4: Top Traders (sample address)
echo "4️⃣ Testing Top Traders..."
SAMPLE_ADDRESS="7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr" # Pump.fun POPCAT
curl -s "https://api.moonfeed.app/api/top-traders/${SAMPLE_ADDRESS}" | jq '.success, .count' 2>/dev/null || echo "❌ Failed"
echo ""

echo "✅ All tests complete!"
echo ""
echo "📱 To test on mobile:"
echo "1. Open https://moonfeed.app on your phone"
echo "2. Open browser dev tools (if possible)"
echo "3. Click 'New' tab"
echo "4. Check for console errors"
echo ""
echo "🐛 Common mobile issues:"
echo "- Memory pressure (too many objects in state)"
echo "- WebSocket connections timing out"
echo "- Images failing to load (network errors)"
echo "- JavaScript heap out of memory"
