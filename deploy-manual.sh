#!/bin/bash

# Manual deployment script for MoonFeed
# This gives you control over when to deploy each part

echo "🔧 MoonFeed Manual Deployment Controller"
echo "========================================"
echo ""

# Function to deploy backend
deploy_backend() {
    echo "🚀 Deploying Backend to Render..."
    echo "• Go to your Render dashboard"
    echo "• Find your moonfeed-backend service"
    echo "• Click 'Manual Deploy' → 'Deploy latest commit'"
    echo "• Wait for deployment to complete"
    echo ""
}

# Function to deploy frontend
deploy_frontend() {
    echo "🚀 Deploying Frontend to Vercel..."
    echo "• Go to your Vercel dashboard"
    echo "• Find your moonfeed-frontend project"
    echo "• Click 'View Function Logs' → 'Deployments'"
    echo "• Click 'Redeploy' on the latest deployment"
    echo "• Or use Vercel CLI: 'vercel --prod'"
    echo ""
}

# Function to deploy both
deploy_both() {
    echo "🚀 Deploying Both Services..."
    echo ""
    echo "RECOMMENDED ORDER:"
    echo "1. Deploy Backend first (API changes)"
    echo "2. Deploy Frontend second (UI changes)"
    echo ""
    deploy_backend
    read -p "Backend deployed? Press Enter to continue to frontend..."
    deploy_frontend
}

# Function to check deployment status
check_status() {
    echo "📊 Checking Deployment Status..."
    echo ""
    echo "Backend Status:"
    echo "• Check: https://dashboard.render.com/web/YOUR_SERVICE_ID"
    echo ""
    echo "Frontend Status:"
    echo "• Check: https://vercel.com/dashboard"
    echo ""
    echo "Live Sites:"
    echo "• Frontend: https://your-app.vercel.app"
    echo "• Backend: https://your-app.onrender.com/api/health"
    echo ""
}

# Main menu
echo "What would you like to deploy?"
echo ""
echo "1) Backend only"
echo "2) Frontend only"  
echo "3) Both (recommended order)"
echo "4) Check deployment status"
echo "5) Exit"
echo ""

read -p "Choose an option (1-5): " choice

case $choice in
    1)
        deploy_backend
        ;;
    2)
        deploy_frontend
        ;;
    3)
        deploy_both
        ;;
    4)
        check_status
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid option. Please choose 1-5."
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment instructions completed!"
echo "💡 Tip: Always test your changes locally before deploying"
