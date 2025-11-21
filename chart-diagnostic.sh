#!/bin/bash

echo "🔍 CHART DIAGNOSTIC REPORT"
echo "=========================="
echo ""
echo "📅 Timestamp: $(date)"
echo ""

# Check backend status
echo "🔧 Backend Status:"
if pgrep -f "node.*backend.*server.js" > /dev/null; then
    echo "  ✅ Backend is running (PID: $(pgrep -f "node.*backend.*server.js" | head -1))"
else
    echo "  ❌ Backend is NOT running"
fi
echo ""

# Check frontend status
echo "🎨 Frontend Status:"
if pgrep -f "vite.*frontend" > /dev/null || lsof -i:5173 > /dev/null 2>&1; then
    echo "  ✅ Frontend is running (port 5173)"
else
    echo "  ❌ Frontend is NOT running"
fi
echo ""

# Test backend chart endpoint
echo "📊 Testing Chart Data Endpoint:"
echo "  Making test request to backend..."

# Use a known pool address (BONK or another popular token)
TEST_POOL="DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
BACKEND_URL="http://localhost:3001"

# Test the chart endpoint
RESPONSE=$(curl -s -w "\n%{http_code}" "${BACKEND_URL}/api/geckoterminal/ohlcv/solana/${TEST_POOL}/minute?aggregate=1&limit=50" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "  HTTP Status: ${HTTP_CODE}"

if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✅ Backend chart endpoint is working"
    
    # Parse the response to check data
    DATA_POINTS=$(echo "$BODY" | grep -o '"ohlcv_list":\[' | wc -l)
    if [ "$DATA_POINTS" -gt 0 ]; then
        echo "  ✅ Chart data received"
        
        # Count number of OHLCV candles
        CANDLES=$(echo "$BODY" | grep -o '\[' | wc -l)
        echo "  📈 Data contains ~${CANDLES} candles"
    else
        echo "  ⚠️  No chart data in response"
    fi
else
    echo "  ❌ Backend chart endpoint failed (HTTP ${HTTP_CODE})"
    if [ ! -z "$BODY" ]; then
        echo "  Error: $(echo "$BODY" | head -c 200)"
    fi
fi
echo ""

# Check for rate limiting
echo "🚦 Rate Limit Check:"
echo "  Making 3 rapid requests..."
for i in 1 2 3; do
    START=$(date +%s%N)
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/geckoterminal/ohlcv/solana/${TEST_POOL}/minute?aggregate=1&limit=10")
    END=$(date +%s%N)
    DURATION=$((($END - $START) / 1000000))
    
    if [ "$STATUS" = "429" ]; then
        echo "  ⚠️  Request $i: Rate limited (429) - ${DURATION}ms"
    elif [ "$STATUS" = "200" ]; then
        echo "  ✅ Request $i: Success (200) - ${DURATION}ms"
    else
        echo "  ❌ Request $i: Failed (${STATUS}) - ${DURATION}ms"
    fi
    sleep 0.5
done
echo ""

echo "📋 Summary:"
echo "  - Check if charts are loading in the frontend"
echo "  - Monitor browser console for errors"
echo "  - Look for 429 (rate limit) errors"
echo ""
echo "✅ Diagnostic complete!"
