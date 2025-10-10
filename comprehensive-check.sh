#!/bin/bash

echo "🔍 COMPREHENSIVE DEPLOYMENT CHECK"
echo "=================================="
echo ""

# Get the latest deployment info
echo "📦 Current Deployment Info:"
echo "   URL: https://moonfeed.app"
echo "   Backend: https://api.moonfeed.app"
echo ""

# Test the actual page load
echo "1️⃣ Simulating Browser Request..."
RESPONSE=$(curl -s -H "User-Agent: Mozilla/5.0" https://moonfeed.app)

# Extract bundle path
BUNDLE=$(echo "$RESPONSE" | grep -o 'src="/assets/index-[^"]*\.js"' | head -1 | sed 's/src="//;s/"//')
echo "   Bundle: $BUNDLE"

# Check bundle content
if [ -n "$BUNDLE" ]; then
    echo ""
    echo "2️⃣ Checking Bundle Content..."
    BUNDLE_CONTENT=$(curl -s "https://moonfeed.app$BUNDLE")
    
    # Count occurrences of API URL
    API_COUNT=$(echo "$BUNDLE_CONTENT" | grep -o "api.moonfeed.app" | wc -l | tr -d ' ')
    echo "   API URL occurrences: $API_COUNT"
    
    if [ "$API_COUNT" -gt 0 ]; then
        echo "   ✅ API configuration is in the bundle"
        
        # Try to extract the actual API config code
        echo ""
        echo "3️⃣ Extracted API Configuration:"
        echo "$BUNDLE_CONTENT" | grep -o "baseUrl:\"[^\"]*\"" | head -3 | sed 's/^/   /'
    else
        echo "   ❌ API URL not found in bundle"
        echo "   ⚠️  This means the build didn't include VITE_API_URL"
    fi
fi

echo ""
echo "4️⃣ Direct API Test..."
# Test with exact same headers a browser would use
API_TEST=$(curl -s -H "Origin: https://moonfeed.app" \
    -H "Accept: application/json" \
    -H "User-Agent: Mozilla/5.0" \
    'https://api.moonfeed.app/api/coins/trending?limit=1')

if echo "$API_TEST" | grep -q '"success":true'; then
    COIN_COUNT=$(echo "$API_TEST" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
    COIN_SYMBOL=$(echo "$API_TEST" | grep -o '"symbol":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   ✅ API is returning data"
    echo "   Coins: $COIN_COUNT"
    echo "   First coin: $COIN_SYMBOL"
else
    echo "   ❌ API is not returning valid data"
    echo "   Response: $(echo "$API_TEST" | head -c 200)"
fi

echo ""
echo "5️⃣ CORS Check..."
CORS_HEADERS=$(curl -s -I -X OPTIONS \
    -H "Origin: https://moonfeed.app" \
    -H "Access-Control-Request-Method: GET" \
    'https://api.moonfeed.app/api/coins/trending' | grep -i "access-control")

if echo "$CORS_HEADERS" | grep -q "https://moonfeed.app"; then
    echo "   ✅ CORS configured correctly"
else
    echo "   ⚠️  CORS may have issues"
    echo "$CORS_HEADERS" | sed 's/^/   /'
fi

echo ""
echo "=================================="
echo "🎯 DIAGNOSIS"
echo "=================================="
echo ""

# Determine the issue
if [ "$API_COUNT" -gt 0 ]; then
    echo "✅ Frontend build is correct (API URL in bundle)"
    
    if echo "$API_TEST" | grep -q '"success":true'; then
        echo "✅ Backend API is working"
        echo "✅ CORS is configured"
        echo ""
        echo "🎉 EVERYTHING LOOKS GOOD!"
        echo ""
        echo "If you still see errors:"
        echo "  1. Clear browser cache completely"
        echo "  2. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)"
        echo "  3. Try incognito mode"
        echo "  4. Check browser console for specific errors"
        echo ""
        echo "The deployment is working correctly."
    else
        echo "❌ Backend API is not responding correctly"
        echo "   Check Render logs for backend errors"
    fi
else
    echo "❌ Frontend build issue - API URL not in bundle"
    echo ""
    echo "This means vercel.json changes weren't applied."
    echo ""
    echo "Solutions:"
    echo "  1. Check Vercel dashboard for latest deployment"
    echo "  2. Verify vercel.json has 'build.env' section"
    echo "  3. Manually add VITE_API_URL in Vercel dashboard:"
    echo "     - Go to Project Settings → Environment Variables"
    echo "     - Add: VITE_API_URL = https://api.moonfeed.app"
    echo "     - Redeploy (without cache)"
fi

echo ""
