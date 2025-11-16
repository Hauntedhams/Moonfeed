#!/bin/bash
# Real-Time Chart Deployment Script

echo "🚀 Deploying Real-Time Chart Solution..."
echo "========================================"
echo ""

# Check if backend is running
echo "📡 Checking backend status..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
else
    echo "⚠️  Backend not running - starting backend..."
    cd backend
    npm run dev &
    BACKEND_PID=$!
    cd ..
    echo "✅ Backend started (PID: $BACKEND_PID)"
    sleep 3
fi

echo ""

# Check if frontend is running
echo "🎨 Checking frontend status..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Frontend is running"
else
    echo "⚠️  Frontend not running - starting frontend..."
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    echo "✅ Frontend started (PID: $FRONTEND_PID)"
    sleep 3
fi

echo ""
echo "========================================"
echo "✅ Deployment complete!"
echo ""
echo "📊 Services:"
echo "   Backend:  http://localhost:3001"
echo "   Frontend: http://localhost:5173"
echo "   WebSocket: ws://localhost:3001/ws/price"
echo ""
echo "🧪 Test commands:"
echo "   cd backend && node test-hybrid-pricing.js"
echo "   cd backend && node test-realtime-price.js"
echo ""
echo "📖 Documentation:"
echo "   REALTIME_CHART_COMPLETE.md"
echo ""
