#!/bin/bash

echo "🚀 Monitoring Vercel Deployment Status"
echo "======================================"
echo ""
echo "Waiting for Vercel to rebuild with the new vercel.json..."
echo ""
echo "This will:"
echo "  1. Check if the new deployment is ready"
echo "  2. Verify the API URL is in the JavaScript bundle"
echo "  3. Test the API connection"
echo ""
echo "⏳ Please wait 1-2 minutes for Vercel to build and deploy..."
echo ""

# Wait for deployment (typically takes 1-2 minutes)
for i in {1..12}; do
    echo -n "."
    sleep 10
done

echo ""
echo ""
echo "✅ Deployment should be complete. Testing..."
echo ""

# Test 1: Check if new bundle has API URL
echo "1️⃣ Checking JavaScript bundle..."
BUNDLE_PATH=$(curl -s https://moonfeed.app | grep -o 'src="/assets/index-[^"]*\.js"' | head -1 | sed 's/src="//;s/"//')

if [ -n "$BUNDLE_PATH" ]; then
    echo "   Bundle: $BUNDLE_PATH"
    
    # Check if API URL is in the bundle
    if curl -s "https://moonfeed.app$BUNDLE_PATH" | grep -q "api.moonfeed.app"; then
        echo "   ✅ API URL found in bundle"
    else
        echo "   ❌ API URL NOT found in bundle"
        echo "   ⚠️  Build may not have completed yet. Wait 30 more seconds and try again."
    fi
else
    echo "   ❌ Could not find bundle path"
fi

echo ""

# Test 2: Test API endpoint
echo "2️⃣ Testing API endpoint..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" 'https://api.moonfeed.app/api/coins/trending?limit=1')

if [ "$API_RESPONSE" = "200" ]; then
    echo "   ✅ Backend API is working (HTTP 200)"
else
    echo "   ⚠️  Backend API returned HTTP $API_RESPONSE"
fi

echo ""

# Test 3: Test frontend
echo "3️⃣ Testing frontend..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://moonfeed.app)

if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo "   ✅ Frontend is accessible (HTTP 200)"
else
    echo "   ⚠️  Frontend returned HTTP $FRONTEND_RESPONSE"
fi

echo ""
echo "======================================"
echo "📊 Verification Summary"
echo "======================================"
echo ""
echo "Next Steps:"
echo "  1. Open https://moonfeed.app in incognito mode"
echo "  2. Open DevTools (F12) → Console"
echo "  3. Look for: '🌐 API Config initialized'"
echo "  4. Check if coins are loading"
echo ""
echo "If still failing:"
echo "  - Wait another minute for build to complete"
echo "  - Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)"
echo "  - Check Vercel dashboard for deployment status"
echo ""
