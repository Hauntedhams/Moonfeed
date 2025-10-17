#!/bin/bash
# Test rugcheck on-demand enrichment
# This script tests a real coin to verify rugcheck data loads on-demand

echo "🔐 Testing Rugcheck On-Demand Enrichment"
echo "=========================================="
echo ""

# Test with a popular Solana token (Bonk)
MINT_ADDRESS="DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
SYMBOL="BONK"

echo "📍 Testing coin: $SYMBOL"
echo "📍 Mint address: $MINT_ADDRESS"
echo ""
echo "🔄 Sending enrichment request..."
echo ""

# Make the API request
RESPONSE=$(curl -s -X POST http://localhost:3001/api/coins/enrich-single \
  -H "Content-Type: application/json" \
  -d "{\"mintAddress\":\"$MINT_ADDRESS\",\"coin\":{\"symbol\":\"$SYMBOL\",\"mintAddress\":\"$MINT_ADDRESS\"}}")

# Check if request succeeded
if [ -z "$RESPONSE" ]; then
  echo "❌ No response from server"
  exit 1
fi

# Extract key fields using grep
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":[^,]*' | cut -d':' -f2)
ENRICHMENT_TIME=$(echo "$RESPONSE" | grep -o '"enrichmentTime":[0-9]*' | cut -d':' -f2)

echo "📊 Response received:"
echo "   Success: $SUCCESS"
echo "   Enrichment time: ${ENRICHMENT_TIME}ms"
echo ""

# Check for rugcheck fields in response
echo "🔍 Checking for rugcheck data..."
echo ""

HAS_RUGCHECK_VERIFIED=$(echo "$RESPONSE" | grep -o '"rugcheckVerified":[^,]*' | cut -d':' -f2)
HAS_LIQUIDITY_LOCKED=$(echo "$RESPONSE" | grep -o '"liquidityLocked":[^,]*' | cut -d':' -f2)
HAS_RUGCHECK_SCORE=$(echo "$RESPONSE" | grep -o '"rugcheckScore":[0-9]*' | cut -d':' -f2)
HAS_RISK_LEVEL=$(echo "$RESPONSE" | grep -o '"riskLevel":"[^"]*"' | cut -d':' -f2 | tr -d '"')

if [ -n "$HAS_RUGCHECK_VERIFIED" ]; then
  echo "✅ rugcheckVerified: $HAS_RUGCHECK_VERIFIED"
else
  echo "❌ rugcheckVerified: NOT FOUND"
fi

if [ -n "$HAS_LIQUIDITY_LOCKED" ]; then
  echo "✅ liquidityLocked: $HAS_LIQUIDITY_LOCKED"
else
  echo "❌ liquidityLocked: NOT FOUND"
fi

if [ -n "$HAS_RUGCHECK_SCORE" ]; then
  echo "✅ rugcheckScore: $HAS_RUGCHECK_SCORE"
else
  echo "⚠️  rugcheckScore: NOT FOUND"
fi

if [ -n "$HAS_RISK_LEVEL" ]; then
  echo "✅ riskLevel: $HAS_RISK_LEVEL"
else
  echo "⚠️  riskLevel: NOT FOUND"
fi

echo ""
echo "📋 Full response (truncated):"
echo "$RESPONSE" | head -c 500
echo "..."
echo ""

# Final verdict
if [ "$HAS_RUGCHECK_VERIFIED" = "true" ]; then
  echo "✅ RUGCHECK ON-DEMAND: WORKING!"
  echo "   Rugcheck data is being enriched and returned correctly."
else
  if [ "$HAS_RUGCHECK_VERIFIED" = "false" ]; then
    echo "⚠️  RUGCHECK ON-DEMAND: PARTIAL"
    echo "   Rugcheck was attempted but returned no data (token may not be in rugcheck DB)"
  else
    echo "❌ RUGCHECK ON-DEMAND: FAILED"
    echo "   rugcheckVerified field is missing from response"
  fi
fi

echo ""
echo "🔍 Next steps:"
echo "   1. Check backend logs for rugcheck processing"
echo "   2. Open browser and test tooltip on a coin"
echo "   3. Verify tooltip shows rugcheck security analysis"
