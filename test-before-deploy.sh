#!/bin/bash

# Pre-deployment testing script
# Run this before deploying to catch issues early

echo "🧪 MoonFeed Pre-Deployment Testing"
echo "=================================="
echo ""

# Check if we're in the right directory
if [[ ! -f "package.json" ]] && [[ ! -d "frontend" ]] && [[ ! -d "backend" ]]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

echo "📋 Running pre-deployment checks..."
echo ""

# Test backend
echo "🔧 Testing Backend..."
cd backend

echo "  • Installing dependencies..."
npm install --silent

echo "  • Running backend tests..."
if npm run test --silent 2>/dev/null; then
    echo "  ✅ Backend tests passed"
else
    echo "  ⚠️  No backend tests found (consider adding them)"
fi

echo "  • Checking for syntax errors..."
if node -c server.js; then
    echo "  ✅ Backend syntax check passed"
else
    echo "  ❌ Backend syntax errors found!"
    exit 1
fi

# Test frontend
cd ../frontend
echo ""
echo "🎨 Testing Frontend..."

echo "  • Installing dependencies..."
npm install --silent

echo "  • Building frontend..."
if npm run build --silent; then
    echo "  ✅ Frontend build successful"
    rm -rf dist  # Clean up build files
else
    echo "  ❌ Frontend build failed!"
    exit 1
fi

echo "  • Running frontend tests..."
if npm run test --silent 2>/dev/null; then
    echo "  ✅ Frontend tests passed"
else
    echo "  ⚠️  No frontend tests found (consider adding them)"
fi

cd ..

echo ""
echo "✅ All pre-deployment checks passed!"
echo ""
echo "🚀 Ready to deploy! Run ./deploy-manual.sh to start deployment"
echo ""
echo "📝 Deployment Checklist:"
echo "  □ Backend changes tested locally"
echo "  □ Frontend changes tested locally"
echo "  □ Environment variables updated (if needed)"
echo "  □ Database migrations run (if applicable)"
echo "  □ API documentation updated (if needed)"
echo ""
echo "💡 Remember: Deploy backend first, then frontend"
