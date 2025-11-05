#!/bin/bash

# Deployment script for Moonfeed frontend
# This script builds and deploys the frontend to production

set -e

echo "🚀 Moonfeed Frontend Deployment"
echo "================================"
echo ""

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm run build

echo ""
echo "✅ Build complete!"
echo ""
echo "📤 Deploying to production server..."
echo ""

# Deploy to production
# Note: Make sure you have SSH access configured
scp -r dist/* root@moonfeed.app:/var/www/moonfeed.app/html/

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔧 Changes made:"
echo "  - Fixed WebSocket URL from wss://moonfeed.app/ws to wss://api.moonfeed.app/ws"
echo "  - This should fix the 'offline' indicator in desktop mode"
echo ""
echo "🌐 Your site should now be live at: https://moonfeed.app"
echo "💡 You may need to hard refresh (Cmd+Shift+R) to see the changes"
