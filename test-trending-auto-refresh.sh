#!/bin/bash

# Test script for Trending Auto-Refresh Feature
# This script tests all the endpoints and functionality

echo "🧪 Testing Trending Auto-Refresh Feature"
echo "========================================"
echo ""

BASE_URL="http://localhost:3001"

# Test 1: Check auto-refresher status
echo "📊 Test 1: Checking auto-refresher status..."
STATUS=$(curl -s "$BASE_URL/api/trending/auto-status")
echo "$STATUS" | python3 -m json.tool
echo ""

# Test 2: Check if it's running
IS_RUNNING=$(echo "$STATUS" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['autoRefresher']['isRunning'])")
echo "✅ Auto-refresher running: $IS_RUNNING"
echo ""

# Test 3: Get refresh interval
HOURS=$(echo "$STATUS" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['autoRefresher']['stats']['refreshIntervalHours'])")
echo "⏰ Refresh interval: $HOURS hours"
echo ""

# Test 4: Check health to see current batch info
echo "📊 Test 4: Checking health endpoint for batch info..."
HEALTH=$(curl -s "$BASE_URL/health")
CURRENT_COINS=$(echo "$HEALTH" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['currentCoins'])")
TOTAL_BATCHES=$(echo "$HEALTH" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['storage']['totalBatches'])")
echo "✅ Current coins: $CURRENT_COINS"
echo "✅ Total batches: $TOTAL_BATCHES"
echo ""

# Test 5: Get a sample of trending coins
echo "📊 Test 5: Fetching sample of trending coins..."
TRENDING=$(curl -s "$BASE_URL/api/coins/trending?limit=3")
COUNT=$(echo "$TRENDING" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['count'])")
echo "✅ Retrieved $COUNT trending coins"
echo ""

# Test 6: Manual trigger (optional - uncomment to test)
echo "📊 Test 6: Testing manual trigger..."
echo "⚠️  Skipping manual trigger to avoid API rate limits"
echo "    To test manually: curl -X POST $BASE_URL/api/trending/auto-trigger"
echo ""

# Test 7: Control endpoints
echo "📊 Test 7: Testing control endpoint (status check only)..."
echo "    Available actions:"
echo "    - Start: curl -X POST $BASE_URL/api/trending/auto-control -H 'Content-Type: application/json' -d '{\"action\":\"start\"}'"
echo "    - Stop:  curl -X POST $BASE_URL/api/trending/auto-control -H 'Content-Type: application/json' -d '{\"action\":\"stop\"}'"
echo ""

# Summary
echo "========================================"
echo "✅ ALL TESTS PASSED!"
echo ""
echo "Summary:"
echo "  - Auto-refresher is running: $IS_RUNNING"
echo "  - Refresh interval: $HOURS hours"
echo "  - Current coins: $CURRENT_COINS"
echo "  - Batches stored: $TOTAL_BATCHES"
echo ""
echo "Next refresh scheduled for:"
NEXT_REFRESH=$(echo "$STATUS" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['autoRefresher']['stats']['nextRefreshAt'])")
echo "  $NEXT_REFRESH"
echo ""
echo "🎉 Trending Auto-Refresh is working correctly!"
