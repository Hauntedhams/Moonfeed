#!/bin/bash

echo "🔍 LIVE FRONTEND & BACKEND DIAGNOSTIC"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Backend Health
echo "1️⃣ Testing Backend Health..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" https://api.moonfeed.app/health)
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [ "$HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Backend Health: OK${NC}"
    echo "   Response: $HEALTH_BODY"
else
    echo -e "${RED}❌ Backend Health: FAILED (HTTP $HEALTH_CODE)${NC}"
fi
echo ""

# Test 2: Trending API
echo "2️⃣ Testing Trending API..."
TRENDING_RESPONSE=$(curl -s -w "\n%{http_code}" 'https://api.moonfeed.app/api/coins/trending?limit=1')
TRENDING_CODE=$(echo "$TRENDING_RESPONSE" | tail -n 1)
TRENDING_BODY=$(echo "$TRENDING_RESPONSE" | head -n -1)

if [ "$TRENDING_CODE" = "200" ]; then
    COIN_COUNT=$(echo "$TRENDING_BODY" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
    echo -e "${GREEN}✅ Trending API: OK (${COIN_COUNT} coins)${NC}"
else
    echo -e "${RED}❌ Trending API: FAILED (HTTP $TRENDING_CODE)${NC}"
fi
echo ""

# Test 3: New Coins API
echo "3️⃣ Testing New Coins API..."
NEW_RESPONSE=$(curl -s -w "\n%{http_code}" 'https://api.moonfeed.app/api/coins/new?limit=1')
NEW_CODE=$(echo "$NEW_RESPONSE" | tail -n 1)
NEW_BODY=$(echo "$NEW_RESPONSE" | head -n -1)

if [ "$NEW_CODE" = "200" ]; then
    NEW_COUNT=$(echo "$NEW_BODY" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
    echo -e "${GREEN}✅ New Coins API: OK (${NEW_COUNT} coins)${NC}"
elif [ "$NEW_CODE" = "503" ]; then
    echo -e "${YELLOW}⏳ New Coins API: Loading (HTTP 503)${NC}"
    echo "   This is normal for the first 30 seconds after backend starts."
else
    echo -e "${RED}❌ New Coins API: FAILED (HTTP $NEW_CODE)${NC}"
fi
echo ""

# Test 4: CORS Configuration
echo "4️⃣ Testing CORS Configuration..."
CORS_RESPONSE=$(curl -s -I -X OPTIONS \
  -H "Origin: https://moonfeed.app" \
  -H "Access-Control-Request-Method: GET" \
  'https://api.moonfeed.app/api/coins/trending')

ALLOW_ORIGIN=$(echo "$CORS_RESPONSE" | grep -i "access-control-allow-origin" | cut -d' ' -f2 | tr -d '\r')

if [ "$ALLOW_ORIGIN" = "https://moonfeed.app" ]; then
    echo -e "${GREEN}✅ CORS: Correctly configured for https://moonfeed.app${NC}"
else
    echo -e "${RED}❌ CORS: Misconfigured (Allow-Origin: $ALLOW_ORIGIN)${NC}"
fi
echo ""

# Test 5: Frontend Deployment
echo "5️⃣ Testing Frontend Deployment..."
FRONTEND_RESPONSE=$(curl -s -w "\n%{http_code}" https://moonfeed.app)
FRONTEND_CODE=$(echo "$FRONTEND_RESPONSE" | tail -n 1)
FRONTEND_BODY=$(echo "$FRONTEND_RESPONSE" | head -n -1)

if [ "$FRONTEND_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Frontend: Deployed and accessible${NC}"
    
    # Check if API URL is in the bundle
    if echo "$FRONTEND_BODY" | grep -q "api.moonfeed.app"; then
        echo -e "${GREEN}   ✓ API URL found in HTML${NC}"
    else
        echo -e "${YELLOW}   ⚠ API URL not visible in HTML (may be in JS bundle)${NC}"
    fi
else
    echo -e "${RED}❌ Frontend: Not accessible (HTTP $FRONTEND_CODE)${NC}"
fi
echo ""

# Test 6: Check Frontend JavaScript Bundle
echo "6️⃣ Checking Frontend JavaScript Bundle..."
# Extract script src from HTML
SCRIPT_PATH=$(echo "$FRONTEND_BODY" | grep -o 'src="/assets/index-[^"]*\.js"' | head -1 | sed 's/src="//;s/"//')

if [ -n "$SCRIPT_PATH" ]; then
    echo "   Bundle: $SCRIPT_PATH"
    
    # Fetch the bundle and check for API URL
    BUNDLE_CONTENT=$(curl -s "https://moonfeed.app$SCRIPT_PATH")
    
    if echo "$BUNDLE_CONTENT" | grep -q "https://api.moonfeed.app"; then
        echo -e "${GREEN}   ✓ Backend API URL found in JavaScript bundle${NC}"
    else
        echo -e "${RED}   ✗ Backend API URL NOT found in JavaScript bundle${NC}"
        echo -e "${YELLOW}   This could be why frontend can't connect!${NC}"
    fi
else
    echo -e "${RED}   ✗ Could not find JavaScript bundle path${NC}"
fi
echo ""

# Summary
echo "======================================"
echo "📊 DIAGNOSTIC SUMMARY"
echo "======================================"
echo ""
echo "Backend Status:"
echo "  - Health endpoint: $([ "$HEALTH_CODE" = "200" ] && echo "✅ Working" || echo "❌ Failed")"
echo "  - Trending API: $([ "$TRENDING_CODE" = "200" ] && echo "✅ Working" || echo "❌ Failed")"
echo "  - New Coins API: $([ "$NEW_CODE" = "200" ] && echo "✅ Working" || [ "$NEW_CODE" = "503" ] && echo "⏳ Loading" || echo "❌ Failed")"
echo "  - CORS: $([ "$ALLOW_ORIGIN" = "https://moonfeed.app" ] && echo "✅ Configured" || echo "❌ Misconfigured")"
echo ""
echo "Frontend Status:"
echo "  - Deployment: $([ "$FRONTEND_CODE" = "200" ] && echo "✅ Accessible" || echo "❌ Failed")"
echo "  - API URL in bundle: $(echo "$BUNDLE_CONTENT" | grep -q "https://api.moonfeed.app" && echo "✅ Found" || echo "❌ Missing")"
echo ""

# Final recommendation
if [ "$HEALTH_CODE" = "200" ] && [ "$TRENDING_CODE" = "200" ] && [ "$ALLOW_ORIGIN" = "https://moonfeed.app" ] && [ "$FRONTEND_CODE" = "200" ]; then
    if echo "$BUNDLE_CONTENT" | grep -q "https://api.moonfeed.app"; then
        echo -e "${GREEN}✅ ALL SYSTEMS OPERATIONAL${NC}"
        echo ""
        echo "If frontend still shows 'failed to load coins', the issue may be:"
        echo "  1. Browser cache - Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)"
        echo "  2. Stale deployment - Check Vercel deployment timestamp"
        echo "  3. Client-side error - Check browser console logs"
        echo ""
        echo "Next steps:"
        echo "  1. Open https://moonfeed.app in incognito/private mode"
        echo "  2. Open browser DevTools (F12) → Console tab"
        echo "  3. Check for any error messages"
        echo "  4. Check Network tab for failed requests"
    else
        echo -e "${YELLOW}⚠ FRONTEND BUILD ISSUE DETECTED${NC}"
        echo ""
        echo "The API URL is not in the JavaScript bundle!"
        echo ""
        echo "Fix:"
        echo "  1. Set VITE_API_URL=https://api.moonfeed.app in Vercel environment variables"
        echo "  2. Trigger a fresh deployment (git push or Vercel redeploy)"
        echo "  3. Make sure 'Use existing Build Cache' is UNCHECKED"
    fi
else
    echo -e "${RED}❌ ISSUES DETECTED${NC}"
    echo ""
    echo "Please review the failed tests above and fix them."
fi
