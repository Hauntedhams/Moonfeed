#!/bin/bash

# Test script for Coin List Modal NEW tab fix
# This script verifies that the /api/coins/new endpoint is working correctly

echo "🧪 Testing Coin List Modal NEW Tab Fix"
echo "========================================"
echo ""

# Test 1: Check if backend is running
echo "📡 Test 1: Backend Health Check"
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health)
if [ "$BACKEND_STATUS" == "200" ]; then
    echo "✅ Backend is running (HTTP $BACKEND_STATUS)"
else
    echo "❌ Backend is not responding (HTTP $BACKEND_STATUS)"
    exit 1
fi
echo ""

# Test 2: Check /api/coins/new endpoint
echo "📡 Test 2: /api/coins/new Endpoint"
NEW_RESPONSE=$(curl -s 'http://localhost:3001/api/coins/new?limit=5')
NEW_COUNT=$(echo "$NEW_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('coins', []))" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
NEW_TOTAL=$(echo "$NEW_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('total', 0))")
NEW_SUCCESS=$(echo "$NEW_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))")

echo "Success: $NEW_SUCCESS"
echo "Coins returned: $NEW_COUNT"
echo "Total available: $NEW_TOTAL"

if [ "$NEW_SUCCESS" == "True" ] && [ "$NEW_COUNT" -gt "0" ]; then
    echo "✅ NEW endpoint is working correctly"
else
    echo "❌ NEW endpoint returned empty or error response"
fi
echo ""

# Test 3: Check frontend is running
echo "📡 Test 3: Frontend Health Check"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173)
if [ "$FRONTEND_STATUS" == "200" ]; then
    echo "✅ Frontend is running (HTTP $FRONTEND_STATUS)"
else
    echo "❌ Frontend is not responding (HTTP $FRONTEND_STATUS)"
fi
echo ""

# Test 4: Sample coin from NEW endpoint
echo "📡 Test 4: Sample Coin Data"
SAMPLE_COIN=$(curl -s 'http://localhost:3001/api/coins/new?limit=1' | python3 -c "import sys, json; data=json.load(sys.stdin); coin=data.get('coins', [{}])[0]; print(f\"Symbol: {coin.get('symbol', 'N/A')}\"); print(f\"Name: {coin.get('name', 'N/A')}\"); print(f\"Market Cap: ${coin.get('market_cap_usd', 0):,.0f}\"); print(f\"Age: {coin.get('ageHours', 0)} hours\")")
echo "$SAMPLE_COIN"
echo ""

# Final summary
echo "========================================"
echo "🎉 Test Summary"
echo "========================================"
echo ""
echo "Expected behavior after fix:"
echo "1. Click 'new' tab in TopTabs"
echo "2. Coin List Modal opens"
echo "3. Modal fetches from /api/coins/new ✅"
echo "4. Shows 'New Coins' title ✅"
echo "5. Displays all available new coins"
echo ""
echo "📋 Manual Testing:"
echo "1. Open http://localhost:5173"
echo "2. Click the 'New' tab"
echo "3. Verify coin list modal opens with new coins"
echo ""
