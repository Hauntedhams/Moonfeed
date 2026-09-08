#!/bin/bash
# Render deployment start script

echo "🚀 Starting Moonfeed Backend..."
echo "📁 Current directory: $(pwd)"
echo "📋 Files in directory:"
ls -la

# Navigate to backend directory
cd backend || exit 1

echo "📁 Backend directory: $(pwd)"
echo "📋 Files in backend:"
ls -la

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Start the server
echo "🔥 Starting server..."
# Keep ample headroom in the 2GB container for buffers, native modules,
# WebSocket/RPC connections, and the Node runtime outside the V8 heap.
exec node --max-old-space-size=1280 server.js
