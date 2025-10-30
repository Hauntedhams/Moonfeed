#!/bin/bash

# Test Rugcheck On-Demand Functionality
# This script tests if rugcheck retries work properly

echo "🔐 Testing Rugcheck On-Demand Functionality"
echo "==========================================="
echo ""

API_BASE="http://localhost:3001"

# Test mint address (replace with a real one)
MINT_ADDRESS="BwbZ992sMqabbBYnEj4tfNBmtdYtjRkSqgAGCyCRpump"

echo "📝 Test 1: Enriching a coin for the first time"
echo "Expected: Should attempt rugcheck (may timeout but will retry)"
echo ""

RESPONSE=$(curl -s -X POST "${API_BASE}/api/coins/enrich-single" \
  -H "Content-Type: application/json" \
  -d "{
    \"mintAddress\": \"${MINT_ADDRESS}\",
    \"coin\": {
      \"mintAddress\": \"${MINT_ADDRESS}\",
      \"symbol\": \"TEST\",
      \"name\": \"Test Coin\"
    }
  }")

echo "Response:"
echo "$RESPONSE" | jq -r '.'
echo ""

# Check if rugcheckVerified is present
RUGCHECK_VERIFIED=$(echo "$RESPONSE" | jq -r '.coin.rugcheckVerified')
RUGCHECK_PROCESSED=$(echo "$RESPONSE" | jq -r '.coin.rugcheckProcessedAt')
RUGCHECK_ERROR=$(echo "$RESPONSE" | jq -r '.coin.rugcheckError')
LIQUIDITY_LOCKED=$(echo "$RESPONSE" | jq -r '.coin.liquidityLocked')

echo "🔍 Rugcheck Status:"
echo "  - rugcheckVerified: $RUGCHECK_VERIFIED"
echo "  - rugcheckProcessedAt: $RUGCHECK_PROCESSED"
echo "  - rugcheckError: $RUGCHECK_ERROR"
echo "  - liquidityLocked: $LIQUIDITY_LOCKED"
echo ""

if [ "$RUGCHECK_VERIFIED" = "true" ]; then
  echo "✅ SUCCESS: Rugcheck data retrieved!"
  echo "  - Liquidity Locked: $LIQUIDITY_LOCKED"
elif [ "$RUGCHECK_PROCESSED" = "null" ] && [ "$RUGCHECK_VERIFIED" = "false" ]; then
  echo "⏳ EXPECTED: Rugcheck failed but NOT marked as processed (will retry on next view)"
  echo "  - This is the desired behavior for automatic retries"
elif [ "$RUGCHECK_PROCESSED" != "null" ]; then
  echo "⚠️ WARNING: rugcheckProcessedAt is set to: $RUGCHECK_PROCESSED"
  echo "  - This will prevent automatic retries!"
  echo "  - Check if the backend fix was applied correctly"
else
  echo "ℹ️ INFO: Rugcheck status unclear, check response above"
fi

echo ""
echo "-------------------------------------------"
echo ""
echo "📝 Test 2: Enriching the same coin again (should use cache or retry)"
echo "Expected: Should either return cached data OR retry rugcheck"
echo ""

sleep 2

RESPONSE2=$(curl -s -X POST "${API_BASE}/api/coins/enrich-single" \
  -H "Content-Type: application/json" \
  -d "{
    \"mintAddress\": \"${MINT_ADDRESS}\",
    \"coin\": {
      \"mintAddress\": \"${MINT_ADDRESS}\",
      \"symbol\": \"TEST\",
      \"name\": \"Test Coin\"
    }
  }")

CACHED=$(echo "$RESPONSE2" | jq -r '.cached')
ENRICHMENT_TIME=$(echo "$RESPONSE2" | jq -r '.enrichmentTime')

echo "🔍 Cache Status:"
echo "  - Cached: $CACHED"
echo "  - Enrichment Time: ${ENRICHMENT_TIME}ms"
echo ""

if [ "$CACHED" = "true" ] || [ "$ENRICHMENT_TIME" -lt "100" ]; then
  echo "✅ Cache is working! (Fast response time)"
  echo "  - Rugcheck won't be retried until cache expires (10min)"
else
  echo "🔄 Not cached, running full enrichment again"
  echo "  - Rugcheck will be retried"
fi

echo ""
echo "-------------------------------------------"
echo ""
echo "💡 Tips for Testing:"
echo "1. Watch backend logs for: '🔄 Rugcheck failed but NOT marking as processed'"
echo "2. In frontend, liquidity section should show: '⏳ Analyzing security data...'"
echo "3. After 10min cache expires, rugcheck will retry automatically"
echo "4. Try scrolling away and back to the same coin to test retry logic"
echo ""
echo "📊 Backend Enrichment Stats:"
curl -s "${API_BASE}/api/enrichment/stats" | jq -r '.'
echo ""
echo "✅ Test Complete!"
