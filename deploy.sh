#!/bin/bash

# 🚀 MOONFEED QUICK DEPLOY SCRIPT
# Just run this script to deploy your changes!

echo "🚀 Moonfeed Quick Deploy"
echo "======================="
echo ""

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Must run from project root"
    echo "Run: cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3"
    exit 1
fi

# Show current status
echo "📊 Current Status:"
git status --short
echo ""

# Ask for commit message
echo "💬 Enter commit message (or press Enter for default):"
read -r COMMIT_MSG

if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="update: general improvements"
fi

echo ""
echo "🔄 Deploying with message: '$COMMIT_MSG'"
echo ""

# Add all changes
echo "📦 Adding changes..."
git add .

# Commit
echo "💾 Committing..."
git commit -m "$COMMIT_MSG"

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️  No changes to commit or commit failed"
    echo "Run 'git status' to see what's happening"
    exit 1
fi

# Push
echo "🚀 Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Deployment initiated"
    echo ""
    echo "📍 Your changes are being deployed:"
    echo "   • Frontend (Vercel): 1-2 minutes"
    echo "   • Backend (Render): 2-3 minutes"
    echo ""
    echo "🌐 Live URLs:"
    echo "   • Frontend: https://www.moonfeed.app"
    echo "   • Backend: https://api.moonfeed.app"
    echo ""
    echo "Wait 5 minutes, then test your changes!"
else
    echo ""
    echo "❌ Push failed!"
    echo "Check your internet connection or Git credentials"
fi
