#!/bin/bash

# SEARCH ENRICHMENT + CHART TEST
# Tests that searching for a coin returns enriched data including price change history

echo "🧪 Testing Search Enrichment + Chart Data Flow"
echo "=============================================="
echo ""

# Test coin: VINE
MINT_ADDRESS="6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump"
SYMBOL="VINE"

echo "📍 Testing coin: $SYMBOL ($MINT_ADDRESS)"
echo ""

# Call enrichment endpoint
echo "🔄 Calling enrichment endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/coins/enrich-single \
  -H "Content-Type: application/json" \
  -d "{\"coin\": {\"mintAddress\": \"$MINT_ADDRESS\", \"symbol\": \"$SYMBOL\", \"name\": \"$SYMBOL\"}}")

echo ""
echo "📊 Response Analysis:"
echo "-------------------"

# Check success
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true' | head -1)
if [ -n "$SUCCESS" ]; then
  echo "✅ Enrichment successful"
else
  echo "❌ Enrichment failed"
  exit 1
fi

# Check banner
BANNER=$(echo "$RESPONSE" | grep -o '"banner":"[^"]*"' | head -1)
if [ -n "$BANNER" ]; then
  echo "✅ Banner included: ${BANNER:0:60}..."
else
  echo "⚠️  No banner (might be expected)"
fi

# Check priceChange object
PRICE_CHANGE=$(echo "$RESPONSE" | grep -o '"priceChange":{[^}]*}' | head -1)
if [ -n "$PRICE_CHANGE" ]; then
  echo "✅ Price change data included: $PRICE_CHANGE"
  
  # Extract individual values
  M5=$(echo "$PRICE_CHANGE" | grep -o '"m5":[^,}]*' | cut -d':' -f2)
  H1=$(echo "$PRICE_CHANGE" | grep -o '"h1":[^,}]*' | cut -d':' -f2)
  H6=$(echo "$PRICE_CHANGE" | grep -o '"h6":[^,}]*' | cut -d':' -f2)
  H24=$(echo "$PRICE_CHANGE" | grep -o '"h24":[^,}]*' | cut -d':' -f2)
  
  echo "   ├─ 5m change:  ${M5}%"
  echo "   ├─ 1h change:  ${H1}%"
  echo "   ├─ 6h change:  ${H6}%"
  echo "   └─ 24h change: ${H24}%"
  
  # Verify we have at least some data
  if [ -n "$M5" ] || [ -n "$H1" ] || [ -n "$H6" ] || [ -n "$H24" ]; then
    echo ""
    echo "✅ CHART DATA AVAILABLE - Chart will render properly!"
  else
    echo ""
    echo "⚠️  No price change values found"
  fi
else
  echo "❌ Price change data MISSING - Chart will be flat!"
  exit 1
fi

# Check rugcheck
RUGCHECK=$(echo "$RESPONSE" | grep -o '"rugcheck":{[^}]*}' | head -1)
if [ -n "$RUGCHECK" ]; then
  echo "✅ Rugcheck data included"
else
  echo "⚠️  No rugcheck data (might be rate limited)"
fi

# Check enrichment time
ENRICH_TIME=$(echo "$RESPONSE" | grep -o '"enrichmentTime":[0-9]*' | head -1 | cut -d':' -f2)
if [ -n "$ENRICH_TIME" ]; then
  echo "✅ Enrichment time: ${ENRICH_TIME}ms"
  
  if [ "$ENRICH_TIME" -lt 100 ]; then
    echo "   └─ ⚡ Cache hit (very fast!)"
  elif [ "$ENRICH_TIME" -lt 1000 ]; then
    echo "   └─ ✅ Acceptable speed (<1s)"
  else
    echo "   └─ ⚠️  Slow (>1s)"
  fi
fi

echo ""
echo "=============================================="
echo "🎯 Test Result: SUCCESS"
echo ""
echo "Next steps:"
echo "1. Open app in browser"
echo "2. Click search icon"
echo "3. Search for '$SYMBOL'"
echo "4. Click the coin"
echo "5. Verify:"
echo "   ✅ Banner displays"
echo "   ✅ Social links work"
echo "   ✅ Rugcheck tooltip shows"
echo "   ✅ Chart shows smooth curve (NOT flat!)"
echo ""
