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
# Heap sized for the 1c-2g container (2GB RAM); leaves ~512MB headroom for
# non-heap (buffers, native, WS/RPC connections) before the OOM ceiling.
exec node --max-old-space-size=1536 server.js
